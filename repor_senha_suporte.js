// Repõe (ou cria) o acesso ao painel de suporte técnico.
// Uso: node repor_senha_suporte.js [email] ["Nome"]
// A senha é gerada, guardada apenas em hash e impressa uma única vez.
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { SuporteUsuario } = require("./models");

const CARACTERES = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";

function gerarSenha(tamanho = 16) {
  const bytes = crypto.randomBytes(tamanho * 2);
  let senha = "";
  for (let i = 0; i < tamanho; i++) senha += CARACTERES[bytes[i] % CARACTERES.length];
  return senha;
}

(async () => {
  const email = (process.argv[2] || "admin@empresa.com").trim().toLowerCase();
  const nome = process.argv[3] || "Administração Kamatambu";
  const senha = gerarSenha();
  const hash = await bcrypt.hash(senha, 10);

  const existente = await SuporteUsuario.findOne({ where: { email } });
  if (existente) {
    await existente.update({ senha: hash, ativo: true, nome: existente.nome || nome });
  } else {
    await SuporteUsuario.create({ nome, email, senha: hash, ativo: true });
  }

  console.log("------------------------------------------");
  console.log("Painel:  /suporte/login");
  console.log("Email:  ", email);
  console.log("Senha:  ", senha);
  console.log("------------------------------------------");
  console.log(existente ? "Senha reposta." : "Utilizador de suporte criado.");
  process.exit(0);
})().catch((e) => {
  console.error("Falhou:", e.message);
  process.exit(1);
});
