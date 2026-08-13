const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Usuario, Organizacao } = require("../models");
const { registarFalha, limparFalhas } = require("../protect/loginLimit");

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(422).json({ erro: "Email e senha são obrigatórios" });
    }
    const usuario = await Usuario.findOne({ where: { email }, include: [Organizacao] });
    if (!usuario) {
      registarFalha(req);
      return res.status(401).json({ erro: "Credenciais inválidas" });
    }
    if (!usuario.ativo) {
      registarFalha(req);
      return res.status(401).json({ erro: "Usuário inativo" });
    }
    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk) {
      registarFalha(req);
      return res.status(401).json({ erro: "Credenciais inválidas" });
    }
    limparFalhas(req);
    const token = jwt.sign(
      { id: usuario.id, organizacao_id: usuario.organizacao_id, funcao: usuario.funcao },
      process.env.SECRET,
      { expiresIn: "8h" }
    );
    const { senha: _, ...dadosUsuario } = usuario.toJSON();
    return res.json({ token, usuario: dadosUsuario });
  } catch (e) {
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};

exports.perfil = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, {
      attributes: { exclude: ["senha"] },
      include: [Organizacao],
    });
    return res.json(usuario);
  } catch (e) {
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};

exports.registrar = async (req, res) => {
  try {
    const { nome, email, senha, organizacao_nome } = req.body;
    if (!nome || !email || !senha || !organizacao_nome) {
      return res.status(422).json({ erro: "Nome, email, senha e organização são obrigatórios" });
    }
    const existe = await Usuario.findOne({ where: { email } });
    if (existe) return res.status(409).json({ erro: "Email já cadastrado" });
    const organizacao = await Organizacao.create({ nome: organizacao_nome });
    const hash = await bcrypt.hash(senha, 10);
    const usuario = await Usuario.create({
      organizacao_id: organizacao.id,
      nome,
      email,
      senha: hash,
      funcao: "admin",
    });
    const { senha: _, ...dadosUsuario } = usuario.toJSON();
    return res.status(201).json({ mensagem: "Conta criada com sucesso", usuario: dadosUsuario });
  } catch (e) {
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};
