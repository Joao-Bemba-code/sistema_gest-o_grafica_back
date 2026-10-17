const router = require("express").Router();
const RequisicaoMaterialController = require("../controllers/RequisicaoMaterialController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { requireQualquerPermissao } = require("../protect/perm");

router.use(auth);

// Requisições de material são criadas pela Produção e processadas pelo
// Estoque; o módulo de Compras também as acompanha.
router.get("/", requireQualquerPermissao([["producao", "ver"], ["estoque", "ver"], ["compras", "ver"]]), RequisicaoMaterialController.listar);
router.get("/auxiliares", requireQualquerPermissao([["producao", "ver"], ["compras", "ver"]]), RequisicaoMaterialController.auxiliares);
router.post("/", requireQualquerPermissao([["producao", "criar"], ["compras", "criar"]]), RequisicaoMaterialController.criar);
router.post("/:id/aprovar", requireQualquerPermissao([["estoque", "editar"], ["compras", "editar"]]), RequisicaoMaterialController.aprovar);
router.post("/:id/rejeitar", requireQualquerPermissao([["estoque", "editar"], ["compras", "editar"]]), RequisicaoMaterialController.rejeitar);
router.post("/:id/cancelar", requirePermissao("producao", "editar"), RequisicaoMaterialController.cancelar);
router.post("/:id/devolver", requireQualquerPermissao([["producao", "editar"], ["estoque", "editar"], ["compras", "editar"]]), RequisicaoMaterialController.devolver);

module.exports = router;
