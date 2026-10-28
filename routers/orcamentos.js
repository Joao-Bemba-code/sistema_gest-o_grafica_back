const router = require("express").Router();
const OrcamentoController = require("../controllers/OrcamentoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("comercial", "ver"), OrcamentoController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), OrcamentoController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), OrcamentoController.criar);
router.post("/:id/enviar-producao", requirePermissao("comercial", "editar"), OrcamentoController.enviarProducao);
router.put("/:id", requirePermissao("comercial", "editar"), OrcamentoController.atualizar);
// Orçamentos não são eliminados: apenas anulados, com motivo obrigatório.
router.post("/:id/anular", requirePermissao("comercial", "editar"), OrcamentoController.anular);

module.exports = router;
