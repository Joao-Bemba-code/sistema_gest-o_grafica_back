const { sequelize, Orcamento, OrcamentoItem, OrcamentoMaterial, OrcamentoServico, Cliente, Sequencia } = require("../models");
const { Transaction } = require("sequelize");
const validador = require("../validators/orcamento");

const ESTADOS = ["pendente", "aprovado", "cancelado", "rejeitado"];

function includeCompleto() {
  return [
    { model: Cliente, required: false },
    { model: OrcamentoItem, required: false, include: [{ model: OrcamentoMaterial, as: "materiais", required: false }] },
    { model: OrcamentoServico, as: "servicos", required: false },
  ];
}

function valorLegadoEspec(spec) {
  const ler = (chaves) => {
    for (const k of chaves) {
      const v = spec[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v);
    }
    return undefined;
  };
  return {
    produto: ler(["produto", "Produto"]),
    formato: ler(["formato", "Formato"]),
    papel: ler(["papel", "Papel", "papel/material", "Papel/Material", "Material"]),
    impressao: ler(["impressao", "Impressao", "impressão", "Impressão", "Tipo de impressão", "Tipo de impressão *"]),
    acabamento: ler(["acabamento", "Acabamento"]),
  };
}

function normalizarDados(body) {
  const spec = body.especificacao && typeof body.especificacao === "object" ? body.especificacao : {};
  const dados = {
    cliente_id: body.cliente_id,
    prazo_execucao: body.prazoExecucao,
    condicoes_pagamento: body.condicoesPagamento,
    iva: body.iva != null ? body.iva : 0,
    desconto: body.desconto != null ? body.desconto : 0,
    observacoes: body.observacoes,
  };
  if (Object.keys(spec).length) dados.especificacao_json = spec;
  const legado = valorLegadoEspec(spec);
  Object.keys(legado).forEach((k) => {
    if (legado[k] !== undefined) dados[k] = legado[k];
  });
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
      const materiais = (i.materiais || [])
        .map((m) => {
          const qtd = parseFloat(m.quantidade) || 0;
          const custoUnit = parseFloat(m.custo_unit) || 0;
          return {
            material_id: m.material_id || null,
            descricao: String(m.descricao || "").trim() || "Material",
            unidade: m.unidade || "un",
            quantidade: qtd,
            custo_unit: custoUnit,
            custo_total: Number((qtd * custoUnit).toFixed(2)),
            mover_estoque: Boolean(m.mover_estoque),
          };
        })
        .filter((m) => m.material_id || m.descricao);
      return {
        descricao: i.descricao,
        quantidade,
        preco_unit: precoUnit,
        total: parseFloat(i.total) || (quantidade * precoUnit),
        composto: Boolean(i.composto),
        margem: parseFloat(i.margem) || 0,
        materiais,
      };
    })
    .filter((i) => i.descricao && String(i.descricao).trim());
}

function normalizarServicos(servicos) {
  return (servicos || [])
    .map((s) => {
      const mob = parseInt(s.mob, 10) || 1;
      const prazoExecucao = parseInt(s.prazoExecucao || s.prazo_execucao, 10) || 1;
      const duracaoHoras = prazoExecucao * 8;
      const valorHora = parseFloat(s.valor_hora) || 0;
      const total = mob * duracaoHoras * valorHora;
      return {
        servico_id: s.servico_id || null,
        descricao: String(s.descricao || "").trim() || "Serviço",
        mob,
        prazo_execucao: prazoExecucao,
        duracao_horas: duracaoHoras,
        valor_hora: valorHora,
        total: Number(total.toFixed(2)),
      };
    })
    .filter((s) => s.descricao);
}

function serializar(o) {
  const cli = o.cliente || {};
  const itens = (o.orcamento_items || o.itens || []).map((i) => ({
    id: i.id,
    descricao: i.descricao,
    quantidade: Number(i.quantidade) || 0,
    valorUnitario: Number(i.preco_unit) || 0,
    total: Number(i.total) || 0,
    composto: Boolean(i.composto),
    margem: Number(i.margem) || 0,
    materiais: (i.materiais || []).map((m) => ({
      id: m.id,
      material_id: m.material_id,
      descricao: m.descricao,
      unidade: m.unidade,
      quantidade: Number(m.quantidade) || 0,
      custo_unit: Number(m.custo_unit) || 0,
      custo_total: Number(m.custo_total) || 0,
      mover_estoque: Boolean(m.mover_estoque),
    })),
  }));
  const servicos = (o.orcamento_servicos || o.servicos || []).map((s) => ({
    id: s.id,
    descricao: s.descricao,
    mob: Number(s.mob) || 1,
    prazoExecucao: Number(s.prazo_execucao) || 1,
    duracaoHoras: Number(s.duracao_horas) || 0,
    valorHora: Number(s.valor_hora) || 0,
    total: Number(s.total) || 0,
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
      ...(o.especificacao_json && typeof o.especificacao_json === "object" ? o.especificacao_json : {}),
      produto: o.produto || "",
      formato: o.formato || "",
      papel: o.papel || "",
      impressao: o.impressao || "",
      impressão: o.impressao || "",
      acabamento: o.acabamento || "",
    },
    itens,
    servicos,
    subtotal: Number(o.total_sem_iva) || 0,
    desconto: Number(o.desconto) || 0,
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
    const lock = sequelize.getDialect() === "mysql" ? Transaction.LOCK.UPDATE : undefined;
    let seq = await Sequencia.findOne({ where: { organizacao_id }, transaction: t, lock });
    if (!seq) {
      seq = await Sequencia.create({ organizacao_id, numero: 1 }, { transaction: t });
      return "ORC-0001";
    }
    const novo = Number(seq.numero || 0) + 1;
    await seq.update({ numero: novo }, { transaction: t });
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
      include: includeCompleto(),
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
      include: includeCompleto(),
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
      const criados = await OrcamentoItem.bulkCreate(items.map((i) => ({ ...i, orcamento_id: orcamento.id })));
      const materiais = [];
      criados.forEach((itemDb, idx) => {
        for (const m of items[idx].materiais || []) {
          materiais.push({ ...m, orcamento_item_id: itemDb.id });
        }
      });
      if (materiais.length) await OrcamentoMaterial.bulkCreate(materiais);
    }
    if (req.body.servicos && req.body.servicos.length) {
      const servicos = normalizarServicos(req.body.servicos);
      if (servicos.length) await OrcamentoServico.bulkCreate(servicos.map((s) => ({ ...s, orcamento_id: orcamento.id })));
    }
    await recalcularTotais(orcamento.id);
    const completo = await Orcamento.findByPk(orcamento.id, { include: includeCompleto() });
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
      const idsItens = (await OrcamentoItem.findAll({ where: { orcamento_id: orcamento.id }, attributes: ["id"] })).map((i) => i.id);
      if (idsItens.length) await OrcamentoMaterial.update({ deleted: 1, deletedAt: new Date() }, { where: { orcamento_item_id: idsItens } });
      await OrcamentoItem.update({ deleted: 1, deletedAt: new Date() }, { where: { orcamento_id: orcamento.id } });
      const items = normalizarItens(req.body.itens);
      if (items.length) {
        const criados = await OrcamentoItem.bulkCreate(items.map((i) => ({ ...i, orcamento_id: orcamento.id })));
        const materiais = [];
        criados.forEach((itemDb, idx) => {
          for (const m of items[idx].materiais || []) {
            materiais.push({ ...m, orcamento_item_id: itemDb.id });
          }
        });
        if (materiais.length) await OrcamentoMaterial.bulkCreate(materiais);
      }
    }
    if (req.body.servicos !== undefined) {
      await OrcamentoServico.update({ deleted: 1, deletedAt: new Date() }, { where: { orcamento_id: orcamento.id } });
      const servicos = normalizarServicos(req.body.servicos);
      if (servicos.length) await OrcamentoServico.bulkCreate(servicos.map((s) => ({ ...s, orcamento_id: orcamento.id })));
    }
    await recalcularTotais(orcamento.id);
    const completo = await Orcamento.findByPk(orcamento.id, { include: includeCompleto() });
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
    const idsItens = (await OrcamentoItem.findAll({ where: { orcamento_id: orcamento.id }, attributes: ["id"] })).map((i) => i.id);
    if (idsItens.length) await OrcamentoMaterial.update({ deleted: 1, deletedAt: new Date() }, { where: { orcamento_item_id: idsItens } });
    await OrcamentoItem.update({ deleted: 1, deletedAt: new Date() }, { where: { orcamento_id: orcamento.id } });
    await OrcamentoServico.update({ deleted: 1, deletedAt: new Date() }, { where: { orcamento_id: orcamento.id } });
    await orcamento.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Orçamento removido com sucesso" });
  } catch (e) {
    console.error("Erro ao remover orçamento:", e);
    return res.status(500).json({ erro: "Erro ao remover orçamento" });
  }
};

async function recalcularTotais(orcamentoId) {
  const itens = await OrcamentoItem.findAll({ where: { orcamento_id: orcamentoId } });
  const servicos = await OrcamentoServico.findAll({ where: { orcamento_id: orcamentoId } });
  const totalItens = itens.reduce((s, i) => s + parseFloat(i.total || 0), 0);
  const totalServicos = servicos.reduce((s, sv) => s + parseFloat(sv.total || 0), 0);
  const totalSemIva = totalItens + totalServicos;
  const orcamento = await Orcamento.findByPk(orcamentoId);
  const desconto = parseFloat(orcamento.desconto || 0);
  const totalPosDesconto = Math.max(0, totalSemIva - desconto);
  const ivaPct = parseFloat(orcamento.iva || 0);
  const totalIva = totalPosDesconto * (ivaPct / 100);
  await orcamento.update({
    total_sem_iva: totalSemIva,
    total_iva: Number(totalIva.toFixed(2)),
    total_com_iva: Number((totalPosDesconto + totalIva).toFixed(2)),
  });
}
