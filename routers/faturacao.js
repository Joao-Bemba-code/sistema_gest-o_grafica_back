const router = require("express").Router();
const FaturacaoController = require("../controllers/FaturacaoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/agt/config", requirePermissao("faturacao", "ver"), FaturacaoController.agtConfig);
router.get("/agt/series", requirePermissao("faturacao", "ver"), FaturacaoController.listarSeries);
router.post("/agt/serie", requirePermissao("faturacao", "criar"), FaturacaoController.solicitarSerie);
router.post("/agt/consultar/:id", requirePermissao("faturacao", "ver"), FaturacaoController.consultarEstado);
router.post("/agt/enviar/:id", requirePermissao("faturacao", "criar"), FaturacaoController.enviarAGT);

router.get("/exportar", requirePermissao("faturacao", "ver"), FaturacaoController.exportar);
// A página de Relatórios agrega faturas sem exigir acesso ao módulo de
// Faturação: quem pode ver relatórios pode ler esta lista.
router.get("/", requirePermissao.requireQualquerPermissao([["faturacao", "ver"], ["relatorios", "ver"]]), FaturacaoController.listar);
router.get("/:id", requirePermissao("faturacao", "ver"), FaturacaoController.buscar);
router.post("/orcamento/:id", requirePermissao("faturacao", "criar"), FaturacaoController.fromOrcamento);
router.post("/", requirePermissao("faturacao", "criar"), FaturacaoController.criar);
router.put("/:id/pagar", requirePermissao("faturacao", "editar"), FaturacaoController.marcarPaga);
router.put("/:id", requirePermissao("faturacao", "editar"), FaturacaoController.atualizar);
router.delete("/:id", requirePermissao("faturacao", "eliminar"), FaturacaoController.remover);

module.exports = router;
