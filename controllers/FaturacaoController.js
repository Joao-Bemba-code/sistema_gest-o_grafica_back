const { Faturacao, Cliente, Orcamento, OrcamentoItem, OrdemProducao } = require("../models");

const ESTADOS = ["emitida", "paga", "parcial", "vencida", "cancelada"];
const TIPOS = ["fatura", "recibo", "proforma", "nota_credito", "factura_recibo"];

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
      include: [Cliente, Orcamento, OrdemProducao],
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
      include: [Cliente, Orcamento, OrdemProducao],
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
    const faturas = await Faturacao.findAll({ where, include: [Cliente] });
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
    observacoes: body.observacoes || null,
  });
  return Faturacao.findByPk(fatura.id, { include: [Cliente, Orcamento, OrdemProducao] });
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
      include: [Cliente, OrcamentoItem],
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
    const completa = await Faturacao.findByPk(fatura.id, { include: [Cliente, Orcamento, OrdemProducao] });
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
    });
    const completa = await Faturacao.findByPk(fatura.id, { include: [Cliente, Orcamento, OrdemProducao] });
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
