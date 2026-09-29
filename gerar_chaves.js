const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const dir = path.join(__dirname, "certificados");

function gerar(prefixo, tamanho = 2048) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: tamanho,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  fs.writeFileSync(path.join(dir, `${prefixo}_privada.pem`), privateKey);
  fs.writeFileSync(path.join(dir, `${prefixo}_publica.pem`), publicKey);
  fs.writeFileSync(path.join(dir, `${prefixo}_publica.txt`), publicKey);
  return { prefixo, tamanho, pubLen: publicKey.length };
}

const sw = gerar("software_kamatambu");
const tx = gerar("emitente_kamatambu");
console.log(JSON.stringify([sw, tx], null, 2));
console.log("PRIVADAS_GERADAS = 2");