const router = require("express").Router();
const suporteAuth = require("../protect/suporteAuth");
const SuporteController = require("../controllers/SuporteController");

// Login do painel de suporte: público (com rate-limit aplicado no controller).
router.post("/login", SuporteController.login);

// Tudo o resto exige conta de suporte activa (JWT com SECRET_SUPORTE).
router.use(suporteAuth);

router.get("/estado", SuporteController.estado);
router.get("/resumo", SuporteController.resumo);

router.get("/organizacoes", SuporteController.listarOrganizacoes);
router.post("/organizacoes", SuporteController.criarOrganizacao);
router.get("/organizacoes/:id", SuporteController.obterOrganizacao);
router.put("/organizacoes/:id", SuporteController.atualizarOrganizacao);
router.get("/organizacoes/:id/usuarios", SuporteController.listarUsuarios);
router.post("/organizacoes/:id/usuarios", SuporteController.criarUsuario);

router.put("/usuarios/:id", SuporteController.atualizarUsuario);

router.get("/acessos", SuporteController.listarAcessos);

module.exports = router;
