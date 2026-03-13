App({
  globalData: {
    envId: "cloud1-8g16tlco57063299",
    subscribeTemplateId: "KxTZ9W5nNwmNIpQBE9v87WWPxOE2k3IQq_rHu--d2gI"
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上基础库以使用云能力");
      return;
    }

    wx.cloud.init({
      env: this.globalData.envId,
      traceUser: true
    });
  }
});
