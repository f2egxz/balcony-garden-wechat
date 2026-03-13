const api = require("../../utils/api");
const { formatDateTime } = require("../../utils/format");

function priorityRank(priority) {
  const rank = { high: 3, medium: 2, low: 1 };
  return rank[priority] || 0;
}

Page({
  data: {
    reminders: [],
    counts: {
      overdue: 0,
      today: 0
    }
  },

  async onShow() {
    await this.ensureDailyReminders();
    await this.loadSimpleReminders();
  },

  async ensureDailyReminders() {
    try {
      await api.generateDailyReminders();
    } catch (error) {
      console.error("generateDailyReminders failed", error);
    }
  },

  async loadSimpleReminders() {
    try {
      const [overdueData, todayData] = await Promise.all([
        api.listReminders("overdue"),
        api.listReminders("today")
      ]);

      const overdueList = overdueData.list || [];
      const todayList = todayData.list || [];

      const merged = [...overdueList, ...todayList]
        .map((item) => ({
          ...item,
          due_text: formatDateTime(item.due_date)
        }))
        .sort((a, b) => {
          const pr = priorityRank(b.priority) - priorityRank(a.priority);
          if (pr !== 0) return pr;
          return (a.due_date || 0) - (b.due_date || 0);
        });

      this.setData({
        reminders: merged,
        counts: {
          overdue: overdueList.length,
          today: todayList.length
        }
      });
    } catch (error) {
      console.error("loadSimpleReminders failed", error);
    }
  },

  async completeReminder(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;

    try {
      await api.completeReminder(id);
      wx.showToast({ title: "已完成", icon: "success" });
      this.loadSimpleReminders();
    } catch (error) {
      console.error("complete reminder failed", error);
    }
  },

  requestSubscribe() {
    const app = getApp();
    const templateId = app.globalData.subscribeTemplateId;

    if (!templateId || templateId === "your-subscribe-template-id") {
      wx.showModal({
        title: "需要配置模板ID",
        content: "请先在 app.js 设置 subscribeTemplateId，然后再发起订阅。",
        showCancel: false
      });
      return;
    }

    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: async (res) => {
        const result = res && res[templateId] ? res[templateId] : "unknown";
        try {
          await api.saveSubscribeTicket(templateId, result, "reminders_page");
        } catch (error) {
          console.error("saveSubscribeTicket failed", error);
        }

        if (result === "accept") {
          wx.showToast({ title: "订阅成功", icon: "success" });
          return;
        }

        if (result === "reject") {
          wx.showToast({ title: "你已拒绝订阅", icon: "none" });
          return;
        }

        wx.showToast({ title: "订阅结果已记录", icon: "none" });
      },
      fail: (error) => {
        console.error("requestSubscribeMessage failed", error);
        wx.showToast({ title: "订阅失败", icon: "none" });
      }
    });
  }
});
