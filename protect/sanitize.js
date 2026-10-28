const xss = require("xss");

function sanitizeValue(val) {
  if (typeof val === "string") return xss(val.trim());
  if (Array.isArray(val)) return val.map(sanitizeValue);
  if (val && typeof val === "object") return sanitizeObject(val);
  return val;
}

// Campos que NÃO podem ser passados pelo xss(): senhas (seriam alteradas e a
// autenticação falhava) e o template de contrato, que é HTML legítimo.
const CAMPOS_PRESERVADOS = new Set([
  "senha",
  "password",
  "senha_atual",
  "nova_senha",
  "currentPassword",
  "newPassword",
  "template_contrato",
]);

function sanitizeObject(obj) {
  const clean = {};
  for (const [k, v] of Object.entries(obj)) {
    clean[k] = CAMPOS_PRESERVADOS.has(k) ? v : sanitizeValue(v);
  }
  return clean;
}

module.exports = (req, res, next) => {
  if (req.body) req.body = sanitizeObject(req.body);
  if (req.query) {
    for (const [k, v] of Object.entries(req.query)) {
      req.query[k] = typeof v === "string" ? xss(v.trim()) : v;
    }
  }
  if (req.params) {
    for (const [k, v] of Object.entries(req.params)) {
      req.params[k] = typeof v === "string" ? xss(v.trim()) : v;
    }
  }
  next();
};
