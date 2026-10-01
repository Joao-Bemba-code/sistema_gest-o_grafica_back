const router = require("express").Router();
const Controller = require("../controllers/TesourariaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { uploadAnexos } = require("../services/anexosUpload");

router.use(auth);

router.get("/exportar", requirePermissao("tesouraria", "ver"), Controller.exportar);
router.get("/resumo", requirePermissao("tesouraria", "ver"), Controller.resumo);
// Download de anexo ANTES do GET /:id para "anexos" não ser capturado como id
router.get("/anexos/:anexoId", requirePermissao("tesouraria", "ver"), Controller.downloadAnexo);
router.get("/", requirePermissao("tesouraria", "ver"), Controller.listar);
router.get("/:id", requirePermissao("tesouraria", "ver"), Controller.buscar);
router.post("/", requirePermissao("tesouraria", "criar"), Controller.criar);
router.put("/:id", requirePermissao("tesouraria", "editar"), Controller.atualizar);
// Anexos: a rota de eliminar fica ANTES do DELETE /:id para não ser capturada por ele
router.post("/:id/anexos", requirePermissao("tesouraria", "editar"), uploadAnexos, Controller.anexarFicheiros);
router.delete("/anexos/:anexoId", requirePermissao("tesouraria", "editar"), Controller.removerAnexo);
router.delete("/:id", requirePermissao("tesouraria", "eliminar"), Controller.remover);

module.exports = router;
