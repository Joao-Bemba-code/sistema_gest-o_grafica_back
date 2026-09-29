const { pode } = require("../services/permissoes");

// Middleware de autorização baseado em papéis/permissões.
// Uso: router.get("/", auth, requirePermissao("comercial", "ver"), controller)
function requirePermissao(modulo, acao) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: "Não autenticado" });
    if (!pode(req.usuario, modulo, acao)) {
      return res.status(403).json({ erro: "Acesso negado: não tem permissão para esta ação." });
    }
    next();
  };
}

// Permite o acesso quando o utilizador tiver pelo menos uma das permissões.
// Uso: requireQualquerPermissao([["producao", "ver"], ["estoque", "ver"]])
function requireQualquerPermissao(pares) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: "Não autenticado" });
    const autorizado = (pares || []).some(([modulo, acao]) => pode(req.usuario, modulo, acao));
    if (!autorizado) {
      return res.status(403).json({ erro: "Acesso negado: não tem permissão para esta ação." });
    }
    next();
  };
}

module.exports = requirePermissao;
module.exports.requireQualquerPermissao = requireQualquerPermissao;
