// Denylist de tokens JWT revogados (logout), indexada pelo `jti`.
// Guarda apenas até à expiração natural do token, para não crescer sem limite.
// Nota: é memória do processo. Com várias instâncias é necessário um
// armazenamento partilhado (ex.: Redis) para revogar em todas; nesta arquitetura
// (uma instância na Render) resolve o caso do logout imediato.
const revogados = new Map();
let ultimaLimpeza = 0;

function limparExpirados(agora = Date.now()) {
  if (agora - ultimaLimpeza < 60 * 1000) return;
  ultimaLimpeza = agora;
  for (const [jti, expiraEm] of revogados) {
    if (!expiraEm || agora >= expiraEm) revogados.delete(jti);
  }
}

function revogar(jti, expSegundos) {
  if (!jti) return;
  const agora = Date.now();
  limparExpirados(agora);
  const expiraEm = Number(expSegundos) ? Number(expSegundos) * 1000 : agora + 8 * 60 * 60 * 1000;
  revogados.set(String(jti), expiraEm);
}

function estaRevogado(jti) {
  if (!jti) return false;
  limparExpirados();
  const expiraEm = revogados.get(String(jti));
  if (!expiraEm) return false;
  if (Date.now() >= expiraEm) {
    revogados.delete(String(jti));
    return false;
  }
  return true;
}

module.exports = { revogar, estaRevogado };
