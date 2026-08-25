const router = require("express").Router();
const ServicoController = require("../controllers/ServicoController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", ServicoController.listar);
router.post("/", ServicoController.criar);
router.put("/:id", ServicoController.atualizar);
router.delete("/:id", ServicoController.remover);

module.exports = router;
