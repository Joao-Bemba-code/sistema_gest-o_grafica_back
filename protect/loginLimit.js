const LIMITE = 5;
const JANELA_MS = 10 * 60 * 1000;

const falhasIp = new Map();
const falhasConta = new Map();

function chaveIp(req) {
  return req.ip || req.connection?.remoteAddress || "desconhecido";
}

function chaveConta(req) {
  const email = String(req.body?.email || "").trim().toLowerCase();
  return email || null;
}

function excedido(mapa, chave) {
  if (!chave) return false;
  const r = mapa.get(chave);
  return !!(r && r.count >= LIMITE && Date.now() < r.ate);
}

function bloquear(req, res, next) {
  const chave = chaveIp(req);
  const conta = chaveConta(req);
  if (excedido(falhasIp, chave) || excedido(falhasConta, conta)) {
    const r = excedido(falhasIp, chave) ? falhasIp.get(chave) : falhasConta.get(conta);
    const minutos = Math.max(1, Math.ceil((r.ate - Date.now()) / 60000));
    return res
      .status(429)
      .json({ erro: `Demasiadas tentativas de login. Tente novamente em ${minutos} minuto(s).` });
  }
  req._limiteChave = chave;
  req._limiteConta = conta;
  next();
}

function registar(mapa, chave) {
  if (!chave) return;
  const agora = Date.now();
  let r = mapa.get(chave);
  if (!r || agora >= r.ate) {
    r = { count: 0, ate: agora + JANELA_MS };
  }
  r.count++;
  mapa.set(chave, r);
}

function registarFalha(req) {
  // Mantém compatibilidade com chamadas antigas: usa as chaves preparadas
  // pelo middleware bloquear. Sem bloquear, não há limite (era o caso do
  // painel de suporte, que ficou sem qualquer bloqueio).
  registar(falhasIp, req._limiteChave);
  registar(falhasConta, req._limiteConta);
}

function limparFalhas(req) {
  if (req._limiteChave) falhasIp.delete(req._limiteChave);
  if (req._limiteConta) falhasConta.delete(req._limiteConta);
}

module.exports = { bloquear, registarFalha, limparFalhas };
