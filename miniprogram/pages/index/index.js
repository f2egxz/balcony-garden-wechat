const api = require("../../utils/api");

Page({
  data: {
    todayText: "",
    tasks: []
  },

  onLoad() {
    this.setData({ todayText: this.getTodayText() });
  },

  onShow() {
    this.loadData();
  },

  getTodayText() {
    const d = new Date();
    return `${d.getMonth() + 1}月${d.getDate()}日 今日建议`;
  },

  async loadData() {
    try {
      const taskData = await api.getTodayTasks();
      this.setData({
        tasks: (taskData.tasks || []).slice(0, 3)
      });
    } catch (error) {
      console.error("loadData failed", error);
    }
  },

  goPlants() {
    wx.switchTab({ url: "/pages/plants/plants" });
  },

  goReminders() {
    wx.switchTab({ url: "/pages/reminders/reminders" });
  },

  handleTaskTap(e) {
    const { plantId } = e.currentTarget.dataset;
    if (!plantId) return;
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${plantId}` });
  }
});
