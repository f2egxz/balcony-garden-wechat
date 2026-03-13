const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;
const plantsCol = db.collection("plants");
const recordsCol = db.collection("care_records");
const remindersCol = db.collection("reminders");
const subscribeTicketsCol = db.collection("subscribe_tickets");

function ok(data = {}) {
  return { code: 0, message: "ok", data };
}

function fail(message) {
  return { code: -1, message, data: null };
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function addDays(ts, days) {
  return ts + days * 24 * 60 * 60 * 1000;
}

function calcPriority(days, threshold) {
  if (days >= threshold + 2) return "high";
  if (days >= threshold) return "medium";
  return "low";
}

function actionLabel(action) {
  const map = {
    water: "浇水",
    fertilize: "施肥",
    prune: "修剪",
    repot: "换盆"
  };
  return map[action] || action;
}

function priorityLabel(priority) {
  const map = {
    high: "高优先",
    medium: "中优先",
    low: "建议处理"
  };
  return map[priority] || "建议处理";
}

function priorityRank(priority) {
  const rank = { high: 3, medium: 2, low: 1 };
  return rank[priority] || 0;
}

function truncateThing(text, max = 20) {
  if (!text) return "待处理";
  const clean = String(text).replace(/\s+/g, " ").trim();
  if (!clean) return "待处理";
  return clean.slice(0, max);
}

async function hasPendingReminder(userId, plantId, actionType, dayStart, dayEnd) {
  const { data } = await remindersCol
    .where({
      user_id: userId,
      plant_id: plantId,
      action_type: actionType,
      status: "pending",
      due_date: _.gte(dayStart).and(_.lte(dayEnd))
    })
    .limit(1)
    .get();

  return data.length > 0;
}

async function createReminder({ user_id, plant, action_type, title, due_date, priority, source }) {
  const now = Date.now();
  const reminder = {
    reminder_id: makeId("reminder"),
    user_id,
    plant_id: plant.plant_id,
    plant_name: plant.plant_name,
    action_type,
    title,
    due_date,
    status: "pending",
    priority,
    source,
    create_time: now,
    update_time: now
  };

  await remindersCol.add({ data: reminder });
  return reminder;
}

async function getRecentActionMap(userId, plantId) {
  const { data } = await recordsCol
    .where({ user_id: userId, plant_id: plantId })
    .orderBy("action_time", "desc")
    .limit(50)
    .get();

  let water = 0;
  let fertilize = 0;

  for (const record of data) {
    if (!water && record.action_type === "water") water = record.action_time;
    if (!fertilize && record.action_type === "fertilize") fertilize = record.action_time;
    if (water && fertilize) break;
  }

  return { water, fertilize };
}

async function generateDailyRemindersForUser(userId, dateTs = Date.now()) {
  const { data: plants } = await plantsCol.where({ user_id: userId }).get();
  if (!plants.length) {
    return { user_id: userId, generated: 0, skipped: 0 };
  }

  const todayStart = startOfDay(dateTs);
  const todayEnd = endOfDay(dateTs);

  let generated = 0;
  let skipped = 0;

  for (const plant of plants) {
    const { water, fertilize } = await getRecentActionMap(userId, plant.plant_id);
    const now = Date.now();

    const waterDays = water ? Math.floor((now - water) / 86400000) : 99;
    const fertilizeDays = fertilize ? Math.floor((now - fertilize) / 86400000) : 99;

    if (waterDays >= 2) {
      const exists = await hasPendingReminder(userId, plant.plant_id, "water", todayStart, todayEnd);
      if (!exists) {
        const priority = calcPriority(waterDays, 2);
        await createReminder({
          user_id: userId,
          plant,
          action_type: "water",
          title: waterDays >= 99 ? "首次建议浇水" : `${waterDays}天未浇水，建议补水`,
          due_date: addDays(todayStart, 0) + 9 * 60 * 60 * 1000,
          priority,
          source: "daily"
        });
        generated += 1;
      } else {
        skipped += 1;
      }
    }

    if (fertilizeDays >= 7) {
      const exists = await hasPendingReminder(userId, plant.plant_id, "fertilize", todayStart, todayEnd);
      if (!exists) {
        const priority = calcPriority(fertilizeDays, 7);
        await createReminder({
          user_id: userId,
          plant,
          action_type: "fertilize",
          title: fertilizeDays >= 99 ? "建议建立施肥记录" : `${fertilizeDays}天未施肥，建议补充肥料`,
          due_date: addDays(todayStart, 0) + 18 * 60 * 60 * 1000,
          priority,
          source: "daily"
        });
        generated += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return { user_id: userId, generated, skipped };
}

function normalizeReminder(item) {
  const todayStart = startOfDay();
  const todayEnd = endOfDay();
  let bucket = "upcoming";

  if (item.due_date < todayStart) bucket = "overdue";
  if (item.due_date >= todayStart && item.due_date <= todayEnd) bucket = "today";

  return {
    ...item,
    priority_text: priorityLabel(item.priority),
    action_text: actionLabel(item.action_type),
    bucket
  };
}

async function listReminders(event, openid) {
  const filter = event.filter || "today";
  const status = event.status || "pending";

  const { data } = await remindersCol
    .where({ user_id: openid, status })
    .orderBy("due_date", "asc")
    .limit(100)
    .get();

  const normalized = data.map(normalizeReminder);

  const counts = {
    overdue: normalized.filter((x) => x.bucket === "overdue").length,
    today: normalized.filter((x) => x.bucket === "today").length,
    upcoming: normalized.filter((x) => x.bucket === "upcoming").length
  };

  const list = normalized.filter((item) => item.bucket === filter);

  return ok({ list, counts });
}

async function completeReminder(event, openid) {
  const reminder_id = (event.reminder_id || "").trim();
  if (!reminder_id) return fail("缺少 reminder_id");

  const { data } = await remindersCol.where({ user_id: openid, reminder_id }).limit(1).get();
  if (!data.length) return fail("提醒不存在");

  const reminder = data[0];
  if (reminder.status === "done") return ok({ reminder_id, status: "done" });

  const now = Date.now();
  await remindersCol.where({ user_id: openid, reminder_id }).update({
    data: {
      status: "done",
      done_time: now,
      update_time: now,
      done_source: event.done_source || "manual"
    }
  });

  const syncRecord = event.sync_record !== false;
  if (syncRecord) {
    const record = {
      record_id: makeId("record"),
      user_id: openid,
      plant_id: reminder.plant_id,
      action_type: reminder.action_type,
      action_time: now,
      note: "提醒页完成",
      create_time: now
    };
    await recordsCol.add({ data: record });
  }

  return ok({ reminder_id, status: "done" });
}

async function postponeReminder(event, openid) {
  const reminder_id = (event.reminder_id || "").trim();
  const days = Number(event.days || 1);
  if (!reminder_id) return fail("缺少 reminder_id");

  const { data } = await remindersCol.where({ user_id: openid, reminder_id, status: "pending" }).limit(1).get();
  if (!data.length) return fail("提醒不存在或已完成");

  const target = data[0];
  const nextDue = addDays(target.due_date || Date.now(), Math.max(1, days));

  await remindersCol.where({ user_id: openid, reminder_id }).update({
    data: {
      due_date: nextDue,
      update_time: Date.now(),
      source: "postpone"
    }
  });

  return ok({ reminder_id, due_date: nextDue });
}

async function saveSubscribeTicket(event, openid) {
  const template_id = (event.template_id || "").trim();
  const result = String(event.result || "accept").toLowerCase();
  const scene = (event.scene || "reminders_page").trim();

  if (!template_id) return fail("缺少 template_id");

  const now = Date.now();
  const ticket = {
    ticket_id: makeId("ticket"),
    user_id: openid,
    template_id,
    result,
    scene,
    used: false,
    consume_status: "pending",
    create_time: now,
    update_time: now
  };

  await subscribeTicketsCol.add({ data: ticket });
  return ok({ ticket_id: ticket.ticket_id, result });
}

async function getLatestUsableTicket(userId) {
  const { data } = await subscribeTicketsCol
    .where({ user_id: userId, result: "accept", used: false })
    .orderBy("create_time", "desc")
    .limit(1)
    .get();

  if (!data.length) return null;
  return data[0];
}

async function getTopPendingReminderForPush(userId) {
  const todayEnd = endOfDay();
  const { data } = await remindersCol
    .where({ user_id: userId, status: "pending", due_date: _.lte(todayEnd) })
    .orderBy("due_date", "asc")
    .limit(50)
    .get();

  if (!data.length) return null;

  data.sort((a, b) => {
    const p = priorityRank(b.priority) - priorityRank(a.priority);
    if (p !== 0) return p;
    return (a.due_date || 0) - (b.due_date || 0);
  });

  return data[0];
}

function buildSubscribeData(reminder) {
  const theme = truncateThing(`${reminder.plant_name || "植物"}${actionLabel(reminder.action_type)}提醒`, 20);
  const priority = truncateThing(priorityLabel(reminder.priority), 20);
  const desc = truncateThing(reminder.title || "有待处理养护任务", 20);
  const note = truncateThing("打开小程序处理提醒", 20);

  return {
    thing1: { value: theme },
    thing17: { value: priority },
    thing4: { value: desc },
    thing12: { value: note }
  };
}

async function markTicket(ticket, patch) {
  const data = {
    update_time: Date.now(),
    ...patch
  };
  await subscribeTicketsCol.doc(ticket._id).update({ data });
}

async function sendSubscribeForUser(userId) {
  const ticket = await getLatestUsableTicket(userId);
  if (!ticket) return { sent: false, reason: "no_ticket" };

  const reminder = await getTopPendingReminderForPush(userId);
  if (!reminder) return { sent: false, reason: "no_pending_reminder" };

  const payload = buildSubscribeData(reminder);

  try {
    await cloud.openapi.subscribeMessage.send({
      touser: userId,
      templateId: ticket.template_id,
      page: "pages/reminders/reminders",
      data: payload
    });

    await markTicket(ticket, {
      used: true,
      used_time: Date.now(),
      consume_status: "sent",
      reminder_id: reminder.reminder_id
    });

    return { sent: true, reminder_id: reminder.reminder_id };
  } catch (error) {
    const errCode = Number(error?.errCode || 0);
    const consumeOnFailCodes = [40003, 40037, 43101, 47003];
    const shouldConsume = consumeOnFailCodes.includes(errCode);

    await markTicket(ticket, {
      used: shouldConsume,
      used_time: shouldConsume ? Date.now() : 0,
      consume_status: shouldConsume ? "invalid" : "failed",
      last_error_code: String(error?.errCode || "unknown"),
      last_error_message: truncateThing(error?.message || "send failed", 60)
    });

    return {
      sent: false,
      reason: "send_failed",
      err_code: String(error?.errCode || "unknown")
    };
  }
}

async function generateForAllUsers(options = {}) {
  const sendSubscribe = options.send_subscribe !== false;

  const { data: plants } = await plantsCol.limit(1000).get();
  const { data: tickets } = await subscribeTicketsCol.where({ result: "accept", used: false }).limit(1000).get();

  const userIds = [
    ...new Set([
      ...plants.map((item) => item.user_id),
      ...tickets.map((item) => item.user_id)
    ].filter(Boolean))
  ];

  let totalGenerated = 0;
  let totalSent = 0;
  const details = [];

  for (const userId of userIds) {
    const generateResult = await generateDailyRemindersForUser(userId, Date.now());
    totalGenerated += generateResult.generated;

    let notifyResult = { sent: false, reason: "disabled" };
    if (sendSubscribe) {
      notifyResult = await sendSubscribeForUser(userId);
      if (notifyResult.sent) totalSent += 1;
    }

    details.push({
      ...generateResult,
      notify: notifyResult
    });
  }

  return ok({
    users: userIds.length,
    total_generated: totalGenerated,
    send_subscribe: sendSubscribe,
    total_sent: totalSent,
    details
  });
}

exports.main = async (event = {}) => {
  try {
    const { OPENID } = cloud.getWXContext();

    if (event.action === "generateDailyReminders") {
      if (!OPENID) return fail("未获取到用户身份");
      return ok(await generateDailyRemindersForUser(OPENID, Date.now()));
    }

    if (event.action === "listReminders") {
      if (!OPENID) return fail("未获取到用户身份");
      return await listReminders(event, OPENID);
    }

    if (event.action === "completeReminder") {
      if (!OPENID) return fail("未获取到用户身份");
      return await completeReminder(event, OPENID);
    }

    if (event.action === "postponeReminder") {
      if (!OPENID) return fail("未获取到用户身份");
      return await postponeReminder(event, OPENID);
    }

    if (event.action === "saveSubscribeTicket") {
      if (!OPENID) return fail("未获取到用户身份");
      return await saveSubscribeTicket(event, OPENID);
    }

    if (event.action === "generateForAllUsers") {
      return await generateForAllUsers(event);
    }

    if (!event.action && event.triggerName) {
      return await generateForAllUsers({ send_subscribe: true });
    }

    return fail("不支持的 action");
  } catch (error) {
    console.error("reminder function error", error);
    return fail(error.message || "服务异常");
  }
};
