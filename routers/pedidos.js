const router = require("express").Router();
const PedidoController = require("../controllers/PedidoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("estoque", "ver"), PedidoController.listar);
router.post("/", requirePermissao("estoque", "criar"), PedidoController.criar);
router.get("/:id", requirePermissao("estoque", "ver"), PedidoController.buscarPorId);
router.post("/:id/cancelar", requirePermissao("estoque", "editar"), PedidoController.cancelar);
router.post("/:id/receber", requirePermissao("estoque", "editar"), PedidoController.receber);

module.exports = router;
