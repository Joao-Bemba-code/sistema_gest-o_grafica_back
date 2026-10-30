const jwt = require("jsonwebtoken");
const { Usuario } = require("../models");
const { estaRevogado } = require("./tokenRevogados");

const COOKIE_SESSAO = "sigraf_token";

// O token chega por cookie HttpOnly (defesa contra XSS) ou, em último
// recurso, pelo cabeçalho Authorization (compat. com sessões antigas e
// ambientes locais onde o browser não envia o cookie entre origens).
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
    const decoded = jwt.verify(token, process.env.SECRET);
    // Só tokens emitidos para a aplicação. O claim `tipo` impede que um token
    // de suporte (outro secret) ou qualquer token futuro sem esta marca seja
    // aceite como sessão de utilizador.
    if (decoded.tipo !== "app") {
      return res.status(401).json({ erro: "Token inválido para esta aplicação" });
    }
    if (estaRevogado(decoded.jti)) {
      return res.status(401).json({ erro: "Sessão terminada. Entre novamente." });
    }
    const usuario = await Usuario.findByPk(decoded.id, { attributes: { exclude: ["senha"] } });
    if (!usuario || !usuario.ativo) {
      return res.status(401).json({ erro: "Usuário inválido ou inativo" });
    }
    // Revogação de sessões: um token emitido antes de uma mudança de senha,
    // email ou permissões deixa de ser aceite.
    if (Number(decoded.tv || 0) !== Number(usuario.token_version || 0)) {
      return res.status(401).json({ erro: "Sessão expirada. Entre novamente." });
    }
    req.usuario = usuario;
    req.organizacao_id = usuario.organizacao_id;
    next();
  } catch (e) {
    return res.status(401).json({ erro: "Token inválido ou expirado" });
  }
};

module.exports.COOKIE_SESSAO = COOKIE_SESSAO;
module.exports.tokenDoPedido = tokenDoPedido;
