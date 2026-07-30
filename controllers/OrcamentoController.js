const { sequelize, Orcamento, OrcamentoItem, Cliente } = require("../models");
const validador = require("../validators/orcamento");

const ESTADOS = ["pendente", "aprovado", "cancelado", "rejeitado"];

function normalizarDados(body) {
  const spec = body.especificacao || {};
  const dados = {
    cliente_id: body.cliente_id,
    produto: spec.produto,
    formato: spec.formato,
    papel: spec.papel,
    impressao: spec.impressao,
    acabamento: spec.acabamento,
    prazo_execucao: body.prazoExecucao,
    condicoes_pagamento: body.condicoesPagamento,
    iva: body.iva != null ? body.iva : 0,
    observacoes: body.observacoes,
  };
  if (body.numero) dados.numero = body.numero;
  if (body.estado) dados.estado = body.estado;
  if (body.validade != null) dados.validade = body.validade;
  if (body.data_emissao) dados.data_emissao = body.data_emissao;
  Object.keys(dados).forEach((k) => {
    if (dados[k] === undefined) delete dados[k];
  });
  return dados;
}

function normalizarItens(itens) {
  return (itens || [])
    .map((i) => {
      const quantidade = parseInt(i.quantidade, 10) || 0;
      const precoUnit = parseFloat(i.preco_unit != null ? i.preco_unit : i.valorUnitario) || 0;
      return {
        descricao: i.descricao,
        quantidade,
        preco_unit: precoUnit,
        total: quantidade * precoUnit,
      };
    })
    .filter((i) => i.descricao && String(i.descricao).trim());
}

function serializar(o) {
  const cli = o.cliente || {};
  const itens = (o.orcamento_items || o.itens || []).map((i) => ({
    id: i.id,
    descricao: i.descricao,
    quantidade: Number(i.quantidade) || 0,
    valorUnitario: Number(i.preco_unit) || 0,
    total: Number(i.total) || 0,
  }));
  return {
    id: o.id,
    cliente_id: cli.id || o.cliente_id,
    numero: o.numero,
    data: o.data_emissao,
    validade: o.validade,
    estado: o.estado,
    cliente: {
      id: cli.id,
      nome: cli.nome || "",
      empresa: cli.empresa || "",
      nif: cli.nif || "",
      telefone: cli.telefone || "",
      email: cli.email || "",
    },
    especificacao: {
      produto: o.produto || "",
      formato: o.formato || "",
      papel: o.papel || "",
      impressao: o.impressao || "",
      impressão: o.impressao || "",
      acabamento: o.acabamento || "",
    },
    itens,
    subtotal: Number(o.total_sem_iva) || 0,
    iva: Number(o.iva) || 0,
    valorIva: Number(o.total_iva) || 0,
    total: Number(o.total_com_iva) || 0,
    prazoExecucao: o.prazo_execucao,
    condicoesPagamento: o.condicoes_pagamento,
    observacoes: o.observacoes,
  };
}

async function proximoNumero(organizacao_id) {
  return sequelize.transaction(async (t) => {
    await sequelize.query(
      `INSERT INTO sequencia (organizacao_id, numero) VALUES (?, 1)
       ON DUPLICATE KEY UPDATE numero = numero`,
      { replacements: [organizacao_id], transaction: t }
    );
    const [rows] = await sequelize.query(
      `SELECT numero FROM sequencia WHERE organizacao_id = ? FOR UPDATE`,
      { replacements: [organizacao_id], transaction: t }
    );
    const novo = Number(rows[0]?.numero || 0) + 1;
    await sequelize.query(
      `UPDATE sequencia SET numero = ? WHERE organizacao_id = ?`,
      { replacements: [novo, organizacao_id], transaction: t }
    );
    return `ORC-${String(novo).padStart(4, "0")}`;
  });
}

exports.listar = async (req, res) => {
  try {
    const { estado } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    const orcamentos = await Orcamento.findAll({
      where,
      include: [Cliente, OrcamentoItem],
      order: [["createdAt", "DESC"]],
    });
    return res.json(orcamentos.map(serializar));
  } catch (e) {
    console.error("Erro ao listar orçamentos:", e);
    return res.status(500).json({ erro: "Erro ao listar orçamentos" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const orcamento = await Orcamento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [Cliente, OrcamentoItem],
    });
    if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado" });
    return res.json(serializar(orcamento));
  } catch (e) {
    console.error("Erro ao buscar orçamento:", e);
    return res.status(500).json({ erro: "Erro ao buscar orçamento" });
  }
};

exports.criar = async (req, res) => {
  try {
    const validacao = validador.criar(req.body);
    if (validacao.erro) return res.status(422).json({ erro: validacao.erro });
    if (req.body.estado && !ESTADOS.includes(req.body.estado)) return res.status(422).json({ erro: "Estado inválido" });
    const dados = normalizarDados(req.body);
    const numero = dados.numero || (await proximoNumero(req.organizacao_id));
    const orcamento = await Orcamento.create({
      ...dados,
      numero,
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
    });
    const items = normalizarItens(req.body.itens);
    if (items.length) {
      await OrcamentoItem.bulkCreate(items.map((i) => ({ ...i, orcamento_id: orcamento.id })));
    }
    await recalcularTotais(orcamento.id);
    const completo = await Orcamento.findByPk(orcamento.id, { include: [Cliente, OrcamentoItem] });
    return res.status(201).json(serializar(completo));
  } catch (e) {
    console.error("Erro ao criar orçamento:", e);
    return res.status(500).json({ erro: "Erro ao criar orçamento" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const orcamento = await Orcamento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado" });
    if (req.body.estado && !ESTADOS.includes(req.body.estado)) return res.status(422).json({ erro: "Estado inválido" });
    const dados = normalizarDados(req.body);
    delete dados.numero;
    await orcamento.update(dados);
    if (req.body.itens) {
      await OrcamentoItem.destroy({ where: { orcamento_id: orcamento.id } });
      const items = normalizarItens(req.body.itens);
      if (items.length) {
        await OrcamentoItem.bulkCreate(items.map((i) => ({ ...i, orcamento_id: orcamento.id })));
      }
    }
    await recalcularTotais(orcamento.id);
    const completo = await Orcamento.findByPk(orcamento.id, { include: [Cliente, OrcamentoItem] });
    return res.json(serializar(completo));
  } catch (e) {
    console.error("Erro ao atualizar orçamento:", e);
    return res.status(500).json({ erro: "Erro ao atualizar orçamento" });
  }
};

exports.remover = async (req, res) => {
  try {
    const orcamento = await Orcamento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado" });
    await OrcamentoItem.destroy({ where: { orcamento_id: orcamento.id } });
    await orcamento.destroy();
    return res.json({ mensagem: "Orçamento removido com sucesso" });
  } catch (e) {
    console.error("Erro ao remover orçamento:", e);
    return res.status(500).json({ erro: "Erro ao remover orçamento" });
  }
};

async function recalcularTotais(orcamentoId) {
  const itens = await OrcamentoItem.findAll({ where: { orcamento_id: orcamentoId } });
  const totalSemIva = itens.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const orcamento = await Orcamento.findByPk(orcamentoId);
  const ivaPct = parseFloat(orcamento.iva || 0);
  const totalIva = totalSemIva * (ivaPct / 100);
  await orcamento.update({
    total_sem_iva: totalSemIva,
    total_iva: Number(totalIva.toFixed(2)),
    total_com_iva: Number((totalSemIva + totalIva).toFixed(2)),
  });
}
