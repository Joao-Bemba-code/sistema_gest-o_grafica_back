const bcrypt = require("bcryptjs");
const { Usuario, LoginLog } = require("../models");
const { PERFIS } = require("../services/permissoes");

const EXCLUIR_SENHA = { exclude: ["senha"] };

exports.listar = async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      where: { organizacao_id: req.organizacao_id },
      attributes: EXCLUIR_SENHA,
      order: [["nome", "ASC"]],
    });
    return res.json(usuarios);
  } catch (e) {
    console.error("Erro ao listar utilizadores:", e);
    return res.status(500).json({ erro: "Erro ao listar utilizadores" });
  }
};

exports.criar = async (req, res) => {
  try {
    const { nome, email, senha, perfil, permissoes, funcao } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
    }
    const existe = await Usuario.findOne({ where: { email, organizacao_id: req.organizacao_id } });
    if (existe) return res.status(409).json({ erro: "Já existe um utilizador com este email" });

    const hash = await bcrypt.hash(senha, 10);
    const novo = await Usuario.create({
      organizacao_id: req.organizacao_id,
      nome,
      email,
      senha: hash,
      perfil: perfil || "producao",
      permissoes: permissoes || null,
      funcao: funcao || perfil || "operador",
    });

    const { senha: _, ...dados } = novo.toJSON();
    return res.status(201).json(dados);
  } catch (e) {
    console.error("Erro ao criar utilizador:", e);
    return res.status(500).json({ erro: "Erro ao criar utilizador" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await Usuario.findOne({ where: { id, organizacao_id: req.organizacao_id } });
    if (!usuario) return res.status(404).json({ erro: "Utilizador não encontrado" });

    const { nome, email, perfil, permissoes, funcao, ativo, senha } = req.body;

    if (nome !== undefined) usuario.nome = nome;
    if (email !== undefined) usuario.email = email;
    if (perfil !== undefined) usuario.perfil = perfil;
    if (funcao !== undefined) usuario.funcao = funcao;
    if (ativo !== undefined) usuario.ativo = ativo;
    if (permissoes !== undefined) usuario.permissoes = permissoes;

    // Impedir que um utilizador se auto-desative e se bloqueie do sistema (admin keep)
    if (Number(id) === req.usuario.id && ativo === false) {
      return res.status(400).json({ erro: "Não pode desativar o próprio utilizador" });
    }

    if (senha && String(senha).trim()) {
      usuario.senha = await bcrypt.hash(senha, 10);
    }

    await usuario.save();
    const { senha: _, ...dados } = usuario.toJSON();
    return res.json(dados);
  } catch (e) {
    console.error("Erro ao atualizar utilizador:", e);
    return res.status(500).json({ erro: "Erro ao atualizar utilizador" });
  }
};

exports.listarAcessos = async (req, res) => {
  try {
    const { id } = req.params;
    const logs = await LoginLog.findAll({
      where: { usuario_id: id },
      order: [["createdAt", "DESC"]],
      limit: 200,
    });
    return res.json(logs);
  } catch (e) {
    console.error("Erro ao listar acessos:", e);
    return res.status(500).json({ erro: "Erro ao listar acessos" });
  }
};

exports.listarPerfis = (req, res) => {
  const perfis = Object.entries(PERFIS).map(([valor, p]) => ({ valor, label: p.label }));
  return res.json(perfis);
};