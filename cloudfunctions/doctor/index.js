const cloud = require("wx-server-sdk");
const https = require("https");

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const plantsCol = db.collection("plants");
const diagnosisCol = db.collection("diagnoses");

function ok(data = {}) {
  return { code: 0, message: "ok", data };
}

function fail(message) {
  return { code: -1, message, data: null };
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = https.request(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers
        }
      },
      (res) => {
        let raw = "";
        res.on("data", (chunk) => {
          raw += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`AI API ${res.statusCode}: ${raw.slice(0, 120)}`));
            return;
          }
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error("AI响应格式错误"));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

function ruleBasedDiagnose(question = "", hasImage = false) {
  const q = question.toLowerCase();

  if (q.includes("发黄") || q.includes("黄")) {
    return {
      risk_level: "medium",
      possible_causes: ["缺铁或缺氮", "土壤偏碱", "浇水频率不稳定"],
      suggestions: ["暂停额外施肥 3 天观察新叶", "检测土壤酸碱度并调至偏酸", "保持见干见湿，避免积水"],
      cautions: ["先不要连续施肥", "避免正午暴晒后立即浇水"]
    };
  }

  if (q.includes("白点") || q.includes("虫")) {
    return {
      risk_level: "high",
      possible_causes: ["白粉病", "叶螨或蚜虫", "通风不足导致真菌扩散"],
      suggestions: ["先隔离问题植株", "剪除严重叶片", "在傍晚时段喷施对应药剂"],
      cautions: ["避免高温正午喷药", "先小范围测试药害"]
    };
  }

  if (q.includes("不开花")) {
    return {
      risk_level: "medium",
      possible_causes: ["光照不足", "氮肥偏高、磷钾不足", "修剪时机不当"],
      suggestions: ["增加直射光时长", "补充磷钾肥", "复盘最近修剪时间并调整"],
      cautions: ["避免短时间内频繁换环境"]
    };
  }

  return {
    risk_level: hasImage ? "medium" : "low",
    possible_causes: ["环境波动", "浇水或施肥节奏不稳定", "季节变化导致应激"],
    suggestions: ["连续 3 天观察新叶和土壤", "保持固定浇水窗口", "必要时补充1次微量元素"],
    cautions: ["先做小步调整，不要多变量同时改动"]
  };
}

async function callExternalModel(question, imageFileID) {
  const apiUrl = process.env.MODEL_API_URL;
  const apiKey = process.env.MODEL_API_KEY;

  if (!apiUrl || !apiKey) return null;

  const prompt = [
    "你是植物养护助手。",
    "请返回JSON：{risk_level,possible_causes,suggestions,cautions}",
    "risk_level取值 low|medium|high。",
    `用户问题：${question || "未提供文本"}`,
    `是否有图片：${imageFileID ? "是" : "否"}`
  ].join("\n");

  const response = await postJson(
    apiUrl,
    {
      model: process.env.MODEL_NAME || "gpt-4.1-mini",
      messages: [{ role: "user", content: prompt }]
    },
    {
      Authorization: `Bearer ${apiKey}`
    }
  );

  const text = response.output_text || response?.choices?.[0]?.message?.content;
  if (!text) return null;

  try {
    const parsed = JSON.parse(text);
    if (!parsed.possible_causes || !parsed.suggestions) return null;
    return parsed;
  } catch (error) {
    return null;
  }
}

async function diagnose(event, openid) {
  const question = (event.question || "").trim();
  const image_file_id = (event.image_file_id || "").trim();
  const plant_id = (event.plant_id || "").trim();

  if (!question && !image_file_id) {
    return fail("请输入问题或上传图片");
  }

  let plant = null;
  if (plant_id) {
    const { data } = await plantsCol.where({ user_id: openid, plant_id }).limit(1).get();
    if (data.length) plant = data[0];
  }

  let aiResult = null;
  try {
    aiResult = await callExternalModel(question, image_file_id);
  } catch (error) {
    console.error("external model failed", error);
  }

  if (!aiResult) {
    aiResult = ruleBasedDiagnose(question, Boolean(image_file_id));
  }

  const now = Date.now();
  const diagnosis = {
    diagnosis_id: makeId("diag"),
    user_id: openid,
    plant_id,
    plant_name: plant ? plant.plant_name : "",
    question,
    image_file_id,
    ai_result: aiResult,
    create_time: now
  };

  await diagnosisCol.add({ data: diagnosis });

  return ok({
    ...aiResult,
    diagnosis_id: diagnosis.diagnosis_id,
    create_time: now
  });
}

async function history(openid) {
  const { data } = await diagnosisCol.where({ user_id: openid }).orderBy("create_time", "desc").limit(20).get();

  const list = data.map((item) => ({
    diagnosis_id: item.diagnosis_id,
    plant_id: item.plant_id,
    plant_name: item.plant_name,
    question: item.question,
    create_time: item.create_time
  }));

  return ok(list);
}

exports.main = async (event) => {
  try {
    const { OPENID } = cloud.getWXContext();
    const action = event.action;

    if (action === "diagnose") return await diagnose(event, OPENID);
    if (action === "history") return await history(OPENID);

    return fail("不支持的 action");
  } catch (error) {
    console.error("doctor function error", error);
    return fail(error.message || "服务异常");
  }
};
