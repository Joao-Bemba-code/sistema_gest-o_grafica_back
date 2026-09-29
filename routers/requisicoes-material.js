const router = require("express").Router();
const RequisicaoMaterialController = require("../controllers/RequisicaoMaterialController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { requireQualquerPermissao } = require("../protect/perm");

router.use(auth);

router.get("/", requireQualquerPermissao([["producao", "ver"], ["estoque", "ver"]]), RequisicaoMaterialController.listar);
router.get("/auxiliares", requirePermissao("producao", "ver"), RequisicaoMaterialController.auxiliares);
router.post("/", requirePermissao("producao", "criar"), RequisicaoMaterialController.criar);
router.post("/:id/aprovar", requirePermissao("estoque", "editar"), RequisicaoMaterialController.aprovar);
router.post("/:id/rejeitar", requirePermissao("estoque", "editar"), RequisicaoMaterialController.rejeitar);
router.post("/:id/cancelar", requirePermissao("producao", "editar"), RequisicaoMaterialController.cancelar);

module.exports = router;
