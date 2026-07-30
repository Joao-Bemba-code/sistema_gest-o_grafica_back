const router = require("express").Router();
const CategoriaController = require("../controllers/CategoriaController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", CategoriaController.listar);
router.post("/", CategoriaController.criar);
router.delete("/:id", CategoriaController.remover);

module.exports = router;
