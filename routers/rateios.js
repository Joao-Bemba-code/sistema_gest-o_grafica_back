const router = require("express").Router();
const Controller = require("../controllers/RateioController");
const auth = require("../protect/auth");
const { requireQualquerPermissao } = require("../protect/perm");

router.use(auth);

const VER_RATEIOS = requireQualquerPermissao([
  ["faturacao", "ver"],
  ["tesouraria", "ver"],
  ["financeiro", "ver"],
]);

const EDITAR_RATEIOS = requireQualquerPermissao([
  ["faturacao", "editar"],
  ["tesouraria", "editar"],
  ["financeiro", "editar"],
]);

router.get("/", VER_RATEIOS, Controller.listar);
router.post("/", EDITAR_RATEIOS, Controller.salvar);

module.exports = router;
