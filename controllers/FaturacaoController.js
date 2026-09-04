const { Faturacao, Cliente, Orcamento, OrcamentoItem, OrdemProducao, TesourariaMovimento, ContaBancaria } = require("../models");

const ESTADOS = ["emitida", "paga", "parcial", "vencida", "cancelada"];
const TIPOS = ["fatura", "recibo", "proforma", "nota_credito", "factura_recibo"];

// Tipos de documento que representam recebimento de dinheiro (geram entrada automática).
const TIPOS_ENTRADA = ["fatura", "recibo", "factura_recibo"];

/**
 * Regista automaticamente a ENTRADA de tesouraria quando uma fatura/recibo é
 * liquidada (paga). As saídas e transferências são sempre manuais.
 * Evita duplicados: só cria se ainda não existir um movimento de entrada ligado
 * à fatura. Devolve true se criar, false caso contrário.
 */
async function registarEntradaTesouraria(req, fatura, valorPago, metodo, contaId) {
  try {
    if (!fatura || !fatura.id) return false;
    if (!TIPOS_ENTRADA.includes(fatura.tipo)) return false;
    const valor = parseFloat(valorPago);
    if (!valor || valor <= 0) return false;

    const existente = await TesourariaMovimento.findOne({
      where: { fatura_id: fatura.id, tipo: "entrada", organizacao_id: req.organizacao_id },
    });
    if (existente) return false;

    const numero = fatura.numero || `#${fatura.id}`;
    const rotulo = fatura.tipo === "factura_recibo" ? "Factura Recibo" : fatura.tipo === "recibo" ? "Recibo" : "Fatura";

    const movimento = await TesourariaMovimento.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      tipo: "entrada",
      categoria: "venda",
      descricao: `Pagamento ${rotulo} ${numero}`,
      valor,
      data_movimento: fatura.data_pagamento || new Date().toISOString().split("T")[0],
      hora_movimento: new Date().toTimeString().split(" ")[0],
      referencia: numero,
      referencia_tipo: fatura.tipo === "factura_recibo" ? "recibo" : "fatura",
      referencia_id: fatura.id,
      cliente_id: fatura.cliente_id || null,
      fatura_id: fatura.id,
      conta_bancaria_id: contaId || fatura.conta_bancaria_id || null,
      metodo_pagamento: metodo || fatura.metodo_pagamento || null,
      estado: "confirmado",
      observacoes: "Entrada automática gerada pela liquidação da fatura",
    });

    if (movimento.conta_bancaria_id) {
      const conta = await ContaBancaria.findByPk(movimento.conta_bancaria_id);
      if (conta) {
        const novoSaldo = Number(conta.saldo_atual) + valor;
        await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }
    return true;
  } catch (e) {
    console.error("Erro ao registar entrada automática de tesouraria:", e);
    return false;
  }
}

function resolverClienteId(body) {
  if (body.cliente_id) return body.cliente_id;
  return null;
}

function normalizarItens(itens) {
  return (itens || [])
    .map((i) => {
      const quantidade = parseInt(i.quantidade, 10) || 0;
      const preco = parseFloat(i.preco_unit != null ? i.preco_unit : i.valorUnitario) || 0;
      return {
        descricao: String(i.descricao || "").trim(),
        quantidade,
        preco_unit: preco,
        total: Number((quantidade * preco).toFixed(2)),
      };
    })
    .filter((i) => i.descricao);
}

function calcularTotais(body, itens) {
  let subtotal = 0;
  if (itens.length) {
    subtotal = itens.reduce((s, i) => s + i.total, 0);
  } else {
    subtotal = parseFloat(body.subtotal != null ? body.subtotal : body.valor) || 0;
  }
  const ivaPct = parseFloat(body.iva != null ? body.iva : 0) || 0;
  const valorIva = subtotal * (ivaPct / 100);
  const total = parseFloat(body.total != null ? body.total : 0) || subtotal + valorIva;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    iva: ivaPct,
    valor_iva: Number(valorIva.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

async function proximoNumero(organizacao_id, tipo) {
  const prefixo = tipo === "recibo" ? "REC" : tipo === "proforma" ? "PRF" : tipo === "factura_recibo" ? "FR" : "FAT";
  const ano = new Date().getFullYear();
  const count = await Faturacao.count({ where: { organizacao_id } });
  return `${prefixo}-${ano}-${String(count + 1).padStart(4, "0")}`;
}

async function resolverCliente(req, body) {
  const id = resolverClienteId(body);
  if (id) return id;
  if (body.cliente && String(body.cliente).trim()) {
    const cli = await Cliente.findOne({
      where: { nome: String(body.cliente).trim(), organizacao_id: req.organizacao_id },
    });
    if (cli) return cli.id;
  }
  return null;
}

exports.listar = async (req, res) => {
  try {
    const { estado, tipo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    const faturas = await Faturacao.findAll({
      where,
      include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }],
      order: [["createdAt", "DESC"]],
    });
    return res.json(faturas);
  } catch (e) {
    console.error("Erro ao listar faturas:", e);
    return res.status(500).json({ erro: "Erro ao listar faturas" });
  }
};

exports.buscar = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }],
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    return res.json(fatura);
  } catch (e) {
    console.error("Erro ao buscar fatura:", e);
    return res.status(500).json({ erro: "Erro ao buscar fatura" });
  }
};

exports.exportar = async (req, res) => {
  try {
    const { estado, tipo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado && estado !== "todas" && estado !== "todos") where.estado = estado;
    if (tipo) where.tipo = tipo;
    const faturas = await Faturacao.findAll({ where, include: [{ model: Cliente, required: false }] });
    const linhas = [
      ["id", "numero", "tipo", "cliente", "data_emissao", "data_vencimento", "subtotal", "iva", "valor_iva", "total", "valor_pago", "estado", "metodo_pagamento"],
      ...faturas.map((f) => [
        f.id, f.numero, f.tipo, f.cliente?.nome || "", f.data_emissao, f.data_vencimento || "",
        f.subtotal, f.iva, f.valor_iva, f.total, f.valor_pago, f.estado, f.metodo_pagamento || "",
      ]),
    ];
    const csv = linhas
      .map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="faturas_${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error("Erro ao exportar faturas:", e);
    return res.status(500).json({ erro: "Erro ao exportar faturas" });
  }
};

async function criarRegisto(req, body) {
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : "fatura";
  const itens = normalizarItens(body.itens);
  const totais = calcularTotais(body, itens);
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];
  const dataEmissao = body.data_emissao || hojeStr;
  const dataVencimento =
    body.data_vencimento || new Date(hoje.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const clienteId = await resolverCliente(req, body);
  let valorPago = parseFloat(body.valor_pago) || 0;
  let estado = ESTADOS.includes(body.estado) ? body.estado : null;
  if (tipo === "factura_recibo") {
    estado = "paga";
    valorPago = totais.total;
  }
  if (!estado) {
    estado = valorPago >= totais.total ? "paga" : valorPago > 0 ? "parcial" : "emitida";
  }
  const numero = body.numero || (await proximoNumero(req.organizacao_id, tipo));
  const fatura = await Faturacao.create({
    organizacao_id: req.organizacao_id,
    usuario_id: req.usuario.id,
    orcamento_id: body.orcamento_id || null,
    ordem_producao_id: body.op || body.ordem_producao_id || null,
    cliente_id: clienteId,
    tipo,
    numero,
    data_emissao: dataEmissao,
    data_vencimento: dataVencimento,
    data_pagamento: estado === "paga" ? body.data_pagamento || hojeStr : body.data_pagamento || null,
    itens,
    ...totais,
    valor: totais.total,
    valor_pago: valorPago,
    estado,
    metodo_pagamento: body.metodo || body.metodo_pagamento || null,
    conta_bancaria_id: body.conta_bancaria_id || null,
    observacoes: body.observacoes || null,
  });
  if (estado === "paga" && valorPago > 0) {
    await registarEntradaTesouraria(req, { ...fatura.toJSON(), data_pagamento: fatura.data_pagamento }, valorPago, fatura.metodo_pagamento, fatura.conta_bancaria_id);
  }
  return Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }] });
}

exports.criar = async (req, res) => {
  try {
    const completa = await criarRegisto(req, req.body || {});
    return res.status(201).json(completa);
  } catch (e) {
    console.error("Erro ao criar fatura:", e);
    return res.status(500).json({ erro: "Erro ao criar fatura" });
  }
};

exports.fromOrcamento = async (req, res) => {
  try {
    const orcamento = await Orcamento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: Cliente, required: false }, { model: OrcamentoItem, required: false }],
    });
    if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado" });
    const itens = (orcamento.orcamento_items || []).map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade) || 0,
      preco_unit: Number(i.preco_unit) || 0,
    }));
    const subtotal = Number(orcamento.total_sem_iva) || 0;
    const ivaPct = subtotal > 0 ? Number(((Number(orcamento.total_iva) / subtotal) * 100).toFixed(2)) : 0;
    const body = {
      tipo: req.body?.tipo || "fatura",
      orcamento_id: orcamento.id,
      cliente_id: orcamento.cliente_id,
      itens,
      iva: ivaPct,
      total: Number(orcamento.total_com_iva) || 0,
      data_emissao: new Date().toISOString().split("T")[0],
      observacoes: `Facturado a partir do orçamento ${orcamento.numero}`,
    };
    const completa = await criarRegisto(req, body);
    return res.status(201).json(completa);
  } catch (e) {
    console.error("Erro ao faturar orçamento:", e);
    return res.status(500).json({ erro: "Erro ao faturar orçamento" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.usuario_id;
    delete dados.cliente;
    if (dados.estado !== undefined && !ESTADOS.includes(dados.estado)) delete dados.estado;
    if (dados.valor_pago !== undefined) {
      const total = parseFloat(fatura.total || fatura.valor) || 0;
      const vp = parseFloat(dados.valor_pago) || 0;
      dados.estado = vp >= total ? "paga" : vp > 0 ? "parcial" : "emitida";
    }
    await fatura.update(dados);
    const estadoPos = dados.estado !== undefined ? dados.estado : fatura.estado;
    const valorPos = dados.valor_pago !== undefined ? parseFloat(dados.valor_pago) || 0 : parseFloat(fatura.valor_pago) || 0;
    if (estadoPos === "paga" && valorPos > 0) {
      await registarEntradaTesouraria(req, { ...fatura.toJSON(), data_pagamento: dados.data_pagamento || fatura.data_pagamento }, valorPos, dados.metodo_pagamento || dados.metodo || fatura.metodo_pagamento, dados.conta_bancaria_id || fatura.conta_bancaria_id);
    }
    const completa = await Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }] });
    return res.json(completa);
  } catch (e) {
    console.error("Erro ao atualizar fatura:", e);
    return res.status(500).json({ erro: "Erro ao atualizar fatura" });
  }
};

exports.marcarPaga = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    if (fatura.estado === "cancelada") {
      return res.status(400).json({ erro: "Fatura cancelada não pode ser marcada como paga" });
    }
    const body = req.body || {};
    const total = parseFloat(fatura.total || fatura.valor) || 0;
    let valorPago = parseFloat(body.valor_pago) || 0;
    if (valorPago <= 0 || valorPago >= total) valorPago = total;
    await fatura.update({
      valor_pago: valorPago,
      estado: valorPago >= total ? "paga" : "parcial",
      metodo_pagamento: body.metodo || body.metodo_pagamento || fatura.metodo_pagamento,
      data_pagamento: body.data_pagamento || new Date().toISOString().split("T")[0],
      conta_bancaria_id: body.conta_bancaria_id || body.conta || fatura.conta_bancaria_id,
    });
    if (valorPago >= total) {
      await registarEntradaTesouraria(
        req,
        { ...fatura.toJSON(), data_pagamento: body.data_pagamento || fatura.data_pagamento },
        valorPago,
        body.metodo || body.metodo_pagamento || fatura.metodo_pagamento,
        body.conta_bancaria_id || body.conta || fatura.conta_bancaria_id
      );
    }
    const completa = await Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }] });
    return res.json(completa);
  } catch (e) {
    console.error("Erro ao marcar fatura como paga:", e);
    return res.status(500).json({ erro: "Erro ao marcar fatura como paga" });
  }
};

exports.remover = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    await fatura.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Fatura removida com sucesso" });
  } catch (e) {
    console.error("Erro ao remover fatura:", e);
    return res.status(500).json({ erro: "Erro ao remover fatura" });
  }
};
