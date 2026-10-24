const router = require("express").Router();
const Controller = require("../controllers/CaixaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { requireQualquerPermissao } = require("../protect/perm");

router.use(auth);

const VER_CAIXA = requireQualquerPermissao([["tesouraria", "ver"], ["financeiro", "ver"]]);

router.get("/", VER_CAIXA, Controller.listar);
router.post("/", requirePermissao("tesouraria", "criar"), Controller.abrir);
router.post("/:id/fechar", requirePermissao("tesouraria", "editar"), Controller.fechar);

module.exports = router;
