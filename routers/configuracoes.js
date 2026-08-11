const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const Controller = require("../controllers/ConfiguracoesController");
const auth = require("../protect/auth");

const UPLOADS = process.env.SIGRAF_UPLOADS || path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo_${req.organizacao_id}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(png|jpg|jpeg|svg|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error("Formato de imagem inválido. Use PNG, JPG, SVG ou GIF"));
  },
});

router.use(auth);

router.get("/organizacao", Controller.buscarOrganizacao);
router.put("/organizacao", Controller.guardarOrganizacao);

router.get("/sistema", Controller.buscarSistema);
router.put("/sistema", Controller.guardarSistema);

router.get("/seguranca", Controller.buscarSeguranca);
router.put("/seguranca", Controller.guardarSeguranca);

router.post("/logo", (req, res) => {
  upload.single("logo")(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ erro: "O logo excede o tamanho máximo de 5MB" });
      }
      return res.status(400).json({ erro: err.message || "Falha ao processar a imagem" });
    }
    Controller.uploadLogo(req, res);
  });
});

router.get("/utilizador", Controller.buscarUtilizadorAtual);
router.put("/alterar-email", Controller.alterarEmail);
router.put("/alterar-senha", Controller.alterarSenha);

module.exports = router;
