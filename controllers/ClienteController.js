const { Cliente } = require("../models");

function gerarCodigo(tipo, id) {
  const prefixo = tipo === "fornecedor" ? "FOR" : "CLI";
  return `${prefixo}-${String(id).padStart(4, "0")}`;
}

function normalizarDados(body) {
  const dados = { ...body };
  delete dados.organizacao_id;
  if (dados.dataCadastro !== undefined) {
    dados.data_cadastro = dados.dataCadastro || null;
    delete dados.dataCadastro;
  }
  return dados;
}

function dataISO(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function serializar(cliente) {
  const obj = cliente.toJSON ? cliente.toJSON() : cliente;
  const dataCadastro = dataISO(obj.data_cadastro) || dataISO(obj.createdAt);
  return {
    ...obj,
    codigo: obj.codigo || gerarCodigo(obj.tipo, obj.id),
    dataCadastro,
    data_cadastro: dataCadastro,
  };
}

exports.listar = async (req, res) => {
  try {
    const { tipo, busca } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (tipo) where.tipo = tipo;
    if (busca) {
      where[require("sequelize").Op.or] = [
        { nome: { [require("sequelize").Op.like]: `%${busca}%` } },
        { empresa: { [require("sequelize").Op.like]: `%${busca}%` } },
        { nif: { [require("sequelize").Op.like]: `%${busca}%` } },
      ];
    }
    const clientes = await Cliente.findAll({ where, order: [["nome", "ASC"]] });
    return res.json(clientes.map(serializar));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar clientes" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    return res.json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar cliente" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = normalizarDados(req.body);
    const cliente = await Cliente.create({ ...dados, organizacao_id: req.organizacao_id });
    if (!cliente.codigo) {
      await cliente.update({ codigo: gerarCodigo(cliente.tipo, cliente.id) });
    }
    return res.status(201).json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar cliente" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    const dados = normalizarDados(req.body);
    await cliente.update(dados);
    if (!cliente.codigo) {
      await cliente.update({ codigo: gerarCodigo(cliente.tipo, cliente.id) });
    }
    return res.json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar cliente" });
  }
};

exports.remover = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    await cliente.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Cliente removido com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover cliente" });
  }
};
