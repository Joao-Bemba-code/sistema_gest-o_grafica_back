const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sanitize = require("./protect/sanitize");

const UPLOADS = process.env.SIGRAF_UPLOADS || path.join(__dirname, "uploads");

fs.mkdirSync(UPLOADS, { recursive: true });

function criarApp(opcoes = {}) {
  const app = express();
  app.use(cors());
  app.use(sanitize);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
  });

  if (opcoes.proxyUrl) {
    const proxy = require("./proxy");
    app.use("/api", proxy(opcoes.proxyUrl));
    app.use("/uploads", proxy(opcoes.proxyUrl));
  } else {
    app.use(express.json({ limit: "10mb" }));
    app.use("/uploads", express.static(UPLOADS));
    app.use("/api/auth", require("./routers/auth"));
    app.use("/api/clientes", require("./routers/clientes"));
    app.use("/api/materiais", require("./routers/materiais"));
    app.use("/api/orcamentos", require("./routers/orcamentos"));
    app.use("/api/producao", require("./routers/producao"));
    app.use("/api/faturacao", require("./routers/faturacao"));
    app.use("/api/categorias", require("./routers/categorias"));
    app.use("/api/configuracoes", require("./routers/configuracoes"));
    app.use("/api/fornecedores", require("./routers/fornecedores"));
    app.use("/api/backup", require("./routers/backup"));
  }

  return app;
}

module.exports = { criarApp };
