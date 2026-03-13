const api = require("../../utils/api");
const { formatDateTime } = require("../../utils/format");

const ACTION_NAME = {
  water: "浇水",
  fertilize: "施肥",
  prune: "修剪",
  repot: "换盆"
};

Page({
  data: {
    plantId: "",
    plant: null,
    records: [],
    actions: [
      { type: "water", label: "浇水" },
      { type: "fertilize", label: "施肥" }
    ]
  },

  onLoad(options) {
    this.setData({ plantId: options.id || "" });
  },

  onShow() {
    if (this.data.plantId) {
      this.loadData();
    }
  },

  async loadData() {
    const plantId = this.data.plantId;
    if (!plantId) return;

    try {
      const [plant, records] = await Promise.all([
        api.getPlantDetail(plantId),
        api.getCareRecords(plantId)
      ]);

      this.setData({
        plant,
        records: (records || []).map((item) => ({
          ...item,
          action_text: ACTION_NAME[item.action_type] || item.action_type,
          time_text: formatDateTime(item.action_time)
        }))
      });
    } catch (error) {
      console.error("load detail failed", error);
    }
  },

  async quickRecord(e) {
    const { action } = e.currentTarget.dataset;
    if (!action) return;

    await this.submitRecord({
      plant_id: this.data.plantId,
      action_type: action,
      note: action === "fertilize" ? "详情页快捷施肥" : "详情页快捷浇水"
    });
  },

  async submitRecord(payload) {
    try {
      await api.addCareRecord(payload);
      wx.showToast({ title: "记录成功", icon: "success" });
      this.loadData();
    } catch (error) {
      console.error("submitRecord failed", error);
    }
  },

  reportIssue() {
    wx.setStorageSync("doctor_selected_plant_id", this.data.plantId);
    wx.switchTab({ url: "/pages/doctor/doctor" });
  }
});
