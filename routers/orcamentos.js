const router = require("express").Router();
const OrcamentoController = require("../controllers/OrcamentoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("comercial", "ver"), OrcamentoController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), OrcamentoController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), OrcamentoController.criar);
router.put("/:id", requirePermissao("comercial", "editar"), OrcamentoController.atualizar);
router.delete("/:id", requirePermissao("comercial", "eliminar"), OrcamentoController.remover);

module.exports = router;
