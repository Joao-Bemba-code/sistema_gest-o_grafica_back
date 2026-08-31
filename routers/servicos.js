const router = require("express").Router();
const ServicoController = require("../controllers/ServicoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("categorias", "ver"), ServicoController.listar);
router.post("/", requirePermissao("categorias", "criar"), ServicoController.criar);
router.put("/:id", requirePermissao("categorias", "editar"), ServicoController.atualizar);
router.delete("/:id", requirePermissao("categorias", "eliminar"), ServicoController.remover);

module.exports = router;
