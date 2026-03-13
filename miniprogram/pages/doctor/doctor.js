const api = require("../../utils/api");
const { formatDateTime } = require("../../utils/format");

Page({
  data: {
    plants: [],
    selectedPlantIndex: -1,
    selectedPlantId: "",
    question: "",
    localImagePath: "",
    imageFileID: "",
    diagnosis: null,
    history: []
  },

  onLoad(options) {
    const plantId = options.plant_id || wx.getStorageSync("doctor_selected_plant_id") || "";
    if (plantId) {
      this.setData({ selectedPlantId: plantId });
      wx.removeStorageSync("doctor_selected_plant_id");
    }
  },

  onShow() {
    const pendingPlantId = wx.getStorageSync("doctor_selected_plant_id");
    if (pendingPlantId) {
      this.setData({ selectedPlantId: pendingPlantId });
      wx.removeStorageSync("doctor_selected_plant_id");
    }
    this.loadData();
  },

  async loadData() {
    try {
      const [plants, history] = await Promise.all([api.listPlants(), api.getDiagnosisHistory()]);
      const selectedIndex = plants.findIndex((item) => item.plant_id === this.data.selectedPlantId);

      this.setData({
        plants,
        selectedPlantIndex: selectedIndex,
        history: (history || []).map((item) => ({
          ...item,
          time_text: formatDateTime(item.create_time)
        }))
      });
    } catch (error) {
      console.error("doctor load failed", error);
    }
  },

  onPlantChange(e) {
    const idx = Number(e.detail.value);
    const plant = this.data.plants[idx];
    this.setData({
      selectedPlantIndex: idx,
      selectedPlantId: plant ? plant.plant_id : ""
    });
  },

  onQuestionInput(e) {
    this.setData({ question: e.detail.value.trim() });
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      success: async (res) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) return;

        try {
          wx.showLoading({ title: "上传图片", mask: true });
          const cloudPath = `doctor/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const uploadRes = await wx.cloud.uploadFile({
            cloudPath,
            filePath: file.tempFilePath
          });
          this.setData({
            localImagePath: file.tempFilePath,
            imageFileID: uploadRes.fileID
          });
        } catch (error) {
          wx.showToast({ title: "上传失败", icon: "none" });
          console.error("upload failed", error);
        } finally {
          wx.hideLoading();
        }
      }
    });
  },

  async submitDiagnosis() {
    const { question, imageFileID, selectedPlantId } = this.data;

    if (!question && !imageFileID) {
      wx.showToast({ title: "请填写问题或上传图片", icon: "none" });
      return;
    }

    try {
      const diagnosis = await api.diagnose({
        plant_id: selectedPlantId,
        question,
        image_file_id: imageFileID
      });
      this.setData({ diagnosis });
      this.loadData();
    } catch (error) {
      console.error("diagnose failed", error);
    }
  }
});
