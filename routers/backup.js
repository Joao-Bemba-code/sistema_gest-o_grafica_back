const router = require("express").Router();
const fs = require("fs");
const auth = require("../protect/auth");
const { criarZipBackup } = require("../services/backup");

router.use(auth);

router.get("/zip", async (req, res) => {
  try {
    const { caminho, nome } = await criarZipBackup();
    res.download(caminho, nome, (err) => {
      fs.rmSync(caminho, { force: true });
      if (err && !res.headersSent) {
        res.status(500).json({ erro: "Falha ao gerar o backup" });
      }
    });
  } catch (e) {
    res.status(500).json({ erro: e.message || "Falha ao gerar o backup" });
  }
});

module.exports = router;
