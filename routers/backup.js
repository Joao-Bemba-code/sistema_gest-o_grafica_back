const router = require("express").Router();
const fs = require("fs");
const auth = require("../protect/auth");
const { criarZipBackup } = require("../services/backup");
const auditoria = require("../services/auditoria");

router.use(auth);

// O ZIP atual contém TODAS as tabelas e TODOS os uploads, sem filtro de
// organização. Não pode estar ao alcance de um cliente: exporia os dados de
// todas as empresas. Fica bloqueado por omissão e só um operador da plataforma
// o pode ativar explicitamente (SIGRAF_BACKUP_GLOBAL=true).
router.get("/zip", async (req, res) => {
  const permitido =
    process.env.SIGRAF_BACKUP_GLOBAL === "true" && req.usuario?.perfil === "admin";
  if (!permitido) {
    auditoria.registrar({
      req,
      acao: "backup.global_negado",
      alvoTipo: "backup",
      detalhe: { motivo: "SIGRAF_BACKUP_GLOBAL não ativado ou perfil sem acesso" },
    });
    return res.status(403).json({
      erro: "O backup global está desativado. Use a exportação da sua empresa.",
    });
  }
  try {
    const { caminho, nome } = await criarZipBackup();
    auditoria.registrar({
      req,
      acao: "backup.global_gerado",
      alvoTipo: "backup",
      detalhe: { nome },
    });
    res.download(caminho, nome, (err) => {
      fs.rmSync(caminho, { force: true });
      if (err && !res.headersSent) {
        res.status(500).json({ erro: "Falha ao gerar o backup" });
      }
    });
  } catch (e) {
    console.error("Erro ao gerar backup global:", e);
    res.status(500).json({ erro: "Falha ao gerar o backup" });
  }
});

module.exports = router;
