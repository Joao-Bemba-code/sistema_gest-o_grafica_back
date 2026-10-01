const multer = require("multer");
const path = require("path");

// Upload de anexos de tesouraria (recibos de pagamento, comprovativos).
// Usa memória (memoryStorage): o conteúdo é guardado na base de dados
// como BLOB, para sobreviver a redeploys (o disco do Render é efémero).
// Só aceita PDF e imagens comuns, até 10 MB por ficheiro.

const EXTENSOES_OK = [".pdf", ".jpg", ".jpeg", ".png", ".webp"];

const upload = multer({
  storage: multer.memoryStorage(),
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

module.exports = { uploadAnexos };
