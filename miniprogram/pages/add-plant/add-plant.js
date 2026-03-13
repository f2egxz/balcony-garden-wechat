const api = require("../../utils/api");

const TYPE_OPTIONS = ["蓝莓", "柠檬", "月季", "绣球", "绿植", "多肉", "其他"];
const POT_OPTIONS = ["小盆", "中盆", "大盆", "超大盆"];

Page({
  data: {
    form: {
      plant_name: "",
      plant_type: "",
      pot_size: "",
      location: "阳台",
      acquire_time: ""
    },
    typeOptions: TYPE_OPTIONS,
    potOptions: POT_OPTIONS,
    typeIndex: -1,
    potIndex: -1,
    date: ""
  },

  onLoad() {
    const today = this.getToday();
    this.setData({
      date: today,
      "form.acquire_time": today
    });
  },

  getToday() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  },

  onNameInput(e) {
    this.setData({ "form.plant_name": e.detail.value.trim() });
  },

  onLocationInput(e) {
    this.setData({ "form.location": e.detail.value.trim() });
  },

  onTypeChange(e) {
    const idx = Number(e.detail.value);
    this.setData({
      typeIndex: idx,
      "form.plant_type": TYPE_OPTIONS[idx]
    });
  },

  onPotChange(e) {
    const idx = Number(e.detail.value);
    this.setData({
      potIndex: idx,
      "form.pot_size": POT_OPTIONS[idx]
    });
  },

  onDateChange(e) {
    this.setData({
      date: e.detail.value,
      "form.acquire_time": e.detail.value
    });
  },

  async submit() {
    const form = this.data.form;
    if (!form.plant_name) {
      wx.showToast({ title: "请输入植物名称", icon: "none" });
      return;
    }

    if (!form.plant_type) {
      wx.showToast({ title: "请选择植物类型", icon: "none" });
      return;
    }

    try {
      await api.createPlant(form);
      wx.showToast({ title: "创建成功", icon: "success" });
      setTimeout(() => {
        wx.navigateBack({ delta: 1 });
      }, 450);
    } catch (error) {
      console.error("create plant failed", error);
    }
  }
});
