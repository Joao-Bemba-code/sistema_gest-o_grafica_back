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

async function nomeDuplicado(organizacaoId, nome, ignorarId = null) {
  const normalizar = (s) => String(s || "").trim().toLowerCase();
  const alvo = normalizar(nome);
  if (!alvo) return false;
  const categorias = await Categoria.findAll({
    where: { organizacao_id: organizacaoId, deleted: false },
  });
  return categorias.some((c) => String(c.id) !== String(ignorarId) && normalizar(c.nome) === alvo);
}

exports.criar = async (req, res) => {
  try {
    const dados = { ...req.body, organizacao_id: req.organizacao_id };
    if (await nomeDuplicado(req.organizacao_id, dados.nome)) {
      return res.status(409).json({ erro: `Já existe uma categoria com o nome "${String(dados.nome).trim()}". Escolha outro nome ou use a existente.` });
    }
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
    await categoria.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Categoria removida com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover categoria" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const categoria = await Categoria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!categoria) return res.status(404).json({ erro: "Categoria não encontrada" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    if (dados.campos_especificacao !== undefined && !Array.isArray(dados.campos_especificacao)) {
      return res.status(422).json({ erro: "campos_especificacao deve ser uma lista" });
    }
    if (await nomeDuplicado(req.organizacao_id, dados.nome ?? categoria.nome, categoria.id)) {
      return res.status(409).json({ erro: `Já existe outra categoria com o nome "${String(dados.nome).trim()}".` });
    }
    await categoria.update(dados);
    return res.json(categoria);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar categoria" });
  }
};
