const router = require("express").Router();
const NotificacaoController = require("../controllers/NotificacaoController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/", NotificacaoController.listar);
router.put("/:id/lida", NotificacaoController.marcarLida);
router.put("/ler-todas", NotificacaoController.marcarTodasLidas);

module.exports = router;
