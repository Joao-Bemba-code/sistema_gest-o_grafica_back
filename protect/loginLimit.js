const LIMITE = 5;
const JANELA_MS = 10 * 60 * 1000;

const falhas = new Map();

function chaveDe(req) {
  return req.ip || req.connection?.remoteAddress || "desconhecido";
}

function bloquear(req, res, next) {
  const chave = chaveDe(req);
  const r = falhas.get(chave);
  if (r && r.count >= LIMITE && Date.now() < r.ate) {
    const minutos = Math.ceil((r.ate - Date.now()) / 60000);
    return res
      .status(429)
      .json({ erro: `Demasiadas tentativas de login. Tente novamente em ${minutos} minuto(s).` });
  }
  req._limiteChave = chave;
  next();
}

function registarFalha(req) {
  const chave = req._limiteChave;
  if (!chave) return;
  const agora = Date.now();
  let r = falhas.get(chave);
  if (!r || agora >= r.ate) {
    r = { count: 0, ate: agora + JANELA_MS };
  }
  r.count++;
  falhas.set(chave, r);
}

function limparFalhas(req) {
  const chave = req._limiteChave;
  if (!chave) return;
  falhas.delete(chave);
}

module.exports = { bloquear, registarFalha, limparFalhas };
