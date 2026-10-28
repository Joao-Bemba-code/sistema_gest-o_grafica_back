const router = require("express").Router();
const MaterialController = require("../controllers/MaterialController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("estoque", "ver"), MaterialController.listar);
router.get("/formatos", requirePermissao("estoque", "ver"), MaterialController.formatos);
router.get("/extrato", requirePermissao("estoque", "ver"), MaterialController.extrato);
router.get("/reservas", requirePermissao("estoque", "ver"), MaterialController.listarReservas);
router.post("/converter", requirePermissao("estoque", "editar"), MaterialController.converter);
router.post("/movimentar", requirePermissao("estoque", "editar"), MaterialController.movimentar);
router.post("/reservar", requirePermissao("estoque", "editar"), MaterialController.reservar);
router.post("/baixar", requirePermissao("estoque", "editar"), MaterialController.baixar);
router.delete("/reservas/:id", requirePermissao("estoque", "eliminar"), MaterialController.cancelarReserva);
router.get("/:id", requirePermissao("estoque", "ver"), MaterialController.buscarPorId);
router.post("/", requirePermissao("estoque", "criar"), MaterialController.criar);
router.put("/:id", requirePermissao("estoque", "editar"), MaterialController.atualizar);
router.delete("/:id", requirePermissao("estoque", "eliminar"), MaterialController.remover);

module.exports = router;
