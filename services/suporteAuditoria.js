const { SuporteAuditoria } = require("../models");

// Grava a auditoria sem nunca rebentar a operação principal:
// falhar o log não pode impedir o suporte de criar uma organização.
async function registar(req, acao, alvo = {}, detalhe = null) {
  try {
    await SuporteAuditoria.create({
      suporte_usuario_id: req.suporte?.id ?? null,
      acao,
      alvo_tipo: alvo.tipo || null,
      alvo_id: alvo.id ?? null,
      detalhe: detalhe ? JSON.stringify(detalhe) : null,
      ip: req.ip || null,
    });
  } catch (e) {
    console.error("Erro ao registar auditoria de suporte:", e.message);
  }
}

module.exports = { registar };
