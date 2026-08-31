const router = require("express").Router();
const FaturacaoController = require("../controllers/FaturacaoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/exportar", requirePermissao("faturacao", "ver"), FaturacaoController.exportar);
router.get("/", requirePermissao("faturacao", "ver"), FaturacaoController.listar);
router.get("/:id", requirePermissao("faturacao", "ver"), FaturacaoController.buscar);
router.post("/orcamento/:id", requirePermissao("faturacao", "criar"), FaturacaoController.fromOrcamento);
router.post("/", requirePermissao("faturacao", "criar"), FaturacaoController.criar);
router.put("/:id/pagar", requirePermissao("faturacao", "editar"), FaturacaoController.marcarPaga);
router.put("/:id", requirePermissao("faturacao", "editar"), FaturacaoController.atualizar);
router.delete("/:id", requirePermissao("faturacao", "eliminar"), FaturacaoController.remover);

module.exports = router;
