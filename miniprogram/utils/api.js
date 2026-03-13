function normalizeError(error) {
  if (!error) return "未知错误";
  if (typeof error === "string") return error;
  return error.message || "请求失败";
}

async function callCloud(name, data = {}, options = {}) {
  const { loading = false, loadingText = "加载中..." } = options;

  if (loading) {
    wx.showLoading({ title: loadingText, mask: true });
  }

  try {
    const res = await wx.cloud.callFunction({ name, data });
    const payload = res.result || {};

    if (payload.code !== 0) {
      throw new Error(payload.message || "服务异常");
    }

    return payload.data;
  } catch (error) {
    const message = normalizeError(error);
    wx.showToast({ title: message, icon: "none" });
    throw error;
  } finally {
    if (loading) {
      wx.hideLoading();
    }
  }
}

module.exports = {
  getTodayTasks() {
    return callCloud("care", { action: "getTodayTasks" }, { loading: true, loadingText: "加载今日任务" });
  },

  listPlants() {
    return callCloud("plant", { action: "listPlants" }, { loading: true, loadingText: "加载植物" });
  },

  createPlant(form) {
    return callCloud("plant", { action: "createPlant", ...form }, { loading: true, loadingText: "保存植物" });
  },

  getPlantDetail(plant_id) {
    return callCloud("plant", { action: "getPlantDetail", plant_id }, { loading: true, loadingText: "加载详情" });
  },

  addCareRecord(payload) {
    return callCloud("care", { action: "addRecord", ...payload }, { loading: true, loadingText: "保存记录" });
  },

  getCareRecords(plant_id) {
    return callCloud("care", { action: "listRecords", plant_id }, { loading: true, loadingText: "加载记录" });
  },

  diagnose(payload) {
    return callCloud("doctor", { action: "diagnose", ...payload }, { loading: true, loadingText: "AI分析中" });
  },

  getDiagnosisHistory() {
    return callCloud("doctor", { action: "history" }, { loading: true, loadingText: "加载诊断历史" });
  },

  getSummary() {
    return callCloud("summary", { action: "getSummary" }, { loading: true, loadingText: "加载阳台概览" });
  },

  generateDailyReminders() {
    return callCloud("reminder", { action: "generateDailyReminders" }, { loading: false });
  },

  listReminders(filter = "today") {
    return callCloud("reminder", { action: "listReminders", filter }, { loading: true, loadingText: "加载提醒" });
  },

  completeReminder(reminder_id) {
    return callCloud(
      "reminder",
      { action: "completeReminder", reminder_id, sync_record: true, done_source: "mini_program" },
      { loading: true, loadingText: "完成提醒" }
    );
  },

  postponeReminder(reminder_id, days = 1) {
    return callCloud("reminder", { action: "postponeReminder", reminder_id, days }, { loading: true, loadingText: "延后提醒" });
  },

  saveSubscribeTicket(template_id, result, scene = "reminders_page") {
    return callCloud(
      "reminder",
      { action: "saveSubscribeTicket", template_id, result, scene },
      { loading: false }
    );
  }
};
