function pad(n) {
  return String(n).padStart(2, "0");
}

function formatDateTime(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(ts) {
  if (!ts) return "-";
  const d = new Date(ts);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function daysAgo(ts) {
  if (!ts) return "暂无";
  const diff = Date.now() - ts;
  const day = Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
  if (day === 0) return "今天";
  if (day === 1) return "1天前";
  return `${day}天前`;
}

module.exports = {
  formatDateTime,
  formatDate,
  daysAgo
};
