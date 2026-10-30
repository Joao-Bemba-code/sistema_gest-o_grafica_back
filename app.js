const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const sanitize = require("./protect/sanitize");
const auth = require("./protect/auth");
const { limitar } = require("./protect/rateLimit");

const UPLOADS = process.env.SIGRAF_UPLOADS || path.join(__dirname, "uploads");

fs.mkdirSync(UPLOADS, { recursive: true });

// Origens autorizadas a chamar a API pelo browser. Configurar em produção:
// APP_ORIGINS=https://app.exemplo.com,https://admin.exemplo.com
const ORIGENS = String(process.env.APP_ORIGINS || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

// Fonte única de verdade para CORS e para a verificação anti-CSRF.
// Em produção falha fechado: sem APP_ORIGINS configurado nenhuma origem de
// browser é aceite (evita refletir qualquer origem com credenciais).
function origemAutorizada(origem) {
  if (!origem) return true; // sem Origin não é um pedido cross-origin de browser
  const limpa = String(origem).replace(/\/+$/, "");
  if (ORIGENS.length) return ORIGENS.includes(limpa);
  return process.env.NODE_ENV !== "production";
}

function corsDaApi() {
  return cors({
    origin(origem, callback) {
      return callback(null, origemAutorizada(origem));
    },
    credentials: true,
  });
}

// Verificação anti-CSRF baseada em Origin. O cookie de sessão é enviado
// automaticamente pelo browser, por isso um formulário malicioso noutro site
// poderia disparar POSTs autenticados. Só aceitamos métodos seguros, origens
// autorizadas, ou (para clientes não-browser, ex.: desktop) pedidos sem Origin
// que apresentem um Bearer token explícito.
function verificarOrigem(req, res, next) {
  const metodo = req.method.toUpperCase();
  if (["GET", "HEAD", "OPTIONS"].includes(metodo)) return next();
  const origem = req.get("origin");
  if (origem) {
    if (origemAutorizada(origem)) return next();
    return res.status(403).json({ erro: "Origem não autorizada" });
  }
  // sem Origin: aceita apenas autenticação explícita por Bearer (apps desktop)
  if (String(req.get("authorization") || "").toLowerCase().startsWith("bearer ")) {
    return next();
  }
  if (!ORIGENS.length && process.env.NODE_ENV !== "production") return next();
  return res.status(403).json({ erro: "Origem não autorizada" });
}

function cabecalhosSeguranca(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
}

function criarApp(opcoes = {}) {
  const app = express();
  // Confiar em todos os proxies permitia falsificar X-Forwarded-For e escapar
  // ao limite de tentativas. Na Render existe exatamente 1 proxy à frente.
  const trustProxy = process.env.TRUST_PROXY;
  app.set(
    "trust proxy",
    trustProxy === undefined
      ? process.env.NODE_ENV === "production"
        ? 1
        : 0
      : trustProxy === "true"
        ? true
        : Number(trustProxy) || 0
  );
  app.use(corsDaApi());
  app.use(cabecalhosSeguranca);
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    next();
  });
  app.use(verificarOrigem);
  // Limite global por IP para todas as rotas da API, como rede de segurança
  // contra abuso/enumeração. Rotas sensíveis mantêm limites próprios.
  app.use(
    "/api",
    limitar({
      prefixo: "api",
      limite: Number(process.env.API_RATE_LIMIT) || 1200,
      janelaMs: 15 * 60 * 1000,
    })
  );

  // Comprovativos de tesouraria não podem ser públicos: exigem sessão válida.
  // Fica antes do static/proxy para que ninguém os descarregue por URL direto.
  app.use("/uploads/tesouraria", auth);

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
    app.use(express.json({ limit: process.env.JSON_LIMIT || "10mb" }));
    // A sanitização tem de correr DEPOIS do parser: antes, req.body ainda não
    // existe e o corpo JSON não era limpo. O sanitize ignora senhas e HTML
    // legítimo (ex.: template de contrato), que seriam corrompidos pelo xss().
    app.use(sanitize);
    app.use(
      "/uploads",
      express.static(UPLOADS, {
        dotfiles: "deny",
        index: false,
        maxAge: "7d",
        setHeaders(res) {
          res.setHeader("X-Content-Type-Options", "nosniff");
          // Impede que um SVG antigo execute scripts ao ser aberto diretamente.
          res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
        },
      })
    );
    app.use("/api/auth", require("./routers/auth"));
    app.use("/api/usuarios", require("./routers/usuarios"));
    app.use("/api/clientes", require("./routers/clientes"));
    app.use("/api/materiais", require("./routers/materiais"));
    app.use("/api/orcamentos", require("./routers/orcamentos"));
    app.use("/api/propostas", require("./routers/propostas"));
    app.use("/api/producao", require("./routers/producao"));
    app.use("/api/faturacao", require("./routers/faturacao"));
    app.use("/api/categorias", require("./routers/categorias"));
    app.use("/api/configuracoes", require("./routers/configuracoes"));
    app.use("/api/fornecedores", require("./routers/fornecedores"));
    app.use("/api/pedidos", require("./routers/pedidos"));
  app.use("/api/requisicoes-material", require("./routers/requisicoes-material"));
    app.use("/api/servicos", require("./routers/servicos"));
    app.use("/api/maquinas", require("./routers/maquinas"));
    app.use("/api/backup", require("./routers/backup"));
    app.use("/api/notificacoes", require("./routers/notificacoes"));
    app.use("/api/contas-bancarias", require("./routers/contasBancarias"));
    app.use("/api/tesouraria", require("./routers/tesouraria"));
    app.use("/api/caixa", require("./routers/caixa"));
    app.use("/api/rateios", require("./routers/rateios"));
    app.use("/api/dividas", require("./routers/dividas"));
    app.use("/api/bens", require("./routers/bens"));
    app.use("/api/sinc", require("./routers/sincronizacao"));
    app.use("/api/suporte", require("./routers/suporte"));
    app.get("/api/health", (req, res) => res.json({ ok: true, hora: new Date().toISOString() }));
  }

  return app;
}

module.exports = { criarApp };
