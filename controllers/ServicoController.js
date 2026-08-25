const { Servico, Categoria } = require("../models");

exports.listar = async (req, res) => {
  try {
    const servicos = await Servico.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome", "ASC"]],
    });
    return res.json(servicos);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar serviços" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = {
      organizacao_id: req.organizacao_id,
      nome: String(req.body.nome || "").trim(),
      descricao: String(req.body.descricao || "").trim() || null,
    };
    if (!dados.nome) return res.status(400).json({ erro: "Nome é obrigatório" });
    const servico = await Servico.create(dados);
    return res.status(201).json(servico);
  } catch (e) {
    console.error("Erro ao criar serviço:", e.message);
    return res.status(500).json({ erro: "Erro ao criar serviço" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const servico = await Servico.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!servico) return res.status(404).json({ erro: "Serviço não encontrado" });
    await servico.update(req.body);
    return res.json(servico);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar serviço" });
  }
};

exports.remover = async (req, res) => {
  try {
    const servico = await Servico.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!servico) return res.status(404).json({ erro: "Serviço não encontrado" });
    await servico.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Serviço removido com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover serviço" });
  }
};
