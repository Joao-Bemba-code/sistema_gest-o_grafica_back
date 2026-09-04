const { TesourariaMovimento, ContaBancaria, Cliente, Faturacao, Usuario } = require("../models");
const { Op, fn, col, literal } = require("sequelize");

const ESTADOS = ["pendente", "confirmado", "cancelado"];
const TIPOS = ["entrada", "saida", "transferencia"];
const CATEGORIAS_ENTRADA = ["venda", "servico", "devolucao", "deposito"];
const CATEGORIAS_SAIDA = ["compra", "despesa", "salario", "imposto", "aluguel", "utilidades", "levantamento"];
const CATEGORIAS_TRANSFERENCIA = ["transferencia_interna"];

function resolverClienteId(body) {
  if (body.cliente_id) return body.cliente_id;
  return null;
}

exports.listar = async (req, res) => {
  try {
    const { tipo, categoria, estado, conta_id, data_inicio, data_fim, cliente_id } = req.query;
    const where = { organizacao_id: req.organizacao_id, deleted: false };
    if (tipo) where.tipo = tipo;
    if (categoria) where.categoria = categoria;
    if (estado) where.estado = estado;
    if (conta_id) where.conta_bancaria_id = conta_id;
    if (cliente_id) where.cliente_id = cliente_id;
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    const movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        { model: ContaBancaria, as: "conta", attributes: ["id", "banco_nome", "numero_conta", "tipo_conta"] },
        { model: Cliente, as: "cliente", attributes: ["id", "nome", "empresa"] },
        { model: Faturacao, as: "fatura", attributes: ["id", "numero", "total"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
      order: [["data_movimento", "DESC"], ["createdAt", "DESC"]],
    });
    return res.json(movimentos);
  } catch (e) {
    console.error("Erro ao listar movimentos:", e);
    return res.status(500).json({ erro: "Erro ao listar movimentos de tesouraria" });
  }
};

exports.buscar = async (req, res) => {
  try {
    const movimento = await TesourariaMovimento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [
        { model: ContaBancaria, as: "conta" },
        { model: Cliente, as: "cliente" },
        { model: Faturacao, as: "fatura" },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
        { model: Usuario, as: "aprovador", attributes: ["id", "nome"] },
      ],
    });
    if (!movimento) return res.status(404).json({ erro: "Movimento não encontrado" });
    return res.json(movimento);
  } catch (e) {
    console.error("Erro ao buscar movimento:", e);
    return res.status(500).json({ erro: "Erro ao buscar movimento" });
  }
};

exports.criar = async (req, res) => {
  try {
    const {
      tipo, categoria, descricao, valor, data_movimento, hora_movimento,
      referencia, referencia_tipo, referencia_id, cliente_id, fatura_id,
      conta_bancaria_id, conta_destino_id, metodo_pagamento, comprovativo,
      estado, observacoes,
    } = req.body;

    if (!tipo || !TIPOS.includes(tipo)) return res.status(400).json({ erro: "Tipo de movimento inválido" });
    if (!descricao || !String(descricao).trim()) return res.status(400).json({ erro: "Descrição é obrigatória" });
    const valorNum = parseFloat(valor);
    if (!valorNum || valorNum <= 0) return res.status(400).json({ erro: "Valor deve ser maior que zero" });

    if (categoria) {
      const categoriasValidas = tipo === "entrada" ? CATEGORIAS_ENTRADA
        : tipo === "saida" ? CATEGORIAS_SAIDA
        : CATEGORIAS_TRANSFERENCIA;
      if (!categoriasValidas.includes(categoria)) {
        return res.status(400).json({ erro: `Categoria "${categoria}" não é válida para o tipo "${tipo}"` });
      }
    }

    const movimento = await TesourariaMovimento.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      tipo,
      categoria: categoria || (tipo === "entrada" ? "venda" : tipo === "saida" ? "despesa" : "transferencia_interna"),
      descricao: String(descricao).trim(),
      valor: valorNum,
      data_movimento: data_movimento || new Date().toISOString().split("T")[0],
      hora_movimento: hora_movimento || new Date().toTimeString().split(" ")[0],
      referencia: referencia || null,
      referencia_tipo: referencia_tipo || null,
      referencia_id: referencia_id || null,
      cliente_id: resolverClienteId(req.body),
      fatura_id: fatura_id || null,
      conta_bancaria_id: conta_bancaria_id || null,
      conta_destino_id: conta_destino_id || null,
      metodo_pagamento: metodo_pagamento || null,
      comprovativo: comprovativo || null,
      estado: ESTADOS.includes(estado) ? estado : "confirmado",
      observacoes: observacoes || null,
    });

    if (conta_bancaria_id && movimento.estado === "confirmado") {
      const conta = await ContaBancaria.findByPk(conta_bancaria_id);
      if (conta) {
        const novoSaldo = tipo === "entrada"
          ? Number(conta.saldo_atual) + valorNum
          : Number(conta.saldo_atual) - valorNum;
        await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }

    if (tipo === "transferencia" && conta_destino_id && movimento.estado === "confirmado") {
      const contaDest = await ContaBancaria.findByPk(conta_destino_id);
      if (contaDest) {
        const novoSaldo = Number(contaDest.saldo_atual) + valorNum;
        await contaDest.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }

    const completa = await TesourariaMovimento.findByPk(movimento.id, {
      include: [
        { model: ContaBancaria, as: "conta" },
        { model: Cliente, as: "cliente" },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
    });
    return res.status(201).json(completa);
  } catch (e) {
    console.error("Erro ao criar movimento:", e?.message || e);
    if (e?.original) console.error("DB Error:", e.original.code, e.original.sqlMessage);
    return res.status(500).json({ erro: "Erro ao criar movimento" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const movimento = await TesourariaMovimento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!movimento) return res.status(404).json({ erro: "Movimento não encontrado" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.usuario_id;
    if (dados.tipo && !TIPOS.includes(dados.tipo)) delete dados.tipo;
    if (dados.estado && !ESTADOS.includes(dados.estado)) delete dados.estado;
    await movimento.update(dados);
    const completa = await TesourariaMovimento.findByPk(movimento.id, {
      include: [
        { model: ContaBancaria, as: "conta" },
        { model: Cliente, as: "cliente" },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
    });
    return res.json(completa);
  } catch (e) {
    console.error("Erro ao atualizar movimento:", e);
    return res.status(500).json({ erro: "Erro ao atualizar movimento" });
  }
};

exports.remover = async (req, res) => {
  try {
    const movimento = await TesourariaMovimento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!movimento) return res.status(404).json({ erro: "Movimento não encontrado" });
    if (movimento.estado === "confirmado" && movimento.conta_bancaria_id) {
      const conta = await ContaBancaria.findByPk(movimento.conta_bancaria_id);
      if (conta) {
        const novoSaldo = movimento.tipo === "entrada"
          ? Number(conta.saldo_atual) - Number(movimento.valor)
          : Number(conta.saldo_atual) + Number(movimento.valor);
        await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }
    await movimento.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Movimento removido com sucesso" });
  } catch (e) {
    console.error("Erro ao remover movimento:", e);
    return res.status(500).json({ erro: "Erro ao remover movimento" });
  }
};

exports.resumo = async (req, res) => {
  try {
    const org = req.organizacao_id;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0];
    const inicioAno = new Date(hoje.getFullYear(), 0, 1).toISOString().split("T")[0];
    const fimAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split("T")[0];

    const whereBase = { organizacao_id: org, estado: "confirmado" };

    const [entradasMes, saidasMes, entradasAno, saidasAno, totalContas] = await Promise.all([
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "entrada", data_movimento: { [Op.between]: [inicioMes, fimMes] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "saida", data_movimento: { [Op.between]: [inicioMes, fimMes] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "entrada", data_movimento: { [Op.between]: [inicioAno, fimAno] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "saida", data_movimento: { [Op.between]: [inicioAno, fimAno] } },
      }),
      ContaBancaria.sum("saldo_atual", {
        where: { organizacao_id: org, ativo: true },
      }),
    ]);

    const contas = await ContaBancaria.findAll({
      where: { organizacao_id: org, ativo: true },
      attributes: ["id", "banco_nome", "numero_conta", "saldo_atual", "tipo_conta", "favorita"],
    });

    const movimentosHoje = await TesourariaMovimento.count({
      where: { ...whereBase, data_movimento: hoje.toISOString().split("T")[0] },
    });

    return res.json({
      saldoTotal: Number(totalContas || 0),
      entradasMes: Number(entradasMes || 0),
      saidasMes: Number(saidasMes || 0),
      saldoMes: Number((entradasMes || 0) - (saidasMes || 0)),
      entradasAno: Number(entradasAno || 0),
      saidasAno: Number(saidasAno || 0),
      movimentosHoje,
      contas,
    });
  } catch (e) {
    console.error("Erro ao gerar resumo de tesouraria:", e);
    return res.status(500).json({ erro: "Erro ao gerar resumo de tesouraria" });
  }
};

exports.movimentosPorConta = async (req, res) => {
  try {
    const { conta_id } = req.params;
    const { data_inicio, data_fim } = req.query;
    const where = { organizacao_id: req.organizacao_id, conta_bancaria_id: conta_id };
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    const movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        { model: Cliente, as: "cliente", attributes: ["id", "nome"] },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"] },
      ],
      order: [["data_movimento", "DESC"]],
    });
    return res.json(movimentos);
  } catch (e) {
    console.error("Erro ao listar movimentos por conta:", e);
    return res.status(500).json({ erro: "Erro ao listar movimentos" });
  }
};

exports.exportar = async (req, res) => {
  try {
    const { tipo, categoria, data_inicio, data_fim } = req.query;
    const where = { organizacao_id: req.organizacao_id, deleted: false };
    if (tipo) where.tipo = tipo;
    if (categoria) where.categoria = categoria;
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    const movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        { model: ContaBancaria, as: "conta", attributes: ["banco_nome", "numero_conta"] },
      ],
      order: [["data_movimento", "DESC"]],
    });

    function fmtData(v) {
      if (!v) return "";
      const d = new Date(v + "T00:00:00");
      if (isNaN(d.getTime())) return String(v);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    const sep = "\t";
    const cabecalho = ["Data", "Tipo", "Categoria", "Descricao", "Valor (Kz)", "Metodo", "Conta Origem", "Estado", "Referencia"].join(sep);
    const linhas = movimentos.map((m) => [
      fmtData(m.data_movimento),
      m.tipo,
      m.categoria || "",
      m.descricao,
      String(m.valor).replace(".", ","),
      m.metodo_pagamento || "",
      m.conta ? `${m.conta.banco_nome || ""} ${m.conta.numero_conta || ""}`.trim() : "",
      m.estado,
      m.referencia || "",
    ].join(sep));

    const csv = "\uFEFF" + cabecalho + "\n" + linhas.join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="tesouraria_${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error("Erro ao exportar tesouraria:", e);
    return res.status(500).json({ erro: "Erro ao exportar dados" });
  }
};
