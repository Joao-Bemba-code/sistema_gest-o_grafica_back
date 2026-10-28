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

// Confirma os primeiros bytes: a extensão sozinha permite enviar HTML com
// nome .pdf, que depois poderia ser interpretado pelo browser.
function assinaturaValida(buffer, ext) {
  if (!buffer || buffer.length < 12) return false;
  if (ext === ".pdf") return buffer.slice(0, 5).toString() === "%PDF-";
  if (ext === ".jpg" || ext === ".jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (ext === ".png") {
    return (
      buffer[0] === 0x89 &&
      buffer.slice(1, 4).toString() === "PNG"
    );
  }
  if (ext === ".webp") {
    return buffer.slice(0, 4).toString() === "RIFF" && buffer.slice(8, 12).toString() === "WEBP";
  }
  return false;
}

// Middleware que converte erros do multer em resposta 400 legível
function uploadAnexos(req, res, next) {
  upload.array("anexos", 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ erro: err.message || "Erro ao carregar ficheiro(s)" });
    }
    for (const f of req.files || []) {
      const ext = path.extname(f.originalname || "").toLowerCase();
      if (!assinaturaValida(f.buffer, ext)) {
        return res.status(400).json({
          erro: `O ficheiro "${f.originalname}" não corresponde a um ${ext.slice(1).toUpperCase()} válido.`,
        });
      }
    }
    next();
  });
}

module.exports = { uploadAnexos };
