const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Upload de anexos de tesouraria (recibos de pagamento, comprovativos).
// Guarda em disco na pasta uploads/tesouraria; só aceita PDF e imagens
// comuns, até 10 MB por ficheiro.
const UPLOADS = process.env.SIGRAF_UPLOADS || path.join(__dirname, "..", "uploads");
const DIR_TESOURARIA = path.join(UPLOADS, "tesouraria");
fs.mkdirSync(DIR_TESOURARIA, { recursive: true });

const EXTENSOES_OK = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIR_TESOURARIA),
  filename: (req, file, cb) => {
    const original = path.basename(file.originalname || "anexo");
    const seguro = original.replace(/[^\w.\-]+/g, "_").slice(0, 80) || "anexo";
    cb(null, `mv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${seguro}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (!EXTENSOES_OK.includes(ext)) {
      return cb(new Error("Formato não permitido. Use PDF ou imagem (JPG, PNG ou WEBP)."));
    }
    cb(null, true);
  },
});

// Middleware que converte erros do multer em resposta 400 legível
function uploadAnexos(req, res, next) {
  upload.array("anexos", 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ erro: err.message || "Erro ao carregar ficheiro(s)" });
    }
    next();
  });
}

module.exports = { uploadAnexos, DIR_TESOURARIA };
