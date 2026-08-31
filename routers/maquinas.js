const router = require("express").Router();
const MaquinaController = require("../controllers/MaquinaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", MaquinaController.listar);
router.get("/:id", MaquinaController.buscarPorId);
router.post("/", requirePermissao("maquinas", "criar"), MaquinaController.criar);
router.put("/:id", requirePermissao("maquinas", "editar"), MaquinaController.atualizar);
router.delete("/:id", requirePermissao("maquinas", "eliminar"), MaquinaController.remover);

module.exports = router;
