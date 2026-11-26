const { sequelize, Pedido, PedidoItem, Material, MovimentoEstoque, Sequencia, Sistema, TesourariaMovimento, ContaBancaria } = require("../models");
const { Transaction } = require("sequelize");
const notificacoesService = require("../services/notificacoes");

const ESTADOS = ["pendente", "aprovado", "enviado", "recebido", "rejeitado", "cancelado"];
const METODOS_PAGAMENTO = ["dinheiro", "transferencia", "deposito", "ordem_saida", "multicaixa", "referencia", "cheque", "tpa"];

function parseNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/[^\d,.\-]/g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function isoDe(d) {
  return d.toISOString().slice(0, 10);
}

function hojeISO() {
  return isoDe(new Date());
}

function vencimentoPadrao() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return isoDe(d);
}

// Nenhuma compra pode ser registada sem preço: valida antes de normalizar,
// para que um preço ausente não seja convertido silenciosamente em zero.
function validarPrecos(itens) {
  const invalidos = [];
  (Array.isArray(itens) ? itens : []).forEach((i, idx) => {
    if (!i.material_id && !String(i.material_nome || "").trim()) return; // linha vazia
    const preco = parseNum(i.preco_unit != null ? i.preco_unit : i.preco);
    if (!(preco > 0)) invalidos.push(String(i.material_nome || i.material_codigo || i.material_id || idx + 1));
  });
  return invalidos.length
    ? `Informe o preço unitário de todos os materiais: ${invalidos.join(", ")}.`
    : null;
}

function normalizarItens(itens, materiaisPorId) {
  return (itens || [])
    .map((i) => {
      const mat = materiaisPorId[String(i.material_id)] || {};
      const quantidade = parseNum(i.quantidade);
      const precoUnit = parseNum(i.preco_unit != null ? i.preco_unit : i.preco);
      return {
        material_id: mat.id || i.material_id || null,
        material_codigo: mat.codigo || i.material_codigo || "",
        material_nome: mat.nome || String(i.material_nome || "").trim(),
        unidade: mat.unidade || i.unidade || "un",
        quantidade,
        preco_unit: precoUnit,
        total: Number((quantidade * precoUnit).toFixed(2)),
      };
    })
    .filter((i) => i.material_nome && i.quantidade > 0);
}

// Um pagamento de fornecedor gera uma saída na Tesouraria e baixa o saldo da
// conta indicada. Chamado tanto no pagamento à vista como no crédito.
async function lancarPagamento({ pedido, req, t, valor, contaId, metodo, dataPagamento, observacoes }) {
  const movimento = await TesourariaMovimento.create(
    {
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      tipo: "saida",
      categoria: "compra",
      descricao: `Pagamento da encomenda ${pedido.numero} — ${pedido.fornecedor_nome}`,
      valor,
      data_movimento: dataPagamento,
      hora_movimento: new Date().toTimeString().split(" ")[0],
      referencia: String(pedido.numero),
      referencia_tipo: "outro",
      referencia_id: pedido.id,
      conta_bancaria_id: contaId || null,
      metodo_pagamento: metodo,
      estado: "confirmado",
      observacoes: observacoes || `Pagamento da encomenda ${pedido.numero} (pedido #${pedido.id})`,
    },
    { transaction: t }
  );

  if (contaId) {
    const conta = await ContaBancaria.findOne({
      where: { id: contaId, organizacao_id: req.organizacao_id },
      transaction: t,
    });
    if (conta) {
      const saldo = Number((Number(conta.saldo_atual || 0) - valor).toFixed(2));
      await conta.update({ saldo_atual: saldo }, { transaction: t });
    }
  }

  const valorPago = Number((Number(pedido.valor_pago || 0) + valor).toFixed(2));
  await pedido.update(
    {
      valor_pago: valorPago,
      data_pagamento: dataPagamento,
      metodo_pagamento: metodo,
      conta_bancaria_id: contaId || pedido.conta_bancaria_id || null,
    },
    { transaction: t }
  );
  return movimento;
}

function serializar(p) {
  const itens = (p.pedido_items || []).map((i) => ({
    id: i.id,
    material_id: i.material_id,
    codigo: i.material_codigo,
    nome: i.material_nome,
    unidade: i.unidade,
    quantidade: Number(i.quantidade) || 0,
    preco_unit: Number(i.preco_unit) || 0,
    total: Number(i.total) || 0,
    quantidade_recebida: Number(i.quantidade_recebida) || 0,
  }));
  return {
    id: p.id,
    numero: p.numero,
    fornecedor_id: p.fornecedor_id,
    fornecedor_nome: p.fornecedor_nome,
    estado: p.estado,
    observacoes: p.observacoes,
    solicitado_por: p.solicitado_por,
    aprovado_por: p.aprovado_por,
    data_aprovacao: p.data_aprovacao,
    motivo_rejeicao: p.motivo_rejeicao || "",
    data_envio: p.data_envio,
    data_pedido: p.data_pedido || p.createdAt,
    data_recebimento: p.data_recebimento,
    total: Number(p.total) || 0,
    forma_pagamento: p.forma_pagamento || "a_vista",
    data_vencimento: p.data_vencimento || null,
    valor_pago: Number(p.valor_pago) || 0,
    saldo: Math.max(0, Number((Number(p.total) || 0) - (Number(p.valor_pago) || 0)).toFixed(2)),
    pago: Number((Number(p.total) || 0) - (Number(p.valor_pago) || 0)) <= 0.005,
    data_pagamento: p.data_pagamento || null,
    metodo_pagamento: p.metodo_pagamento || null,
    conta_bancaria_id: p.conta_bancaria_id || null,
    itens,
    pendente: itens.some((i) => i.quantidade_recebida < i.quantidade),
  };
}

async function proximoNumero(organizacao_id) {
  return sequelize.transaction(async (t) => {
    const lock = sequelize.getDialect() === "mysql" ? Transaction.LOCK.UPDATE : undefined;
    let seq = await Sequencia.findOne({ where: { organizacao_id }, transaction: t, lock });
    if (!seq) {
      seq = await Sequencia.create({ organizacao_id, numero: 1 }, { transaction: t });
      return "KPED-0001";
    }
    const novo = Number(seq.numero || 0) + 1;
    await seq.update({ numero: novo }, { transaction: t });
    return `KPED-${String(novo).padStart(4, "0")}`;
  });
}

async function carregarMateriaisPorId(ids, organizacaoId) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  if (!unicos.length) return {};
  // Sem filtro de organização, um pedido podia usar materiais (nome, preço,
  // unidade) de outra empresa.
  const materiais = await Material.findAll({
    where: { id: unicos, organizacao_id: organizacaoId },
  });
  const mapa = {};
  materiais.forEach((m) => {
    mapa[String(m.id)] = m;
  });
  return mapa;
}

exports.listar = async (req, res) => {
  try {
    const { estado } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    const pedidos = await Pedido.findAll({
      where,
      include: [{ model: PedidoItem, required: false }],
      order: [["createdAt", "DESC"]],
    });
    return res.json(pedidos.map(serializar));
  } catch (e) {
    console.error("Erro ao listar pedidos:", e);
    return res.status(500).json({ erro: "Erro ao listar pedidos" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    return res.json(serializar(pedido));
  } catch (e) {
    console.error("Erro ao buscar pedido:", e);
    return res.status(500).json({ erro: "Erro ao buscar pedido" });
  }
};

exports.criar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      fornecedor_id, fornecedor_nome, itens, observacoes, solicitado_por, data_pedido,
      forma_pagamento, data_vencimento, metodo_pagamento, conta_bancaria_id,
    } = req.body;
    if (!fornecedor_nome || !String(fornecedor_nome).trim()) {
      await t.rollback();
      return res.status(422).json({ erro: "Informe o fornecedor do pedido" });
    }
    const erroPreco = validarPrecos(itens);
    if (erroPreco) {
      await t.rollback();
      return res.status(422).json({ erro: erroPreco });
    }
    const forma = forma_pagamento === "credito" ? "credito" : "a_vista";
    const vencimento = data_vencimento || (forma === "credito" ? vencimentoPadrao() : null);
    const metodo = METODOS_PAGAMENTO.includes(metodo_pagamento) ? metodo_pagamento : null;
    const contaId = conta_bancaria_id || null;
    if (contaId) {
      const conta = await ContaBancaria.findOne({
        where: { id: contaId, organizacao_id: req.organizacao_id },
        transaction: t,
      });
      if (!conta) {
        await t.rollback();
        return res.status(422).json({ erro: "Conta bancária inválida" });
      }
    }
    const materiaisPorId = await carregarMateriaisPorId(
      (itens || []).map((i) => i.material_id),
      req.organizacao_id
    );
    const normalizados = normalizarItens(itens, materiaisPorId);
    if (!normalizados.length) {
      await t.rollback();
      return res.status(422).json({ erro: "Adicione pelo menos um material com quantidade" });
    }
    const numero = await proximoNumero(req.organizacao_id);
    const total = Number(normalizados.reduce((s, i) => s + i.total, 0).toFixed(2));

    // Alçada de compras: acima do limiar a encomenda fica "pendente" e só é
    // encomendada (estado "enviado") depois de aprovada.
    const sistema = await Sistema.findOne({ where: { organizacao_id: req.organizacao_id } });
    const exigeAprovacao = !!(sistema && sistema.compras_exige_aprovacao);
    const limiteAlcada = sistema ? Number(sistema.compras_alcada_valor) || 0 : 0;
    const requerAprovacao = exigeAprovacao && total > limiteAlcada;

    const pedido = await Pedido.create(
      {
        numero,
        organizacao_id: req.organizacao_id,
        fornecedor_id: fornecedor_id || null,
        fornecedor_nome: String(fornecedor_nome).trim(),
        estado: requerAprovacao ? "pendente" : "enviado",
        observacoes: observacoes || null,
        solicitado_por: solicitado_por || null,
        data_pedido: data_pedido || new Date(),
        data_envio: requerAprovacao ? null : new Date(),
        total,
        forma_pagamento: forma,
        data_vencimento: vencimento,
        conta_bancaria_id: forma === "a_vista" ? contaId : null,
        usuario_id: req.usuario.id,
      },
      { transaction: t }
    );
    await PedidoItem.bulkCreate(
      normalizados.map((i) => ({ ...i, pedido_id: pedido.id })),
      { transaction: t }
    );
    if (forma === "a_vista" && total > 0) {
      await lancarPagamento({
        pedido,
        req,
        t,
        valor: total,
        contaId,
        metodo: metodo || "dinheiro",
        dataPagamento: hojeISO(),
        observacoes: `Pagamento à vista da encomenda ${numero}`,
      });
    }
    await t.commit();
    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "estoque",
        nivel: requerAprovacao ? "warning" : "info",
        icone: requerAprovacao ? "hourglass_top" : "local_shipping",
        titulo: `Encomenda ${numero} ${requerAprovacao ? "aguarda aprovação" : "enviada"}`,
        descricao: `${normalizados.length} material(is) para ${String(fornecedor_nome).trim()} · ${Number(total.toFixed(2))} Kz`,
        link: "/compras",
        usuarioId: req.usuario.id,
      });
    } catch (e) {
      console.error("Erro ao notificar encomenda:", e);
    }
    const completo = await Pedido.findByPk(pedido.id, { include: [{ model: PedidoItem, required: false }] });
    return res.status(201).json(serializar(completo));
  } catch (e) {
    await t.rollback();
    console.error("Erro ao criar pedido:", e);
    return res.status(500).json({ erro: "Erro ao criar pedido" });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.estado === "recebido") {
      return res.status(422).json({ erro: "Não é possível cancelar um pedido já recebido" });
    }
    await pedido.update({ estado: "cancelado" });
    return res.json(serializar(pedido));
  } catch (e) {
    console.error("Erro ao cancelar pedido:", e);
    return res.status(500).json({ erro: "Erro ao cancelar pedido" });
  }
};

// Aprovação por alçada. A encomenda está "pendente" até ser aprovada; acima do
// limiar superior a aprovação só pode ser dada pela Administração/Gestão.
exports.aprovar = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.estado !== "pendente") {
      return res.status(422).json({ erro: `Só é possível aprovar encomendas pendentes (actual: ${pedido.estado})` });
    }
    const sistema = await Sistema.findOne({ where: { organizacao_id: req.organizacao_id } });
    const superior = sistema ? Number(sistema.compras_alcada_valor_superior) || 0 : 0;
    const total = Number(pedido.total) || 0;
    const exigeNivelSuperior = superior > 0 && total > superior;
    if (exigeNivelSuperior && !["admin", "gestao"].includes(req.usuario?.perfil)) {
      return res.status(403).json({ erro: "Esta encomenda está acima da alçada — só pode ser aprovada pela Administração/Gestão." });
    }
    await pedido.update({
      estado: "aprovado",
      aprovado_por: req.usuario?.nome || null,
      data_aprovacao: new Date(),
      motivo_rejeicao: null,
    });
    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "estoque",
        nivel: "success",
        icone: "verified",
        titulo: `Encomenda ${pedido.numero} aprovada`,
        descricao: `Aprovada por ${req.usuario?.nome || "Gestão"} · ${total} Kz. Já pode ser enviada ao fornecedor.`,
        link: "/compras",
        usuarioId: req.usuario?.id || null,
      });
    } catch (e) {
      console.error("Erro ao notificar aprovação da encomenda:", e);
    }
    return res.json(serializar(pedido));
  } catch (e) {
    console.error("Erro ao aprovar pedido:", e);
    return res.status(500).json({ erro: "Erro ao aprovar pedido" });
  }
};

exports.rejeitar = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.estado !== "pendente") {
      return res.status(422).json({ erro: `Só é possível rejeitar encomendas pendentes (actual: ${pedido.estado})` });
    }
    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(422).json({ erro: "Indique o motivo da rejeição" });
    await pedido.update({
      estado: "rejeitado",
      motivo_rejeicao: motivo.slice(0, 400),
      aprovado_por: req.usuario?.nome || null,
      data_aprovacao: new Date(),
    });
    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "estoque",
        nivel: "error",
        icone: "cancel",
        titulo: `Encomenda ${pedido.numero} rejeitada`,
        descricao: `Recusada por ${req.usuario?.nome || "Gestão"}. Motivo: ${motivo.slice(0, 400)}.`,
        link: "/compras",
        usuarioId: req.usuario?.id || null,
      });
    } catch (e) {
      console.error("Erro ao notificar rejeição da encomenda:", e);
    }
    const completo = await Pedido.findByPk(pedido.id, { include: [{ model: PedidoItem, required: false }] });
    return res.json(serializar(completo));
  } catch (e) {
    console.error("Erro ao rejeitar pedido:", e);
    return res.status(500).json({ erro: "Erro ao rejeitar pedido" });
  }
};

// Encomendar = enviar ao fornecedor. Só é possível depois da aprovação.
exports.enviar = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.estado !== "aprovado") {
      return res.status(422).json({ erro: "Só é possível encomendar ao fornecedor depois da aprovação" });
    }
    await pedido.update({ estado: "enviado", data_envio: new Date() });
    return res.json(serializar(pedido));
  } catch (e) {
    console.error("Erro ao enviar pedido:", e);
    return res.status(500).json({ erro: "Erro ao enviar pedido" });
  }
};

exports.receber = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
      transaction: t,
    });
    if (!pedido) {
      await t.rollback();
      return res.status(404).json({ erro: "Pedido não encontrado" });
    }
    if (pedido.estado === "cancelado") {
      await t.rollback();
      return res.status(422).json({ erro: "Não é possível receber um pedido cancelado" });
    }
    if (pedido.estado !== "enviado") {
      await t.rollback();
      return res.status(422).json({ erro: "Só é possível receber encomendas enviadas ao fornecedor" });
    }
    const recebimentos = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!recebimentos.length) {
      await t.rollback();
      return res.status(422).json({ erro: "Informe os itens a receber" });
    }
    const itens = pedido.pedido_items || [];
    let recebeuAlgo = false;
    let completo = true;
    for (const r of recebimentos) {
      const item = itens.find((i) => i.id === Number(r.id));
      if (!item) continue;
      const novo = parseNum(r.quantidade);
      if (!novo || novo <= 0) continue;
      const jaRecebido = parseFloat(item.quantidade_recebida) || 0;
      const limite = parseFloat(item.quantidade) || 0;
      const aceite = Math.min(novo, Math.max(0, limite - jaRecebido));
      if (aceite <= 0) continue;
      const material = await Material.findOne({
        where: { id: item.material_id, organizacao_id: req.organizacao_id },
        transaction: t,
      });
      if (material) {
        await material.update({ quantidade: parseFloat(material.quantidade) + aceite }, { transaction: t });
      }
      await MovimentoEstoque.create(
        {
          organizacao_id: req.organizacao_id,
          material_id: item.material_id,
          tipo: "entrada",
          quantidade: aceite,
          referencia_tipo: "pedido",
          referencia_id: pedido.id,
          lote: r.lote || null,
          motivo: `Recebimento do pedido ${pedido.numero}`,
          observacoes: null,
          fornecedor_nome: pedido.fornecedor_nome,
          solicitado_por: pedido.solicitado_por,
          usuario_id: req.usuario.id,
        },
        { transaction: t }
      );
      await item.update({ quantidade_recebida: Number((jaRecebido + aceite).toFixed(2)) }, { transaction: t });
      recebeuAlgo = true;
    }
    if (!recebeuAlgo) {
      await t.rollback();
      return res.status(422).json({ erro: "Nenhuma quantidade válida para receber" });
    }
    completo = itens.every((i) => (parseFloat(i.quantidade_recebida) || 0) >= (parseFloat(i.quantidade) || 0));
    if (completo) {
      await pedido.update({ estado: "recebido", data_recebimento: new Date() }, { transaction: t });
    }
    await t.commit();
    const atualizado = await Pedido.findByPk(pedido.id, { include: [{ model: PedidoItem, required: false }] });
    return res.json(serializar(atualizado));
  } catch (e) {
    await t.rollback();
    console.error("Erro ao receber pedido:", e);
    return res.status(500).json({ erro: "Erro ao receber pedido" });
  }
};

// Pagamento posterior de uma compra a crédito. Lança a saída na tesouraria e
// atualiza o saldo da conta; aceita pagamentos parciais.
exports.pagar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem, required: false }],
      transaction: t,
    });
    if (!pedido) {
      await t.rollback();
      return res.status(404).json({ erro: "Pedido não encontrado" });
    }
    if (pedido.estado === "cancelado") {
      await t.rollback();
      return res.status(422).json({ erro: "Não é possível pagar uma encomenda cancelada" });
    }
    const saldo = Math.max(0, Number((Number(pedido.total || 0) - Number(pedido.valor_pago || 0)).toFixed(2)));
    if (saldo <= 0.005) {
      await t.rollback();
      return res.status(422).json({ erro: "Esta encomenda já está totalmente paga" });
    }

    const valor = req.body.valor === undefined || req.body.valor === null || req.body.valor === ""
      ? saldo
      : Number(req.body.valor);
    if (!(valor > 0)) {
      await t.rollback();
      return res.status(422).json({ erro: "O valor do pagamento deve ser maior que zero" });
    }
    if (valor > saldo + 0.005) {
      await t.rollback();
      return res.status(422).json({ erro: `O pagamento não pode ultrapassar ${saldo.toFixed(2)} Kz` });
    }

    const contaId = req.body.conta_bancaria_id || pedido.conta_bancaria_id || null;
    if (contaId) {
      const conta = await ContaBancaria.findOne({
        where: { id: contaId, organizacao_id: req.organizacao_id },
        transaction: t,
      });
      if (!conta) {
        await t.rollback();
        return res.status(422).json({ erro: "Conta bancária inválida" });
      }
    }
    const metodo = METODOS_PAGAMENTO.includes(req.body.metodo_pagamento)
      ? req.body.metodo_pagamento
      : pedido.metodo_pagamento || "transferencia";
    const dataPagamento = req.body.data_pagamento || hojeISO();

    const movimento = await lancarPagamento({
      pedido,
      req,
      t,
      valor,
      contaId,
      metodo,
      dataPagamento,
      observacoes: req.body.observacoes
        ? `Pagamento da encomenda ${pedido.numero} — ${String(req.body.observacoes).slice(0, 200)}`
        : undefined,
    });
    await t.commit();

    const atualizado = await Pedido.findByPk(pedido.id, { include: [{ model: PedidoItem, required: false }] });
    return res.json({
      pedido: serializar(atualizado),
      movimento: { id: movimento.id, valor: Number(movimento.valor), tipo: movimento.tipo },
      saldo: Math.max(0, Number((atualizado.total - atualizado.valor_pago).toFixed(2))),
    });
  } catch (e) {
    await t.rollback();
    console.error("Erro ao pagar encomenda:", e);
    return res.status(500).json({ erro: "Erro ao registar o pagamento da encomenda" });
  }
};
