const router = require("express").Router();
const FaturacaoController = require("../controllers/FaturacaoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { requireQualquerPermissao } = require("../protect/perm");
const { uploadAnexos } = require("../services/anexosUpload");

router.use(auth);

// Validação na Tesouraria: faturas em análise passam a emitidas.
const VALIDAR = requireQualquerPermissao([["tesouraria", "editar"], ["financeiro", "editar"], ["faturacao", "editar"]]);

router.get("/agt/config", requirePermissao("faturacao", "ver"), FaturacaoController.agtConfig);
router.get("/agt/series", requirePermissao("faturacao", "ver"), FaturacaoController.listarSeries);
router.post("/agt/serie", requirePermissao("faturacao", "criar"), FaturacaoController.solicitarSerie);
router.post("/agt/consultar/:id", requirePermissao("faturacao", "ver"), FaturacaoController.consultarEstado);
router.post("/agt/enviar/:id", requirePermissao("faturacao", "criar"), FaturacaoController.enviarAGT);

router.get("/exportar", requirePermissao("faturacao", "ver"), FaturacaoController.exportar);
// A página de Relatórios agrega faturas sem exigir acesso ao módulo de
// Faturação: quem pode ver relatórios pode ler esta lista.
router.get("/", requirePermissao.requireQualquerPermissao([["faturacao", "ver"], ["relatorios", "ver"]]), FaturacaoController.listar);
// Download de anexo ANTES do GET /:id para "anexos" não ser capturado como id
router.get("/anexos/:anexoId", requirePermissao("faturacao", "ver"), FaturacaoController.downloadAnexo);
router.get("/:id", requirePermissao("faturacao", "ver"), FaturacaoController.buscar);
router.post("/orcamento/:id", requirePermissao("faturacao", "criar"), FaturacaoController.fromOrcamento);
router.post("/", requirePermissao("faturacao", "criar"), FaturacaoController.criar);
router.put("/:id/validar", VALIDAR, FaturacaoController.validar);
router.put("/:id/pagar", requirePermissao("faturacao", "editar"), FaturacaoController.marcarPaga);
router.put("/:id", requirePermissao("faturacao", "editar"), FaturacaoController.atualizar);
// Anexos: a rota de eliminar fica ANTES do POST /:id para não ser capturada
router.post("/:id/anexos", requirePermissao("faturacao", "editar"), uploadAnexos, FaturacaoController.anexarFicheiros);
router.delete("/anexos/:anexoId", requirePermissao("faturacao", "editar"), FaturacaoController.removerAnexo);
router.post("/:id/anular", requirePermissao("faturacao", "editar"), FaturacaoController.anular);

module.exports = router;