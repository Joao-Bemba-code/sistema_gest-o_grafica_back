// Limitador simples em memória para rotas públicas (registo, Google, etc.).
// Nota: em várias instâncias o limite é por instância; para produção em escala
// deve passar a usar Redis. Serve para travar abuso trivial e força bruta.
const janelas = new Map();
let ultimaLimpeza = Date.now();

function limparAntigas() {
  const agora = Date.now();
  if (agora - ultimaLimpeza < 60 * 1000) return;
  ultimaLimpeza = agora;
  for (const [chave, registo] of janelas) {
    if (agora >= registo.ate) janelas.delete(chave);
  }
}

function chaveDoPedido(req, prefixo) {
  const ip = req.ip || req.connection?.remoteAddress || "desconhecido";
  return `${prefixo}:${ip}`;
}

function limitar({ prefixo, limite, janelaMs }) {
  return (req, res, next) => {
    limparAntigas();
    const chave = chaveDoPedido(req, prefixo);
    const agora = Date.now();
    let registo = janelas.get(chave);
    if (!registo || agora >= registo.ate) {
      registo = { count: 0, ate: agora + janelaMs };
      janelas.set(chave, registo);
    }
    registo.count += 1;
    if (registo.count > limite) {
      const minutos = Math.max(1, Math.ceil((registo.ate - agora) / 60000));
      res.setHeader("Retry-After", String(Math.ceil((registo.ate - agora) / 1000)));
      return res.status(429).json({
        erro: `Demasiados pedidos. Tente novamente em ${minutos} minuto(s).`,
      });
    }
    next();
  };
}

module.exports = { limitar };
