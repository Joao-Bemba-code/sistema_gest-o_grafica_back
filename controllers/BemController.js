const { Bem } = require("../models");

exports.listar = async (req, res) => {
  try {
    const bens = await Bem.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome", "ASC"]],
    });
    return res.json(bens);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar bens" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const bem = await Bem.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!bem) return res.status(404).json({ erro: "Bem não encontrado" });
    return res.json(bem);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar bem" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = { ...req.body, organizacao_id: req.organizacao_id };
    const bem = await Bem.create(dados);
    return res.status(201).json(bem);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar bem" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const bem = await Bem.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!bem) return res.status(404).json({ erro: "Bem não encontrado" });
    await bem.update({ ...req.body });
    return res.json(bem);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar bem" });
  }
};

exports.remover = async (req, res) => {
  try {
    const bem = await Bem.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!bem) return res.status(404).json({ erro: "Bem não encontrado" });
    await bem.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Bem removido com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover bem" });
  }
};
