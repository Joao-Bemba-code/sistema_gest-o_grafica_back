const router = require("express").Router();
const PropostaController = require("../controllers/PropostaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/unidades", requirePermissao("comercial", "ver"), PropostaController.unidades);
router.get("/", requirePermissao("comercial", "ver"), PropostaController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), PropostaController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), PropostaController.criar);
router.put("/:id/estado", requirePermissao("comercial", "editar"), PropostaController.mudarEstado);
router.put("/:id/orcamento", requirePermissao("comercial", "editar"), PropostaController.vincularOrcamento);
router.put("/:id", requirePermissao("comercial", "editar"), PropostaController.atualizar);
// Propostas não são eliminadas: apenas anuladas, com motivo obrigatório.
router.post("/:id/anular", requirePermissao("comercial", "editar"), PropostaController.anular);

module.exports = router;
