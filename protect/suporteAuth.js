const jwt = require("jsonwebtoken");
const { SuporteUsuario } = require("../models");

// Autenticação exclusiva do painel de suporte.
// Só aceita tokens assinados com SECRET_SUPORTE e com tipo "suporte".
// Tokens normais do SIGRAF (assinados com SECRET) falham aqui, e tokens
// de suporte falham no middleware normal do SIGRAF (protect/auth.js),
// porque os secrets são diferentes.
module.exports = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ erro: "Token não fornecido" });
  }
  try {
    const token = header.split(" ")[1];
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
