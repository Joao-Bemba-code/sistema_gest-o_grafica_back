const router = require("express").Router();
const FornecedorController = require("../controllers/FornecedorController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/", requirePermissao("estoque", "ver"), FornecedorController.listar);
router.post("/", requirePermissao("estoque", "criar"), FornecedorController.criar);
router.delete("/:id", requirePermissao("estoque", "eliminar"), FornecedorController.remover);

module.exports = router;