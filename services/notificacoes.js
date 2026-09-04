const { Notificacao } = require("../models");

// Cria uma notificação persistida para a organização. Usada para eventos
// relevantes (ex.: requisição de material aprovada) que devem aparecer na
// campainha de todos os utilizadores com acesso ao módulo correspondente.
async function criar({ organizacaoId, tipo = "sistema", nivel = "info", icone = "notifications", titulo, descricao = "", link = "", usuarioId = null }) {
  if (!organizacaoId || !titulo) return null;
  try {
    return await Notificacao.create({
      organizacao_id: organizacaoId,
      tipo,
      nivel,
      icone,
      titulo,
      descricao,
      link,
      lida: false,
      usuario_id: usuarioId || null,
    });
  } catch (e) {
    console.error("Erro ao criar notificação:", e);
    return null;
  }
}

module.exports = { criar, Notificacao };
