const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const plantsCol = db.collection("plants");
const recordsCol = db.collection("care_records");

function ok(data = {}) {
  return { code: 0, message: "ok", data };
}

function fail(message) {
  return { code: -1, message, data: null };
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function createPlant(event, openid) {
  const plant_name = (event.plant_name || "").trim();
  const plant_type = (event.plant_type || "").trim();

  if (!plant_name) return fail("植物名称不能为空");
  if (!plant_type) return fail("植物类型不能为空");

  const now = Date.now();
  const doc = {
    plant_id: makeId("plant"),
    user_id: openid,
    plant_name,
    plant_type,
    pot_size: (event.pot_size || "").trim(),
    location: (event.location || "").trim(),
    acquire_time: (event.acquire_time || "").trim(),
    create_time: now,
    update_time: now
  };

  await plantsCol.add({ data: doc });
  return ok(doc);
}

async function listPlants(openid) {
  const { data } = await plantsCol.where({ user_id: openid }).orderBy("create_time", "desc").get();

  const plants = [];
  for (const plant of data) {
    const { data: recordData } = await recordsCol
      .where({ user_id: openid, plant_id: plant.plant_id })
      .orderBy("action_time", "desc")
      .limit(20)
      .get();

    let lastWater = 0;
    let lastFertilize = 0;

    for (const record of recordData) {
      if (!lastWater && record.action_type === "water") lastWater = record.action_time;
      if (!lastFertilize && record.action_type === "fertilize") lastFertilize = record.action_time;
      if (lastWater && lastFertilize) break;
    }

    plants.push({
      ...plant,
      last_water_time: lastWater,
      last_fertilize_time: lastFertilize,
      status_text: "正常"
    });
  }

  return ok(plants);
}

async function getPlantDetail(event, openid) {
  const plant_id = (event.plant_id || "").trim();
  if (!plant_id) return fail("缺少 plant_id");

  const { data } = await plantsCol.where({ user_id: openid, plant_id }).limit(1).get();
  if (!data.length) return fail("植物不存在");

  return ok(data[0]);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const action = event.action;

    if (action === "createPlant") return await createPlant(event, OPENID);
    if (action === "listPlants") return await listPlants(OPENID);
    if (action === "getPlantDetail") return await getPlantDetail(event, OPENID);

    return fail("不支持的 action");
  } catch (error) {
    console.error("plant function error", error);
    return fail(error.message || "服务异常");
  }
};
