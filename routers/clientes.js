const router = require("express").Router();
const ClienteController = require("../controllers/ClienteController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("comercial", "ver"), ClienteController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), ClienteController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), ClienteController.criar);
router.put("/:id", requirePermissao("comercial", "editar"), ClienteController.atualizar);
router.delete("/:id", requirePermissao("comercial", "eliminar"), ClienteController.remover);

module.exports = router;
