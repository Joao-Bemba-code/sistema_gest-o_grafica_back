const router = require("express").Router();
const Controller = require("../controllers/TesourariaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { requireQualquerPermissao } = require("../protect/perm");
const { uploadAnexos } = require("../services/anexosUpload");

router.use(auth);

// Leitura partilhada: quem tem o módulo Financeiro também consulta os movimentos
// (a página /financeiro analisa receitas e despesas com base na tesouraria).
const VER_MOVIMENTOS = requireQualquerPermissao([["tesouraria", "ver"], ["financeiro", "ver"]]);

router.get("/exportar", requirePermissao("tesouraria", "ver"), Controller.exportar);
router.get("/resumo", VER_MOVIMENTOS, Controller.resumo);
// Download de anexo ANTES do GET /:id para "anexos" não ser capturado como id
router.get("/anexos/:anexoId", requirePermissao("tesouraria", "ver"), Controller.downloadAnexo);
router.get("/", VER_MOVIMENTOS, Controller.listar);
router.get("/:id", VER_MOVIMENTOS, Controller.buscar);
router.post("/conciliar", requirePermissao("tesouraria", "editar"), Controller.conciliar);
router.post("/", requirePermissao("tesouraria", "criar"), Controller.criar);
router.put("/:id", requirePermissao("tesouraria", "editar"), Controller.atualizar);
// Anexos: a rota de eliminar fica ANTES do DELETE /:id para não ser capturada por ele
router.post("/:id/anexos", requirePermissao("tesouraria", "editar"), uploadAnexos, Controller.anexarFicheiros);
router.delete("/anexos/:anexoId", requirePermissao("tesouraria", "editar"), Controller.removerAnexo);
router.post("/:id/anular", requirePermissao("tesouraria", "editar"), Controller.anular);

module.exports = router;
