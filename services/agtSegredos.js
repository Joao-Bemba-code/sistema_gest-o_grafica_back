const crypto = require("crypto");

// A chave de encriptação deriva do SECRET do backend. Se o SECRET mudar,
// os segredos guardados deixam de ser legíveis e têm de ser redefinidos.
function chaveSegredos() {
  return crypto.createHash("sha256").update(process.env.SECRET || "sigraf-segredo-local").digest();
}

function cifrar(texto) {
  if (texto == null || texto === "") return null;
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv("aes-256-gcm", chaveSegredos(), iv);
  const cifrado = Buffer.concat([cifra.update(String(texto), "utf8"), cifra.final()]);
  const tag = cifra.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), cifrado.toString("base64")].join(".");
}

function decifrar(valor) {
  if (!valor) return null;
  try {
    const partes = String(valor).split(".");
    if (partes.length !== 3) return null;
    const decifra = crypto.createDecipheriv("aes-256-gcm", chaveSegredos(), Buffer.from(partes[0], "base64"));
    decifra.setAuthTag(Buffer.from(partes[1], "base64"));
    return Buffer.concat([decifra.update(Buffer.from(partes[2], "base64")), decifra.final()]).toString("utf8");
  } catch {
    return null;
  }
}

module.exports = { cifrar, decifrar };
