const router = require("express").Router();
const PedidoController = require("../controllers/PedidoController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", PedidoController.listar);
router.post("/", PedidoController.criar);
router.get("/:id", PedidoController.buscarPorId);
router.post("/:id/enviar-email", PedidoController.enviarEmail);
router.post("/:id/cancelar", PedidoController.cancelar);
router.post("/:id/receber", PedidoController.receber);

module.exports = router;
