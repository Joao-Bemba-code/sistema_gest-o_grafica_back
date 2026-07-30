const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const Controller = require("../controllers/ConfiguracoesController");
const auth = require("../protect/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${req.organizacao_id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(png|jpg|jpeg|svg|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error("Formato de imagem inválido. Use PNG, JPG ou SVG"));
  },
});

router.use(auth);

router.get("/organizacao", Controller.buscarOrganizacao);
router.put("/organizacao", Controller.guardarOrganizacao);

router.get("/sistema", Controller.buscarSistema);
router.put("/sistema", Controller.guardarSistema);

router.get("/seguranca", Controller.buscarSeguranca);
router.put("/seguranca", Controller.guardarSeguranca);

router.post("/logo", upload.single("logo"), Controller.uploadLogo);

router.get("/utilizador", Controller.buscarUtilizadorAtual);
router.put("/alterar-email", Controller.alterarEmail);
router.put("/alterar-senha", Controller.alterarSenha);

module.exports = router;
