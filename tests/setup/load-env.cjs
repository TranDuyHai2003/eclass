// Đọc file .env (không ghi đè biến đã có). Hỗ trợ giá trị trong nháy và ghi chú cuối dòng: KEY="giá trị" # ghi chú
const fs = require("fs");

function parseValue(raw) {
  const v = raw.trim();
  const quoted = v.match(/^(["'])(.*?)\1/);
  if (quoted) return quoted[2];
  return v.replace(/\s+#.*$/, "").trim();
}

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = parseValue(m[2]);
  }
}

module.exports = { loadEnv, parseValue };
