const router = require("express").Router();
const MaquinaController = require("../controllers/MaquinaController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", MaquinaController.listar);
router.get("/:id", MaquinaController.buscarPorId);
router.post("/", MaquinaController.criar);
router.put("/:id", MaquinaController.atualizar);
router.delete("/:id", MaquinaController.remover);

module.exports = router;
