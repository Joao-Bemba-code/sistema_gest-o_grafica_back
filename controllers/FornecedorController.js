const { Fornecedor } = require("../models");

exports.listar = async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome", "ASC"]],
    });
    return res.json(fornecedores);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar fornecedores" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = { ...req.body, organizacao_id: req.organizacao_id };
    const fornecedor = await Fornecedor.create(dados);
    return res.status(201).json(fornecedor);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar fornecedor" });
  }
};

exports.remover = async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fornecedor) return res.status(404).json({ erro: "Fornecedor nao encontrado" });
    await fornecedor.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Fornecedor removido com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover fornecedor" });
  }
};