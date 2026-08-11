const http = require("http");
const https = require("https");

function criarProxy(baseUrl) {
  return (req, res) => {
    const lib = baseUrl.startsWith("https") ? https : http;
    const u = new URL(baseUrl + req.originalUrl);
    const options = {
      method: req.method,
      headers: { ...req.headers, host: u.host },
    };
    const proxyReq = lib.request(u, options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on("error", (e) => {
      if (!res.headersSent) {
        res.status(502).json({ erro: `Não foi possível ligar ao servidor (${e.message})` });
      }
    });
    req.pipe(proxyReq);
  };
}

module.exports = criarProxy;
