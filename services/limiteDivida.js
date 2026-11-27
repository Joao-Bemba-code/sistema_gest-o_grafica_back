const { Op } = require("sequelize");
const { Cliente, Faturacao, Sistema } = require("../models");

// Só documentos que representam dívida real do cliente. Recibos/proformas e
// notas de crédito não entram no saldo (as notas de crédito abatem o saldo
// através da fatura a que estão associadas).
const TIPOS_DIVIDA = ["fatura", "factura_recibo"];

function numero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function arredondar(v) {
  return Number((Math.max(0, v) || 0).toFixed(2));
}

function dataLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function partesData(valor) {
  if (!valor) return null;
  const texto = String(valor).slice(0, 10);
  const m = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return { ano: Number(m[1]), mes: Number(m[2]), dia: Number(m[3]) };
}

function somarDias(valor, dias) {
  const p = partesData(valor);
  if (!p) return null;
  const d = new Date(p.ano, p.mes - 1, p.dia);
  d.setDate(d.getDate() + dias);
  return dataLocal(d);
}

// Diferença em dias entre duas datas DATEONLY, sem fuso horário.
function diasEntre(inicio, fim) {
  const a = partesData(inicio);
  const b = partesData(fim);
  if (!a || !b) return null;
  const ta = Date.UTC(a.ano, a.mes - 1, a.dia);
  const tb = Date.UTC(b.ano, b.mes - 1, b.dia);
  return Math.floor((tb - ta) / 86400000);
}

async function obterParametros(organizacaoId) {
  const sistema = await Sistema.findOne({ where: { organizacao_id: organizacaoId } });
  return {
    limite: Math.max(0, numero(sistema?.limite_divida_cliente)),
    prazoDias: Math.max(0, Math.floor(numero(sistema?.prazo_divida_dias) || 30)),
    juroPercentual: Math.min(100, Math.max(0, numero(sistema?.juro_divida_percentual))),
    descontoPercentual: Math.min(100, Math.max(0, numero(sistema?.desconto_divida_percentual))),
    descontoPrazoDias: Math.max(0, Math.floor(numero(sistema?.desconto_prazo_dias))),
  };
}

async function obterLimite(organizacaoId) {
  return (await obterParametros(organizacaoId)).limite;
}

// Juro simples: a percentagem configurada incide sobre o saldo em aberto por
// cada 30 dias de atraso em relação ao prazo global (não é composto).
function calcularJuro(saldoBase, juroPercentual, diasAtraso) {
  if (!saldoBase || !juroPercentual || !diasAtraso) return 0;
  return arredondar(saldoBase * (juroPercentual / 100) * (diasAtraso / 30));
}

function analisarFatura(fatura, parametros, hoje) {
  const total = numero(fatura.total) || numero(fatura.valor);
  const saldoBase = arredondar(total - numero(fatura.valor_pago));
  if (saldoBase <= 0) {
    return { saldoBase: 0, diasAtraso: 0, juro: 0, desconto: 0, saldoFinal: 0 };
  }

  const emissao = fatura.data_emissao || fatura.data_vencimento;
  const prazoFim = somarDias(emissao, parametros.prazoDias);
  const diasAtraso = prazoFim ? Math.max(0, diasEntre(prazoFim, hoje) || 0) : 0;
  const juro = calcularJuro(saldoBase, parametros.juroPercentual, diasAtraso);

  const diasDesdeEmissao = fatura.data_emissao ? diasEntre(fatura.data_emissao, hoje) : null;
  const dentroPrazoDesconto =
    parametros.descontoPercentual > 0 &&
    diasDesdeEmissao !== null &&
    diasDesdeEmissao <= parametros.descontoPrazoDias;
  const desconto = dentroPrazoDesconto
    ? arredondar(saldoBase * (parametros.descontoPercentual / 100))
    : 0;

  return {
    saldoBase,
    diasAtraso,
    juro,
    desconto,
    saldoFinal: arredondar(Math.max(0, saldoBase + juro - desconto)),
  };
}

async function buscarFaturas(organizacaoId, clienteId) {
  const where = {
    organizacao_id: organizacaoId,
    tipo: { [Op.in]: TIPOS_DIVIDA },
    // Faturas "em_analise" ainda não foram validadas na Tesouraria: não contam
    // como dívida nem para o limite de crédito.
    estado: { [Op.notIn]: ["paga", "cancelada", "em_analise"] },
  };
  if (clienteId) where.cliente_id = clienteId;
  return Faturacao.findAll({
    where,
    attributes: [
      "id", "numero", "cliente_id", "tipo", "data_emissao", "data_vencimento",
      "total", "valor", "valor_pago", "estado",
    ],
    include: [{ model: Cliente, attributes: ["id", "nome", "empresa"], required: false }],
    order: [["data_emissao", "ASC"]],
  });
}

async function obterAlertas(organizacaoId, clienteId) {
  const parametros = await obterParametros(organizacaoId);
  if (clienteId && parametros.limite <= 0 && !parametros.juroPercentual) {
    return { parametros, resumo: {}, clientes: [] };
  }
  const faturas = await buscarFaturas(organizacaoId, clienteId);
  const hoje = dataLocal(new Date());
  const porCliente = new Map();

  for (const fatura of faturas) {
    const calc = analisarFatura(fatura, parametros, hoje);
    if (calc.saldoBase <= 0) continue;
    const id = fatura.cliente_id || "sem_cliente";
    if (!porCliente.has(id)) {
      const cliente = fatura.cliente ? fatura.cliente.toJSON() : null;
      porCliente.set(id, {
        clienteId: fatura.cliente_id || null,
        nome: cliente?.nome || cliente?.empresa || "Cliente não identificado",
        empresa: cliente?.empresa || "",
        saldoBase: 0,
        juro: 0,
        desconto: 0,
        saldoFinal: 0,
        diasAtrasoMax: 0,
        quantidadeFaturas: 0,
        faturas: [],
      });
    }
    const grupo = porCliente.get(id);
    grupo.saldoBase = arredondar(grupo.saldoBase + calc.saldoBase);
    grupo.juro = arredondar(grupo.juro + calc.juro);
    grupo.desconto = arredondar(grupo.desconto + calc.desconto);
    grupo.saldoFinal = arredondar(grupo.saldoFinal + calc.saldoFinal);
    grupo.diasAtrasoMax = Math.max(grupo.diasAtrasoMax, calc.diasAtraso);
    grupo.quantidadeFaturas += 1;
    grupo.faturas.push({
      id: fatura.id,
      numero: fatura.numero,
      dataEmissao: fatura.data_emissao,
      saldo: calc.saldoBase,
      diasAtraso: calc.diasAtraso,
      juro: calc.juro,
      desconto: calc.desconto,
    });
  }

  const clientes = Array.from(porCliente.values())
    .map((c) => {
      const percentualLimite = parametros.limite > 0 ? (c.saldoFinal / parametros.limite) * 100 : 0;
      let nivel = "normal";
      if (parametros.limite > 0 && c.saldoFinal >= parametros.limite) nivel = "bloqueado";
      else if (parametros.limite > 0 && c.saldoFinal >= parametros.limite * 0.8) nivel = "atencao";
      else if (c.diasAtrasoMax > 0) nivel = "vencido";
      return {
        ...c,
        percentualLimite: Number(percentualLimite.toFixed(1)),
        nivel,
        alerta: nivel !== "normal",
      };
    })
    .sort((a, b) => {
      const prioridade = { bloqueado: 3, atencao: 2, vencido: 1, normal: 0 };
      return prioridade[b.nivel] - prioridade[a.nivel] || b.saldoFinal - a.saldoFinal;
    });

  const resumo = {
    limite: parametros.limite,
    saldoTotal: arredondar(clientes.reduce((s, c) => s + c.saldoBase, 0)),
    juroTotal: arredondar(clientes.reduce((s, c) => s + c.juro, 0)),
    descontoDisponivel: arredondar(clientes.reduce((s, c) => s + c.desconto, 0)),
    saldoFinalTotal: arredondar(clientes.reduce((s, c) => s + c.saldoFinal, 0)),
    clientesComDivida: clientes.length,
    vencidos: clientes.filter((c) => c.diasAtrasoMax > 0).length,
    bloqueados: clientes.filter((c) => c.nivel === "bloqueado").length,
    alertas: clientes.filter((c) => c.alerta).length,
  };

  return { parametros, resumo, clientes };
}

// Cálculo usado ao marcar uma fatura como paga: desconto por pagamento dentro
// do prazo configurado, contado a partir da emissão da fatura.
async function calcularDescontoPagamento(organizacaoId, fatura, dataPagamento) {
  const parametros = await obterParametros(organizacaoId);
  if (!parametros.descontoPercentual || !parametros.descontoPrazoDias) {
    return { percentual: 0, valor: 0 };
  }
  const emissao = fatura.data_emissao || fatura.data_vencimento;
  const referencia = dataPagamento || dataLocal(new Date());
  const dias = diasEntre(emissao, referencia);
  if (dias === null || dias < 0 || dias > parametros.descontoPrazoDias) {
    return { percentual: 0, valor: 0 };
  }
  const total = numero(fatura.total) || numero(fatura.valor);
  const jaPago = numero(fatura.valor_pago);
  const base = arredondar(total - jaPago);
  return {
    percentual: parametros.descontoPercentual,
    valor: arredondar(base * (parametros.descontoPercentual / 100)),
  };
}

async function calcularSaldo(organizacaoId, clienteId) {
  if (!clienteId) return 0;
  const info = await obterAlertas(organizacaoId, clienteId);
  return info.resumo?.saldoFinal || 0;
}

async function verificar(organizacaoId, clienteId) {
  const parametros = await obterParametros(organizacaoId);
  // 0 = sem limite configurado: nem vale a pena consultar as faturas.
  if (parametros.limite <= 0 && !parametros.juroPercentual) {
    return {
      saldo: 0, saldoBase: 0, juro: 0, desconto: 0, limite: 0,
      prazoDias: parametros.prazoDias, diasAtraso: 0,
      atingiuLimite: false, bloqueado: false, mensagem: "",
    };
  }
  const info = await obterAlertas(organizacaoId, clienteId);
  const cliente = info.clientes.find((c) => c.clienteId === Number(clienteId));
  const saldo = cliente?.saldoFinal || 0;
  const atingiuLimite = parametros.limite > 0 && saldo >= parametros.limite;
  const juro = cliente?.juro || 0;
  const avisoVencido = juro > 0
    ? ` Inclui ${juro.toLocaleString("pt-AO")} Kz de juro por atraso.`
    : "";
  return {
    saldo,
    saldoBase: cliente?.saldoBase || 0,
    juro,
    desconto: cliente?.desconto || 0,
    limite: parametros.limite,
    prazoDias: parametros.prazoDias,
    diasAtraso: cliente?.diasAtrasoMax || 0,
    atingiuLimite,
    bloqueado: atingiuLimite,
    mensagem: atingiuLimite
      ? `O cliente tem ${saldo.toLocaleString("pt-AO")} Kz em dívida e atingiu o limite de ${parametros.limite.toLocaleString("pt-AO")} Kz.${avisoVencido} Só a Administração pode criar orçamentos neste caso.`
      : "",
  };
}

module.exports = {
  verificar,
  calcularSaldo,
  obterLimite,
  obterParametros,
  obterAlertas,
  calcularDescontoPagamento,
};
