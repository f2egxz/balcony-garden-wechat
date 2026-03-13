# 阳台花园管家（微信小程序 + 云开发）

基于你的 PRD（V1.0）实现的完整项目骨架：
- 前端：微信小程序原生框架
- 后端：微信云开发云函数
- 数据：微信云数据库（`plants`、`care_records`、`diagnoses`、`reminders`）

## 1. 已实现功能

1. 首页（今日任务 + 快速记录）
2. 我的植物（列表 + 新增 + 详情）
3. 植物详情（养护时间线 + 快捷记录）
4. AI植物医生（文本 + 图片上传 + 诊断历史）
5. 我的阳台（植物统计 + AI建议 + 重点关注）
6. 提醒中心（逾期/今日/未来提醒 + 完成/延后 + 自动闭环）

## 2. 项目结构

```text
balcony-garden-wechat/
├── miniprogram/
│   ├── app.js
│   ├── app.json
│   ├── app.wxss
│   ├── utils/
│   │   ├── api.js
│   │   └── format.js
│   └── pages/
│       ├── index/
│       ├── plants/
│       ├── add-plant/
│       ├── plant-detail/
│       ├── doctor/
│       ├── reminders/
│       └── balcony/
├── cloudfunctions/
│   ├── plant/
│   ├── care/
│   ├── doctor/
│   ├── reminder/
│   └── summary/
└── docs/
    ├── cloud-database.md
    └── deploy-checklist.md
```

## 3. 本地接入步骤

1. 微信开发者工具导入项目根目录：`balcony-garden-wechat`。
2. 在微信开发者工具中开通并关联云开发环境。
3. 修改 `miniprogram/app.js` 的 `envId` 为你的云环境 ID。
4. 按 [cloud-database.md](docs/cloud-database.md) 创建集合。
5. 在开发者工具中分别部署云函数：`plant`、`care`、`doctor`、`reminder`、`summary`。
6. 运行小程序，先新增植物，再验证记录和诊断流程。

## 4. AI能力说明

`doctor` 云函数支持两种模式：
1. 默认规则引擎（即开即用，无需额外 API）
2. 外部大模型（可选）

如需外部大模型，在 `doctor` 云函数环境变量配置：
- `MODEL_API_URL`
- `MODEL_API_KEY`
- `MODEL_NAME`（可选，默认 `gpt-4.1-mini`）

若未配置或调用失败，会自动降级为本地规则诊断，保证功能可用。

## 5. V1 后续建议

1. 给 `reminders` 增加 `user_id + status + due_date` 复合索引，提升提醒页查询速度。
2. 在提醒页增加“批量完成”和“批量延后”。
3. 把 AI 高风险诊断自动升级为高优先提醒。

## 6. 提醒闭环说明

1. `reminder` 云函数会根据最近养护记录自动生成每日提醒。
2. 提醒页点击“完成”会同时写入 `care_records`，并将提醒状态更新为 `done`。
3. 从首页/详情页记录浇水或施肥时，会自动关闭已到期同类提醒。
4. `cloudfunctions/reminder/config.json` 已提供定时触发器（每天 08:00）配置，部署函数后即可启用。
5. 一次性订阅消息：用户在提醒页授权后会写入 `subscribe_tickets`，定时任务会自动选择可用票据发送模板消息并消耗该票据。
