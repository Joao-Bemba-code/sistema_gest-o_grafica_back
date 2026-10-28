const router = require("express").Router();
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
const Controller = require("../controllers/ConfiguracoesController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

const UPLOADS = process.env.SIGRAF_UPLOADS || path.join(__dirname, "..", "uploads");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    // Nome imprevisível: evita enumerar os logotipos de todas as empresas.
    cb(null, `logo_${req.organizacao_id}_${crypto.randomBytes(10).toString("hex")}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    // SVG fica de fora: pode conter JavaScript e é servido na mesma origem.
    const allowed = /\.(png|jpg|jpeg|webp|gif)$/i;
    if (allowed.test(path.extname(file.originalname))) return cb(null, true);
    cb(new Error("Formato de imagem inválido. Use PNG, JPG, WEBP ou GIF"));
  },
});

router.use(auth);

// Dados da própria empresa (nome, logo, dados bancários para PDFs). É usado
// por várias telas e está limitado à organização do token; não expõe outras
// empresas. As alterações continuam a exigir permissão de configuração.
router.get("/organizacao", Controller.buscarOrganizacao);
router.put("/organizacao", requirePermissao("configuracao", "editar"), Controller.guardarOrganizacao);

router.get("/sistema", requirePermissao("configuracao", "ver"), Controller.buscarSistema);
router.put("/sistema", requirePermissao("configuracao", "editar"), Controller.guardarSistema);

router.get("/seguranca", requirePermissao("configuracao", "ver"), Controller.buscarSeguranca);
router.put("/seguranca", requirePermissao("configuracao", "editar"), Controller.guardarSeguranca);

// Configuração AGT da própria empresa (contribuinte). Os segredos nunca saem
// da BD: o GET devolve apenas o que está definido ou não.
router.get("/agt", requirePermissao("configuracao", "ver"), Controller.buscarAgt);
router.put("/agt", requirePermissao("configuracao", "editar"), Controller.guardarAgt);

router.post("/logo", requirePermissao("configuracao", "editar"), (req, res) => {
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
