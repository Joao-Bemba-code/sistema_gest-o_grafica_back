const router = require("express").Router();
const Controller = require("../controllers/VisaoGeralController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const { uploadAnexos } = require("../services/anexosUpload");

router.use(auth);

const VER = requirePermissao("visao_geral", "ver");
const CRIAR = requirePermissao("visao_geral", "criar");
const EDITAR = requirePermissao("visao_geral", "editar");
const APROVAR = requirePermissao("visao_geral", "aprovar");

router.get("/resumo", VER, Controller.resumo);
router.get("/pessoas", VER, Controller.pessoas);

router.get("/pin", VER, Controller.estadoPin);
router.put("/pin", CRIAR, Controller.salvarPin);

router.post("/fechos", CRIAR, Controller.salvarFecho);
router.post("/metas", CRIAR, Controller.salvarMeta);

router.post("/aprovacoes", CRIAR, Controller.criarAprovacao);
router.post("/aprovacoes/:id/decisao", APROVAR, Controller.decidirAprovacao);

router.post("/travas", CRIAR, Controller.criarTrava);
router.post("/travas/:id/regularizacao", APROVAR, Controller.regularizarTrava);

router.post("/atas", CRIAR, Controller.criarAta);
router.post("/acoes", CRIAR, Controller.criarAcao);
router.put("/acoes/:id", EDITAR, Controller.atualizarAcao);

router.post("/anexos", CRIAR, uploadAnexos, Controller.submeterAnexo);
router.get("/anexos/:id", VER, Controller.baixarAnexo);

module.exports = router;
