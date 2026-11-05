const router = require("express").Router();
const OrcamentoController = require("../controllers/OrcamentoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

// Ler orçamentos: além do Comercial, a Produção precisa da lista para ver as
// encomendas aprovadas e criar as OPs. Escrever continua só no Comercial.
const ORCAMENTOS_LENDER = requirePermissao.requireQualquerPermissao([["comercial", "ver"], ["producao", "ver"]]);

router.get("/", ORCAMENTOS_LENDER, OrcamentoController.listar);
router.get("/:id", ORCAMENTOS_LENDER, OrcamentoController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), OrcamentoController.criar);
router.post("/:id/enviar-producao", requirePermissao("comercial", "editar"), OrcamentoController.enviarProducao);
router.put("/:id", requirePermissao("comercial", "editar"), OrcamentoController.atualizar);
// Orçamentos não são eliminados: apenas anulados, com motivo obrigatório.
router.post("/:id/anular", requirePermissao("comercial", "editar"), OrcamentoController.anular);

module.exports = router;
