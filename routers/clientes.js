const router = require("express").Router();
const ClienteController = require("../controllers/ClienteController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { uploadAnexos } = require("../services/anexosUpload");

router.use(auth);

// Documentos do cliente. Ficam antes de "/:id" para "documentos" não ser
// interpretado como id. Um documento nunca é eliminado — só anulado.
// O mesmo endpoint serve os fornecedores do módulo Compras.
const podeVer = requirePermissao.requireQualquerPermissao([["comercial", "ver"], ["compras", "ver"]]);
const podeEditar = requirePermissao.requireQualquerPermissao([
  ["comercial", "editar"],
  ["comercial", "criar"],
  ["compras", "editar"],
  ["compras", "criar"],
]);
router.get("/documentos/:docId", podeVer, ClienteController.abrirDocumento);
router.patch(
  "/documentos/:docId/anular",
  requirePermissao.requireQualquerPermissao([["comercial", "editar"], ["compras", "editar"]]),
  ClienteController.anularDocumento
);
router.get("/:id/documentos", podeVer, ClienteController.listarDocumentos);
router.post("/:id/documentos", podeEditar, uploadAnexos, ClienteController.anexarDocumentos);
// Histórico de auditoria do cliente (quem criou, alterou, anulou, etc.).
router.get("/:id/historico", podeVer, ClienteController.historico);

// A página de Relatórios usa os clientes sem exigir acesso ao módulo
// Comercial: quem pode ver relatórios pode ler esta lista.
router.get("/", requirePermissao.requireQualquerPermissao([["comercial", "ver"], ["relatorios", "ver"]]), ClienteController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), ClienteController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), ClienteController.criar);
router.put("/:id", requirePermissao("comercial", "editar"), ClienteController.atualizar);
// Clientes não são eliminados: apenas anulados, com motivo obrigatório.
router.post("/:id/anular", requirePermissao("comercial", "editar"), ClienteController.anular);

module.exports = router;
