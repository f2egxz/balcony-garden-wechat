# 部署检查清单

## 云开发环境

1. 已创建并绑定云开发环境。
2. 已把 `miniprogram/app.js` 中 `envId` 替换为真实环境。
3. 已创建 `plants`、`care_records`、`diagnoses`、`reminders`、`subscribe_tickets` 集合。

## 云函数部署

1. 在微信开发者工具中进入云函数目录。
2. 对 `plant`、`care`、`doctor`、`reminder`、`summary` 逐个执行“上传并部署：云端安装依赖”。
3. 部署后在控制台测试每个函数是否返回 `code: 0`。
4. `reminder` 函数部署后，确认定时触发器已创建（每天08:00自动生成提醒）。

## 前端联调

1. 新增植物成功。
2. 首页看到今日任务。
3. 植物详情可记录浇水/施肥/修剪/换盆。
4. AI植物医生支持文本和图片诊断。
5. 我的阳台可看到统计与建议。
6. 提醒页可看到“逾期/今日/未来”提醒，并支持完成和延后。
7. 在提醒页点击“订阅每日提醒”后，`subscribe_tickets` 集合出现一条订阅票据记录。

## AI外部模型（可选）

1. 为 `doctor` 云函数添加环境变量 `MODEL_API_URL`、`MODEL_API_KEY`。
2. 未配置时默认规则诊断不受影响。

## 订阅消息检查

1. 小程序后台“订阅消息 > 我的模板”中已存在提醒模板，且字段为 `thing1/thing17/thing4/thing12`。
2. `miniprogram/app.js` 的 `subscribeTemplateId` 已替换为真实模板 ID。
3. 定时触发后，在 `subscribe_tickets` 中对应票据应从 `used:false` 变为 `used:true`（发送成功时）。
