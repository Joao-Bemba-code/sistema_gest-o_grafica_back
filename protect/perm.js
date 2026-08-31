const { pode } = require("../services/permissoes");

// Middleware de autorização baseado em papéis/permissões.
// Uso: router.get("/", auth, requirePermissao("comercial", "ver"), controller)
module.exports = function requirePermissao(modulo, acao) {
  return (req, res, next) => {
    if (!req.usuario) return res.status(401).json({ erro: "Não autenticado" });
    if (!pode(req.usuario, modulo, acao)) {
      return res.status(403).json({ erro: "Acesso negado: não tem permissão para esta ação." });
    }
    next();
  };
};
