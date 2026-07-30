const router = require("express").Router();
const FornecedorController = require("../controllers/FornecedorController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", FornecedorController.listar);
router.post("/", FornecedorController.criar);
router.delete("/:id", FornecedorController.remover);

module.exports = router;