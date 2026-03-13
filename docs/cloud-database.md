# 云数据库设计（V1）

## 1. 集合清单

1. `plants`
2. `care_records`
3. `diagnoses`
4. `reminders`
5. `subscribe_tickets`

## 2. plants 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| plant_id | string | 植物业务 ID（云函数生成） |
| user_id | string | 用户 openid |
| plant_name | string | 植物名称 |
| plant_type | string | 植物类型 |
| pot_size | string | 花盆大小 |
| location | string | 摆放位置 |
| acquire_time | string | 入手日期（yyyy-mm-dd） |
| create_time | number | 创建时间戳 |
| update_time | number | 更新时间戳 |

## 3. care_records 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| record_id | string | 记录业务 ID |
| user_id | string | 用户 openid |
| plant_id | string | 植物业务 ID |
| action_type | string | 操作类型：water/fertilize/prune/repot |
| action_time | number | 操作时间戳 |
| note | string | 备注 |
| create_time | number | 创建时间戳 |

## 4. diagnoses 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| diagnosis_id | string | 诊断业务 ID |
| user_id | string | 用户 openid |
| plant_id | string | 植物业务 ID（可空） |
| plant_name | string | 植物名称快照 |
| question | string | 用户问题 |
| image_file_id | string | 图片 fileID |
| ai_result | object | AI返回结构（risk_level/possible_causes/suggestions/cautions） |
| create_time | number | 创建时间戳 |

## 5. 推荐索引

1. `plants`：`user_id + create_time(desc)`
2. `care_records`：`user_id + plant_id + action_time(desc)`
3. `diagnoses`：`user_id + create_time(desc)`
4. `reminders`：`user_id + status + due_date(asc)`
5. `subscribe_tickets`：`user_id + result + used + create_time(desc)`

## 6. reminders 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| reminder_id | string | 提醒业务 ID |
| user_id | string | 用户 openid |
| plant_id | string | 植物业务 ID |
| plant_name | string | 植物名称快照 |
| action_type | string | 提醒动作：water/fertilize/prune/repot |
| title | string | 提醒文案 |
| due_date | number | 到期时间戳 |
| status | string | pending/done |
| priority | string | low/medium/high |
| source | string | daily/postpone/manual |
| done_time | number | 完成时间戳（可空） |
| done_source | string | 完成来源（可空） |
| create_time | number | 创建时间戳 |
| update_time | number | 更新时间戳 |

## 7. 权限建议

V1 建议通过云函数统一读写，数据库权限设置为“仅创建者可读写”或“仅云函数可读写”，避免前端直连误操作。

## 8. subscribe_tickets 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| ticket_id | string | 订阅票据业务 ID |
| user_id | string | 用户 openid |
| template_id | string | 模板 ID |
| result | string | 订阅结果：accept/reject/ban/filter/unknown |
| scene | string | 触发场景（如 reminders_page） |
| used | boolean | 是否已消耗（一次性订阅发送成功后为 true） |
| consume_status | string | pending/sent/failed/invalid |
| reminder_id | string | 关联提醒ID（发送成功时记录，可空） |
| last_error_code | string | 最近发送错误码（可空） |
| last_error_message | string | 最近发送错误信息（可空） |
| used_time | number | 票据消耗时间戳（可空） |
| create_time | number | 创建时间戳 |
| update_time | number | 更新时间戳 |
