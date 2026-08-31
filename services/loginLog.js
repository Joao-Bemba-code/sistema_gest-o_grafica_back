const { LoginLog } = require("../models");

// Regista uma tentativa de login (sucesso ou falha) para auditoria de acessos.
// Não deve nunca derrubar o login em caso de erro de escrita do log.
exports.registrar = async ({ organizacao_id, usuario_id, email, sucesso, ip, user_agent }) => {
  try {
    await LoginLog.create({
      organizacao_id: organizacao_id ?? null,
      usuario_id: usuario_id ?? null,
      email,
      sucesso: !!sucesso,
      ip: ip || null,
      user_agent: user_agent || null,
    });
  } catch (e) {
    console.error("Erro ao registar login:", e.message);
  }
};