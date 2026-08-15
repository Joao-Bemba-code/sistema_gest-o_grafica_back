const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sanitize = require("./protect/sanitize");

const UPLOADS = process.env.SIGRAF_UPLOADS || path.join(__dirname, "uploads");

fs.mkdirSync(UPLOADS, { recursive: true });

function criarApp(opcoes = {}) {
  const app = express();
  app.set("trust proxy", true);
  app.use(cors());
  app.use(sanitize);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
  });

  // Rota pública para testar se o servidor está a funcionar (deploy/health check).
  // Só é registada no servidor autónomo (deploy); o desktop usa a mesma app
  // embebida e não pode ocupar a raiz (senão deixa de servir a interface web).
  if (!opcoes.semRotaRaiz) {
    app.get("/", (req, res) => {
      res.json({
        ok: true,
        servico: "sistema-gest-o-grafica-back",
        versao: "1.0.0",
        hora: new Date().toISOString(),
      });
    });
  }

  if (opcoes.proxyUrl) {
    const proxy = require("./proxy");
    app.use("/api", proxy(opcoes.proxyUrl));
    app.use("/uploads", proxy(opcoes.proxyUrl));
  } else {
    app.use(express.json({ limit: "100mb" }));
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
    app.use("/api/pedidos", require("./routers/pedidos"));
    app.use("/api/backup", require("./routers/backup"));
    app.use("/api/sinc", require("./routers/sincronizacao"));
    app.get("/api/health", (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));
  }

  return app;
}

module.exports = { criarApp };
