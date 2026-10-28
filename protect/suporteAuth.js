const jwt = require("jsonwebtoken");
const { SuporteUsuario } = require("../models");

const COOKIE_SESSAO = "sigraf_suporte_token";

// Autenticação exclusiva do painel de suporte.
// Só aceita tokens assinados com SECRET_SUPORTE e com tipo "suporte".
// Tokens normais do SIGRAF (assinados com SECRET) falham aqui, e tokens
// de suporte falham no middleware normal do SIGRAF (protect/auth.js),
// porque os secrets são diferentes.
// O token chega por cookie HttpOnly (defesa contra XSS) ou, em último
// recurso, pelo cabeçalho Authorization (compat. com sessões antigas).
function tokenDoPedido(req) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) return header.split(" ")[1];
  const bruto = req.headers.cookie;
  if (!bruto) return null;
  for (const parte of bruto.split(";")) {
    const [nome, ...resto] = parte.trim().split("=");
    if (nome === COOKIE_SESSAO) return decodeURIComponent(resto.join("="));
  }
  return null;
}

module.exports = async (req, res, next) => {
  const token = tokenDoPedido(req);
  if (!token) {
    return res.status(401).json({ erro: "Sessão não fornecida" });
  }
  try {
    const decoded = jwt.verify(token, process.env.SECRET_SUPORTE);
    if (decoded.tipo !== "suporte") {
      return res.status(401).json({ erro: "Token inválido para o painel de suporte" });
    }
    const usuario = await SuporteUsuario.findByPk(decoded.id);
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: "Conta de suporte inválida ou inativa" });
    }
    req.suporte = usuario;
    next();
  } catch (e) {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
};

module.exports.COOKIE_SESSAO = COOKIE_SESSAO;
