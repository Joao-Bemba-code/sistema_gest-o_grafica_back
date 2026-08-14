const { Organizacao, Sistema, Seguranca, ConfiguracaoEmail, Usuario } = require("../models");

exports.buscarOrganizacao = async (req, res) => {
  try {
    let org = await Organizacao.findByPk(req.organizacao_id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    return res.json(org);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar organização" });
  }
};

exports.guardarOrganizacao = async (req, res) => {
  try {
    const { nome, nif, email, telefone, endereco, website, sigla, template_contrato } = req.body;
    const org = await Organizacao.findByPk(req.organizacao_id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    await org.update({ nome, nif, email, telefone, endereco, website, sigla, template_contrato });
    return res.json(org);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao guardar organização" });
  }
};

exports.buscarSistema = async (req, res) => {
  try {
    let sistema = await Sistema.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!sistema) {
      sistema = await Sistema.create({ organizacao_id: req.organizacao_id });
    }
    return res.json(sistema);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar parâmetros do sistema" });
  }
};

exports.guardarSistema = async (req, res) => {
  try {
    const { idioma, formato_data, moeda, fuso_horario, dias_aviso_ferias, limite_ficheiros } = req.body;
    let sistema = await Sistema.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!sistema) {
      sistema = await Sistema.create({ organizacao_id: req.organizacao_id });
    }
    await sistema.update({ idioma, formato_data, moeda, fuso_horario, dias_aviso_ferias, limite_ficheiros });
    return res.json(sistema);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao guardar parâmetros do sistema" });
  }
};

exports.buscarSeguranca = async (req, res) => {
  try {
    let seguranca = await Seguranca.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!seguranca) {
      seguranca = await Seguranca.create({ organizacao_id: req.organizacao_id });
    }
    return res.json(seguranca);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar configurações de segurança" });
  }
};

exports.guardarSeguranca = async (req, res) => {
  try {
    const { tfa_ativo, forcar_senha, bloqueio_bruta, sessao_inativa } = req.body;
    let seguranca = await Seguranca.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!seguranca) {
      seguranca = await Seguranca.create({ organizacao_id: req.organizacao_id });
    }
    await seguranca.update({ tfa_ativo, forcar_senha, bloqueio_bruta, sessao_inativa });
    return res.json(seguranca);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao guardar configurações de segurança" });
  }
};

exports.buscarEmail = async (req, res) => {
  try {
    let cfg = await ConfiguracaoEmail.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!cfg) {
      cfg = await ConfiguracaoEmail.create({ organizacao_id: req.organizacao_id });
    }
    return res.json(cfg);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar configurações de email" });
  }
};

exports.guardarEmail = async (req, res) => {
  try {
    const { ativo, smtp_host, smtp_port, smtp_user, smtp_senha, email_remetente, email_nome } = req.body;
    let cfg = await ConfiguracaoEmail.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!cfg) {
      cfg = await ConfiguracaoEmail.create({ organizacao_id: req.organizacao_id });
    }
    await cfg.update({
      ativo: !!ativo,
      smtp_host: smtp_host || null,
      smtp_port: Number(smtp_port) || 587,
      smtp_user: smtp_user || null,
      smtp_senha: smtp_senha || null,
      email_remetente: email_remetente || null,
      email_nome: email_nome || null,
    });
    return res.json(cfg);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao guardar configurações de email" });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ erro: "Nenhum ficheiro enviado" });
    const org = await Organizacao.findByPk(req.organizacao_id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    const logo_url = `/uploads/${req.file.filename}`;
    await org.update({ logo_url });
    return res.json({ logo_url });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao fazer upload do logo" });
  }
};

exports.buscarUtilizadorAtual = async (req, res) => {
  try {
    const user = await Usuario.findByPk(req.usuario.id, {
      attributes: { exclude: ["senha"] },
    });
    if (!user) return res.status(404).json({ erro: "Utilizador não encontrado" });
    return res.json(user);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar utilizador" });
  }
};

exports.alterarEmail = async (req, res) => {
  try {
    const { novo_email, senha_atual } = req.body;
    const bcrypt = require("bcryptjs");
    const user = await Usuario.findByPk(req.usuario.id);
    if (!user) return res.status(404).json({ erro: "Utilizador não encontrado" });
    const valida = await bcrypt.compare(senha_atual, user.senha);
    if (!valida) return res.status(400).json({ erro: "Senha atual incorreta" });
    await user.update({ email: novo_email });
    return res.json({ mensagem: "Email alterado com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao alterar email" });
  }
};

exports.alterarSenha = async (req, res) => {
  try {
    const { senha_atual, nova_senha } = req.body;
    const bcrypt = require("bcryptjs");
    const user = await Usuario.findByPk(req.usuario.id);
    if (!user) return res.status(404).json({ erro: "Utilizador não encontrado" });
    const valida = await bcrypt.compare(senha_atual, user.senha);
    if (!valida) return res.status(400).json({ erro: "Senha atual incorreta" });
    const hash = await bcrypt.hash(nova_senha, 10);
    await user.update({ senha: hash });
    return res.json({ mensagem: "Senha alterada com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao alterar senha" });
  }
};
