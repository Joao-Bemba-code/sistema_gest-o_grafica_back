const router = require("express").Router();
const FaturacaoController = require("../controllers/FaturacaoController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/exportar", FaturacaoController.exportar);
router.get("/", FaturacaoController.listar);
router.get("/:id", FaturacaoController.buscar);
router.post("/orcamento/:id", FaturacaoController.fromOrcamento);
router.post("/", FaturacaoController.criar);
router.put("/:id/pagar", FaturacaoController.marcarPaga);
router.put("/:id", FaturacaoController.atualizar);
router.delete("/:id", FaturacaoController.remover);

module.exports = router;
