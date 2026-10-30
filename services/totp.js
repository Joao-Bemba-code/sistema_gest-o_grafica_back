const crypto = require("crypto");

// 2FA TOTP (RFC 4226/6238) para o painel de suporte, sem dependências externas.
// O segredo é guardado cifrado (AES-256-GCM) com chave derivada de SECRET_SUPORTE.

const ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const PASSO_MS = 30_000;
const DIGITOS = 6;

function base32Encode(buf) {
  let bits = 0;
  let valor = 0;
  let saida = "";
  for (const byte of buf) {
    valor = (valor << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      saida += ALFABETO[(valor >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) saida += ALFABETO[(valor << (5 - bits)) & 31];
  return saida;
}

function base32Decode(texto) {
  let bits = 0;
  let valor = 0;
  const bytes = [];
  for (const ch of String(texto).toUpperCase().replace(/=+$/, "")) {
    const idx = ALFABETO.indexOf(ch);
    if (idx === -1) continue;
    valor = (valor << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((valor >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function chaveCifra() {
  const segredo = process.env.SECRET_SUPORTE;
  if (!segredo) {
    // Nunca usar uma chave fixa: permitiria decifrar os segredos TOTP de
    // qualquer instalação que não definisse a variável.
    throw new Error("SECRET_SUPORTE não configurado: não é possível cifrar/decifrar o segredo TOTP.");
  }
  return crypto.createHash("sha256").update(segredo).digest();
}

function cifrarSegredo(texto) {
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chaveCifra(), iv);
  const dados = Buffer.concat([cifra.update(String(texto), "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv, tag, dados].map((b) => b.toString("base64")).join(".");
}

function decifrarSegredo(valor) {
  if (!valor) return null;
  try {
    const [iv, tag, dados] = String(valor).split(".").map((p) => Buffer.from(p, "base64"));
    const cifra = crypto.createDecipheriv("aes-256-gcm", chaveCifra(), iv);
    cifra.setAuthTag(tag);
    return Buffer.concat([cifra.update(dados), cifra.final()]).toString("utf8");
  } catch {
    return null;
  }
}

function hotp(segredoBase32, contador) {
  const chave = base32Decode(segredoBase32);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(contador));
  const hmac = crypto.createHmac("sha1", chave).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codigo = ((hmac[offset] & 0x7f) << 24) | (hmac[offset + 1] << 16) | (hmac[offset + 2] << 8) | hmac[offset + 3];
  return String(codigo % 10 ** DIGITOS).padStart(DIGITOS, "0");
}

function gerarSegredo() {
  return base32Encode(crypto.randomBytes(20));
}

function verificarCodigo(segredoBase32, codigo, janela = 1) {
  const limpo = String(codigo || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(limpo)) return false;
  const contador = Math.floor(Date.now() / PASSO_MS);
  for (let i = -janela; i <= janela; i++) {
    const esperado = hotp(segredoBase32, contador + i);
    // Comparação em tempo constante para não vazar dígitos por temporização.
    if (esperado.length === limpo.length && crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(limpo))) {
      return true;
    }
  }
  return false;
}

module.exports = { gerarSegredo, verificarCodigo, cifrarSegredo, decifrarSegredo, base32Encode };
