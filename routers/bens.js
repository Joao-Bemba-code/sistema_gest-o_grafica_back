const router = require("express").Router();
const BemController = require("../controllers/BemController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("patrimonio", "ver"), BemController.listar);
router.get("/:id", requirePermissao("patrimonio", "ver"), BemController.buscarPorId);
router.post("/", requirePermissao("patrimonio", "criar"), BemController.criar);
router.put("/:id", requirePermissao("patrimonio", "editar"), BemController.atualizar);
router.delete("/:id", requirePermissao("patrimonio", "eliminar"), BemController.remover);

module.exports = router;
