const api = require("../../utils/api");
const { daysAgo } = require("../../utils/format");

Page({
  data: {
    plants: []
  },

  onShow() {
    this.loadPlants();
  },

  async loadPlants() {
    try {
      const plants = await api.listPlants();
      const normalized = (plants || []).map((item) => ({
        ...item,
        water_text: item.last_water_time ? `最近浇水：${daysAgo(item.last_water_time)}` : "最近浇水：暂无",
        fertilize_text: item.last_fertilize_time ? `最近施肥：${daysAgo(item.last_fertilize_time)}` : "最近施肥：暂无"
      }));
      this.setData({ plants: normalized });
    } catch (error) {
      console.error("loadPlants failed", error);
    }
  },

  goAddPlant() {
    wx.navigateTo({ url: "/pages/add-plant/add-plant" });
  },

  goDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: `/pages/plant-detail/plant-detail?id=${id}` });
  }
});
