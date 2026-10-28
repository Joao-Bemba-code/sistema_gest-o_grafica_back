const router = require("express").Router();
const suporteAuth = require("../protect/suporteAuth");
const loginLimit = require("../protect/loginLimit");
const SuporteController = require("../controllers/SuporteController");

// Login do painel de suporte: público, com bloqueio por IP. Sem este middleware
// o controller registava falhas numa chave inexistente e não havia bloqueio.
router.post("/login", loginLimit.bloquear, SuporteController.login);

// Tudo o resto exige conta de suporte activa (JWT com SECRET_SUPORTE).
router.use(suporteAuth);

router.get("/estado", SuporteController.estado);
router.post("/logout", SuporteController.logout);
router.get("/resumo", SuporteController.resumo);

router.get("/totp/estado", SuporteController.totpEstado);
router.post("/totp/gerar", SuporteController.totpGerar);
router.post("/totp/confirmar", SuporteController.totpConfirmar);
router.post("/totp/desactivar", SuporteController.totpDesactivar);

router.get("/organizacoes", SuporteController.listarOrganizacoes);
router.post("/organizacoes", SuporteController.criarOrganizacao);
router.get("/organizacoes/:id", SuporteController.obterOrganizacao);
router.put("/organizacoes/:id", SuporteController.atualizarOrganizacao);
router.get("/organizacoes/:id/usuarios", SuporteController.listarUsuarios);
router.post("/organizacoes/:id/usuarios", SuporteController.criarUsuario);

router.put("/usuarios/:id", SuporteController.atualizarUsuario);

router.get("/acessos", SuporteController.listarAcessos);
router.get("/auditoria", SuporteController.listarAuditoria);

module.exports = router;
