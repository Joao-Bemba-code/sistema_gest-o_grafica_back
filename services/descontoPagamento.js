const { ContaBancaria, TesourariaMovimento } = require("../models");

// O desconto concedido por pagamento antecipado é registado como saída de
// tesouraria, para que o dinheiro realmente entrado na conta corresponda ao
// valor pago e a diferença fique documentada. A fatura continua liquidada
// pelo valor total, sem saldo residual.
async function registarDesconto(req, fatura, desconto, metodo, contaId) {
  const valor = Number(desconto?.valor) || 0;
  if (!fatura?.id || valor <= 0) return false;

  const existente = await TesourariaMovimento.findOne({
    where: {
      fatura_id: fatura.id,
      organizacao_id: req.organizacao_id,
      tipo: "saida",
      categoria: "desconto_concedido",
    },
  });
  if (existente) return false;

  const contaEscolhida = contaId || fatura.conta_bancaria_id || null;
  const contaValida = contaEscolhida
    ? await ContaBancaria.findOne({
        where: { id: contaEscolhida, organizacao_id: req.organizacao_id },
      })
    : null;
  if (contaEscolhida && !contaValida) return false;

  const metodosValidos = ["dinheiro", "transferencia", "deposito", "ordem_saida", "multicaixa", "referencia", "cheque", "tpa"];
  const metodoValido = metodosValidos.includes(metodo) ? metodo : null;
  const numero = fatura.numero || `#${fatura.id}`;

  await TesourariaMovimento.create({
    organizacao_id: req.organizacao_id,
    usuario_id: req.usuario.id,
    tipo: "saida",
    categoria: "desconto_concedido",
    descricao: `Desconto por pagamento antecipado — Fatura ${numero}`,
    valor,
    data_movimento: fatura.data_pagamento || new Date().toISOString().split("T")[0],
    hora_movimento: new Date().toTimeString().split(" ")[0],
    referencia: numero,
    referencia_tipo: "fatura",
    referencia_id: fatura.id,
    cliente_id: fatura.cliente_id || null,
    fatura_id: fatura.id,
    conta_bancaria_id: contaValida ? contaValida.id : null,
    metodo_pagamento: metodoValido,
    estado: "confirmado",
    observacoes: `Desconto de ${Number(desconto.percentual) || 0}% aplicado ao pagamento da fatura ${numero}`,
  });

  if (contaValida) {
    const novoSaldo = Number(contaValida.saldo_atual) - valor;
    await contaValida.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
  }
  return true;
}

module.exports = { registarDesconto };
