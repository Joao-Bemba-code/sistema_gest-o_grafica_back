const { Categoria } = require("../models");

exports.listar = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome", "ASC"]],
    });
    return res.json(categorias);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar categorias" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = { ...req.body, organizacao_id: req.organizacao_id };
    const categoria = await Categoria.create(dados);
    return res.status(201).json(categoria);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar categoria" });
  }
};

exports.remover = async (req, res) => {
  try {
    const categoria = await Categoria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!categoria) return res.status(404).json({ erro: "Categoria não encontrada" });
    await categoria.destroy();
    return res.json({ mensagem: "Categoria removida com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover categoria" });
  }
};
