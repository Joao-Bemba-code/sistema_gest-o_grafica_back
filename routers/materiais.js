const router = require("express").Router();
const MaterialController = require("../controllers/MaterialController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", MaterialController.listar);
router.get("/formatos", MaterialController.formatos);
router.get("/extrato", MaterialController.extrato);
router.get("/reservas", MaterialController.listarReservas);
router.post("/converter", MaterialController.converter);
router.post("/movimentar", MaterialController.movimentar);
router.post("/reservar", MaterialController.reservar);
router.post("/baixar", MaterialController.baixar);
router.delete("/reservas/:id", MaterialController.cancelarReserva);
router.get("/:id", MaterialController.buscarPorId);
router.post("/", MaterialController.criar);
router.put("/:id", MaterialController.atualizar);
router.delete("/:id", MaterialController.remover);

module.exports = router;
