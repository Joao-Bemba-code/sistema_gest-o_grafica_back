const router = require("express").Router();
const ProducaoController = require("../controllers/ProducaoController");
const auth = require("../protect/auth");

router.use(auth);

router.get("/ordens", ProducaoController.listarOrdens);
router.get("/ordens/:id", ProducaoController.buscarOrdem);
router.post("/ordens", ProducaoController.criarOrdem);
router.put("/ordens/:id", ProducaoController.atualizarOrdem);
router.delete("/ordens/:id", ProducaoController.removerOrdem);
router.post("/ordens/:id/libertar-materiais", ProducaoController.libertarMateriais);
router.post("/ordens/:id/libertar-maquina", ProducaoController.libertarParaMaquina);

router.put("/pre-impressao/:ordem_producao_id", ProducaoController.salvarPreImpressao);
router.put("/impressao/:ordem_producao_id", ProducaoController.salvarImpressao);
router.put("/acabamento/:ordem_producao_id", ProducaoController.salvarAcabamento);
router.put("/qualidade/:ordem_producao_id", ProducaoController.salvarQualidade);

module.exports = router;
