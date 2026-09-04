const router = require("express").Router();
const ProducaoController = require("../controllers/ProducaoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/ordens", requirePermissao("producao", "ver"), ProducaoController.listarOrdens);
router.get("/ordens/:id", requirePermissao("producao", "ver"), ProducaoController.buscarOrdem);
router.post("/ordens", requirePermissao("producao", "criar"), ProducaoController.criarOrdem);
router.put("/ordens/:id", requirePermissao("producao", "editar"), ProducaoController.atualizarOrdem);
router.delete("/ordens/:id", requirePermissao("producao", "eliminar"), ProducaoController.removerOrdem);
router.post("/ordens/:id/requisitar-materiais", requirePermissao("producao", "editar"), ProducaoController.requisitarMateriais);
router.post("/ordens/:id/aprovar-materiais", requirePermissao("producao", "aprovar"), ProducaoController.aprovarMateriais);
router.post("/ordens/:id/libertar-maquina", requirePermissao("producao", "editar"), ProducaoController.libertarParaMaquina);

router.put("/pre-impressao/:ordem_producao_id", requirePermissao("producao", "editar"), ProducaoController.salvarPreImpressao);
router.put("/impressao/:ordem_producao_id", requirePermissao("producao", "editar"), ProducaoController.salvarImpressao);
router.put("/acabamento/:ordem_producao_id", requirePermissao("producao", "editar"), ProducaoController.salvarAcabamento);
router.put("/qualidade/:ordem_producao_id", requirePermissao("producao", "editar"), ProducaoController.salvarQualidade);

module.exports = router;
