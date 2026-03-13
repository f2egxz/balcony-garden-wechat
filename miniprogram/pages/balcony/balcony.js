const api = require("../../utils/api");

Page({
  data: {
    summary: {
      total: 0,
      healthy: 0,
      focus: 0,
      suggestions: [],
      focus_plants: []
    }
  },

  onShow() {
    this.loadSummary();
  },

  async loadSummary() {
    try {
      const summary = await api.getSummary();
      this.setData({ summary });
    } catch (error) {
      console.error("loadSummary failed", error);
    }
  }
});
