const router = require("express").Router();
const OrcamentoController = require("../controllers/OrcamentoController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", OrcamentoController.listar);
router.get("/:id", OrcamentoController.buscarPorId);
router.post("/", OrcamentoController.criar);
router.put("/:id", OrcamentoController.atualizar);
router.delete("/:id", OrcamentoController.remover);

module.exports = router;
