const router = require("express").Router();
const ClienteController = require("../controllers/ClienteController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", ClienteController.listar);
router.get("/:id", ClienteController.buscarPorId);
router.post("/", ClienteController.criar);
router.put("/:id", ClienteController.atualizar);
router.delete("/:id", ClienteController.remover);

module.exports = router;
