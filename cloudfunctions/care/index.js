const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const plantsCol = db.collection("plants");
const recordsCol = db.collection("care_records");
const remindersCol = db.collection("reminders");

function ok(data = {}) {
  return { code: 0, message: "ok", data };
}

function fail(message) {
  return { code: -1, message, data: null };
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function taskLevelText(level) {
  if (level === "high") return "高优先";
  if (level === "medium") return "中优先";
  return "建议处理";
}

async function addRecord(event, openid) {
  const plant_id = (event.plant_id || "").trim();
  const action_type = (event.action_type || "").trim();

  if (!plant_id || !action_type) {
    return fail("缺少 plant_id 或 action_type");
  }

  const { data: plants } = await plantsCol.where({ user_id: openid, plant_id }).limit(1).get();
  if (!plants.length) return fail("植物不存在");

  const now = Date.now();
  const doc = {
    record_id: makeId("record"),
    user_id: openid,
    plant_id,
    action_type,
    action_time: now,
    note: (event.note || "").trim(),
    create_time: now
  };

  await recordsCol.add({ data: doc });

  // 记录完成后，自动关闭当天及逾期同类型提醒，形成提醒闭环。
  try {
    await remindersCol
      .where({
        user_id: openid,
        plant_id,
        action_type,
        status: "pending",
        due_date: _.lte(now)
      })
      .update({
        data: {
          status: "done",
          done_time: now,
          done_source: "care_record",
          update_time: now
        }
      });
  } catch (error) {
    // 不阻塞主流程：提醒集合未创建或更新失败时仍保证记录成功。
    console.error("auto close reminder failed", error);
  }

  return ok(doc);
}

async function listRecords(event, openid) {
  const plant_id = (event.plant_id || "").trim();
  if (!plant_id) return fail("缺少 plant_id");

  const { data } = await recordsCol
    .where({ user_id: openid, plant_id })
    .orderBy("action_time", "desc")
    .limit(100)
    .get();

  return ok(data);
}

async function getTodayTasks(openid) {
  const { data: plants } = await plantsCol.where({ user_id: openid }).get();

  if (!plants.length) {
    return ok({ tasks: [] });
  }

  const tasks = [];

  for (const plant of plants) {
    const { data: recent } = await recordsCol
      .where({ user_id: openid, plant_id: plant.plant_id })
      .orderBy("action_time", "desc")
      .limit(30)
      .get();

    let lastWater = 0;
    let lastFertilize = 0;

    for (const item of recent) {
      if (!lastWater && item.action_type === "water") lastWater = item.action_time;
      if (!lastFertilize && item.action_type === "fertilize") lastFertilize = item.action_time;
      if (lastWater && lastFertilize) break;
    }

    const now = Date.now();
    const waterDays = lastWater ? Math.floor((now - lastWater) / 86400000) : 99;
    const fertilizeDays = lastFertilize ? Math.floor((now - lastFertilize) / 86400000) : 99;

    if (waterDays >= 2) {
      const level = waterDays >= 4 ? "high" : "medium";
      tasks.push({
        task_id: makeId("task"),
        plant_id: plant.plant_id,
        plant_name: plant.plant_name,
        tip: waterDays >= 99 ? "首次建议浇水" : `${waterDays}天未浇水，建议补水`,
        level,
        level_text: taskLevelText(level)
      });
    }

    if (fertilizeDays >= 7) {
      tasks.push({
        task_id: makeId("task"),
        plant_id: plant.plant_id,
        plant_name: plant.plant_name,
        tip: fertilizeDays >= 99 ? "建议建立施肥记录" : `${fertilizeDays}天未施肥，建议补充肥料`,
        level: "medium",
        level_text: taskLevelText("medium")
      });
    }

    if (waterDays < 2 && fertilizeDays < 7) {
      tasks.push({
        task_id: makeId("task"),
        plant_id: plant.plant_id,
        plant_name: plant.plant_name,
        tip: "状态稳定，今日检查土壤湿度即可",
        level: "low",
        level_text: taskLevelText("low")
      });
    }
  }

  tasks.sort((a, b) => {
    const rank = { high: 3, medium: 2, low: 1 };
    return rank[b.level] - rank[a.level];
  });

  return ok({ tasks: tasks.slice(0, 30) });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const action = event.action;

    if (action === "addRecord") return await addRecord(event, OPENID);
    if (action === "listRecords") return await listRecords(event, OPENID);
    if (action === "getTodayTasks") return await getTodayTasks(OPENID);

    return fail("不支持的 action");
  } catch (error) {
    console.error("care function error", error);
    return fail(error.message || "服务异常");
  }
};
