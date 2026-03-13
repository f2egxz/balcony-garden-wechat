const cloud = require("wx-server-sdk");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const plantsCol = db.collection("plants");
const recordsCol = db.collection("care_records");
const diagnosisCol = db.collection("diagnoses");

function ok(data = {}) {
  return { code: 0, message: "ok", data };
}

function fail(message) {
  return { code: -1, message, data: null };
}

async function getSummary(openid) {
  const { data: plants } = await plantsCol.where({ user_id: openid }).get();

  if (!plants.length) {
    return ok({
      total: 0,
      healthy: 0,
      focus: 0,
      suggestions: [],
      focus_plants: []
    });
  }

  const plantMap = new Map(plants.map((item) => [item.plant_id, item]));
  const plantIds = plants.map((item) => item.plant_id);

  const { data: records } = await recordsCol
    .where({ user_id: openid, plant_id: db.command.in(plantIds) })
    .orderBy("action_time", "desc")
    .limit(500)
    .get();

  const { data: diagnoses } = await diagnosisCol
    .where({ user_id: openid })
    .orderBy("create_time", "desc")
    .limit(50)
    .get();

  const latestWater = {};
  const latestDiagnosis = {};

  for (const record of records) {
    if (record.action_type === "water" && !latestWater[record.plant_id]) {
      latestWater[record.plant_id] = record.action_time;
    }
  }

  for (const diag of diagnoses) {
    if (diag.plant_id && !latestDiagnosis[diag.plant_id]) {
      latestDiagnosis[diag.plant_id] = diag;
    }
  }

  const focusPlants = [];

  for (const plantId of plantIds) {
    const plant = plantMap.get(plantId);
    if (!plant) continue;

    const waterTs = latestWater[plantId] || 0;
    const waterDays = waterTs ? Math.floor((Date.now() - waterTs) / 86400000) : 99;

    if (waterDays >= 4) {
      focusPlants.push({
        plant_id: plantId,
        plant_name: plant.plant_name,
        reason: waterDays >= 99 ? "长期未记录浇水" : `${waterDays}天未浇水`
      });
      continue;
    }

    const latestDiag = latestDiagnosis[plantId];
    if (latestDiag && latestDiag.ai_result && latestDiag.ai_result.risk_level === "high") {
      focusPlants.push({
        plant_id: plantId,
        plant_name: plant.plant_name,
        reason: "最近一次AI诊断风险较高"
      });
    }
  }

  const suggestions = [];

  if (focusPlants.length) {
    for (const item of focusPlants.slice(0, 3)) {
      suggestions.push(`${item.plant_name}：${item.reason}`);
    }
  }

  for (const diag of diagnoses.slice(0, 3)) {
    const firstSuggestion = diag.ai_result?.suggestions?.[0];
    if (firstSuggestion) {
      suggestions.push(`${diag.plant_name || "未指定植物"}：${firstSuggestion}`);
    }
  }

  const dedupSuggestions = [...new Set(suggestions)].slice(0, 5);

  return ok({
    total: plants.length,
    healthy: Math.max(plants.length - focusPlants.length, 0),
    focus: focusPlants.length,
    suggestions: dedupSuggestions,
    focus_plants: focusPlants
  });
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();

    if (event.action === "getSummary") {
      return await getSummary(OPENID);
    }

    return fail("不支持的 action");
  } catch (error) {
    console.error("summary function error", error);
    return fail(error.message || "服务异常");
  }
};
