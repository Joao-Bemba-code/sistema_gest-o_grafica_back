const { ContaBancaria } = require("../models");

const TIPOS_CONTA = ["corrente", "poupanca", "caixa", "investimento"];

exports.listar = async (req, res) => {
  try {
    const { tipo, ativo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (tipo) where.tipo_conta = tipo;
    if (ativo !== undefined) where.ativo = ativo === "true";
    const contas = await ContaBancaria.findAll({ where, order: [["favorita", "DESC"], ["createdAt", "ASC"]] });
    return res.json(contas);
  } catch (e) {
    console.error("Erro ao listar contas bancárias:", e);
    return res.status(500).json({ erro: "Erro ao listar contas bancárias" });
  }
};

exports.buscar = async (req, res) => {
  try {
    const conta = await ContaBancaria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!conta) return res.status(404).json({ erro: "Conta bancária não encontrada" });
    return res.json(conta);
  } catch (e) {
    console.error("Erro ao buscar conta bancária:", e);
    return res.status(500).json({ erro: "Erro ao buscar conta bancária" });
  }
};

exports.criar = async (req, res) => {
  try {
    const { banco_nome, banco_codigo, agencia, numero_conta, iban, moeda, tipo_conta, saldo_inicial, titular, observacoes, favorita } = req.body;
    if (!banco_nome || !String(banco_nome).trim()) {
      return res.status(400).json({ erro: "Nome do banco é obrigatório" });
    }
    const tipo = TIPOS_CONTA.includes(tipo_conta) ? tipo_conta : "corrente";
    const saldo = parseFloat(saldo_inicial) || 0;
    const conta = await ContaBancaria.create({
      organizacao_id: req.organizacao_id,
      banco_nome: String(banco_nome).trim(),
      banco_codigo: banco_codigo || null,
      agencia: agencia || null,
      numero_conta: numero_conta || null,
      iban: iban || null,
      moeda: moeda || "AOA",
      tipo_conta: tipo,
      saldo_inicial: saldo,
      saldo_atual: saldo,
      titular: titular || null,
      observacoes: observacoes || null,
      favorita: !!favorita,
    });
    return res.status(201).json(conta);
  } catch (e) {
    console.error("Erro ao criar conta bancária:", e);
    return res.status(500).json({ erro: "Erro ao criar conta bancária" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const conta = await ContaBancaria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!conta) return res.status(404).json({ erro: "Conta bancária não encontrada" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    if (dados.tipo_conta && !TIPOS_CONTA.includes(dados.tipo_conta)) delete dados.tipo_conta;
    if (dados.saldo_inicial !== undefined) dados.saldo_inicial = parseFloat(dados.saldo_inicial) || 0;
    await conta.update(dados);
    return res.json(conta);
  } catch (e) {
    console.error("Erro ao atualizar conta bancária:", e);
    return res.status(500).json({ erro: "Erro ao atualizar conta bancária" });
  }
};

exports.remover = async (req, res) => {
  try {
    const conta = await ContaBancaria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!conta) return res.status(404).json({ erro: "Conta bancária não encontrada" });
    await conta.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Conta bancária removida com sucesso" });
  } catch (e) {
    console.error("Erro ao remover conta bancária:", e);
    return res.status(500).json({ erro: "Erro ao remover conta bancária" });
  }
};

exports.resumo = async (req, res) => {
  try {
    const contas = await ContaBancaria.findAll({
      where: { organizacao_id: req.organizacao_id, ativo: true },
    });
    const totalSaldo = contas.reduce((s, c) => s + Number(c.saldo_atual || 0), 0);
    const totalContas = contas.length;
    const contaFavorita = contas.find((c) => c.favorita);
    return res.json({ totalSaldo, totalContas, contaFavorita, contas });
  } catch (e) {
    console.error("Erro ao gerar resumo bancário:", e);
    return res.status(500).json({ erro: "Erro ao gerar resumo bancário" });
  }
};
