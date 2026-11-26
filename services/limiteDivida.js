const { Op } = require("sequelize");
const { Faturacao, Sistema } = require("../models");

// Só documentos que representam dívida real do cliente. Recibos/proformas e
// notas de crédito não entram no saldo (as notas de crédito abatem o saldo
// através da fatura a que estão associadas).
const TIPOS_DIVIDA = ["fatura", "factura_recibo"];

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function obterLimite(organizacaoId) {
  const sistema = await Sistema.findOne({ where: { organizacao_id: organizacaoId } });
  return Math.max(0, numero(sistema?.limite_divida_cliente));
}

async function calcularSaldo(organizacaoId, clienteId) {
  if (!clienteId) return 0;
  const faturas = await Faturacao.findAll({
    where: {
      organizacao_id: organizacaoId,
      cliente_id: clienteId,
      tipo: { [Op.in]: TIPOS_DIVIDA },
      estado: { [Op.notIn]: ["paga", "cancelada"] },
    },
    attributes: ["total", "valor", "valor_pago"],
    raw: true,
  });
  const saldo = faturas.reduce((soma, f) => {
    const total = numero(f.total) || numero(f.valor);
    return soma + Math.max(0, total - numero(f.valor_pago));
  }, 0);
  return Number(saldo.toFixed(2));
}

async function verificar(organizacaoId, clienteId) {
  const limite = await obterLimite(organizacaoId);
  // 0 = sem limite configurado: nem vale a pena consultar as faturas.
  if (limite <= 0) {
    return { saldo: 0, limite: 0, atingiuLimite: false, bloqueado: false, mensagem: "" };
  }
  const saldo = await calcularSaldo(organizacaoId, clienteId);
  const atingiuLimite = saldo >= limite;
  return {
    saldo,
    limite,
    atingiuLimite,
    bloqueado: atingiuLimite,
    mensagem: atingiuLimite
      ? `O cliente tem ${saldo.toLocaleString("pt-AO")} Kz em dívida e atingiu o limite de ${limite.toLocaleString("pt-AO")} Kz. Só a Administração pode criar orçamentos neste caso.`
      : "",
  };
}

module.exports = { verificar, calcularSaldo, obterLimite };
