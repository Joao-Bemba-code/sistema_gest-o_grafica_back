const router = require("express").Router();
const CategoriaController = require("../controllers/CategoriaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("categorias", "ver"), CategoriaController.listar);
router.post("/", requirePermissao("categorias", "criar"), CategoriaController.criar);
router.put("/:id", requirePermissao("categorias", "editar"), CategoriaController.atualizar);
router.delete("/:id", requirePermissao("categorias", "eliminar"), CategoriaController.remover);

module.exports = router;
