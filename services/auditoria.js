const { Auditoria } = require("../models");

// Registo imutável de acções sensíveis dentro de uma empresa.
// Nunca lança erros para o chamador: falhar a auditoria não pode quebrar
// a operação que está a ser auditada.
async function registrar({ req, organizacaoId, usuarioId, acao, alvoTipo, alvoId, detalhe }) {
  try {
    const org = organizacaoId ?? req?.organizacao_id ?? req?.usuario?.organizacao_id;
    if (!org) return;
    await Auditoria.create({
      organizacao_id: org,
      usuario_id: usuarioId ?? req?.usuario?.id ?? null,
      acao: String(acao).slice(0, 60),
      alvo_tipo: alvoTipo ? String(alvoTipo).slice(0, 30) : null,
      alvo_id: alvoId ?? null,
      detalhe: detalhe ? String(detalhe).slice(0, 4000) : null,
      ip: req?.ip || null,
    });
  } catch {
    // silencioso de propósito: a auditoria é secundária face à operação
  }
}

module.exports = { registrar };
