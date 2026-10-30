const router = require("express").Router();
const PropostaController = require("../controllers/PropostaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { uploadAnexos } = require("../services/anexosUpload");

router.use(auth);

router.get("/unidades", requirePermissao("comercial", "ver"), PropostaController.unidades);
// Documentos (anexos) da proposta. Ficam antes de "/:id" para "documentos"
// não ser interpretado como id. Um documento nunca é eliminado — só anulado.
router.get("/documentos/:docId", requirePermissao("comercial", "ver"), PropostaController.abrirDocumento);
router.patch("/documentos/:docId/anular", requirePermissao("comercial", "editar"), PropostaController.anularDocumento);
router.get("/:id/documentos", requirePermissao("comercial", "ver"), PropostaController.listarDocumentos);
router.post("/:id/documentos", requirePermissao.requireQualquerPermissao([["comercial", "editar"], ["comercial", "criar"]]), uploadAnexos, PropostaController.anexarDocumentos);
router.get("/", requirePermissao("comercial", "ver"), PropostaController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), PropostaController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), PropostaController.criar);
router.put("/:id/estado", requirePermissao("comercial", "editar"), PropostaController.mudarEstado);
router.put("/:id/orcamento", requirePermissao("comercial", "editar"), PropostaController.vincularOrcamento);
router.put("/:id", requirePermissao("comercial", "editar"), PropostaController.atualizar);
// Propostas não são eliminadas: apenas anuladas, com motivo obrigatório.
router.post("/:id/anular", requirePermissao("comercial", "editar"), PropostaController.anular);

module.exports = router;
