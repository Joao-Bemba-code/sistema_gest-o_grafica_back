const { Organizacao, Sistema, Seguranca, Usuario, AgtConfiguracao } = require("../models");
const auditoria = require("../services/auditoria");
const { obterConfigAGT, agtPronto, configSoftwareAGT } = require("../services/agtConfig");
const { cifrar } = require("../services/agtSegredos");

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
    const { nome, nif, email, telefone, endereco, website, sigla, template_contrato, banco_nome, banco_iban, banco_conta, valor_hora_servicos } = req.body;
    const org = await Organizacao.findByPk(req.organizacao_id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    await org.update({ nome, nif, email, telefone, endereco, website, sigla, template_contrato, banco_nome, banco_iban, banco_conta, valor_hora_servicos: valor_hora_servicos !== undefined ? Number(valor_hora_servicos) || 0 : org.valor_hora_servicos });
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
    const {
      idioma, formato_data, moeda, fuso_horario, dias_aviso_ferias, limite_ficheiros,
      compras_exige_aprovacao, compras_alcada_valor, compras_alcada_valor_superior,
    } = req.body;
    let sistema = await Sistema.findOne({ where: { organizacao_id: req.organizacao_id } });
    if (!sistema) {
      sistema = await Sistema.create({ organizacao_id: req.organizacao_id });
    }
    await sistema.update({
      idioma, formato_data, moeda, fuso_horario, dias_aviso_ferias, limite_ficheiros,
      compras_exige_aprovacao: compras_exige_aprovacao !== undefined ? !!compras_exige_aprovacao : sistema.compras_exige_aprovacao,
      compras_alcada_valor: compras_alcada_valor !== undefined ? Number(compras_alcada_valor) || 0 : sistema.compras_alcada_valor,
      compras_alcada_valor_superior: compras_alcada_valor_superior !== undefined ? Number(compras_alcada_valor_superior) || 0 : sistema.compras_alcada_valor_superior,
    });
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

exports.buscarAgt = async (req, res) => {
  try {
    const cfg = await obterConfigAGT(req.organizacao_id);
    const linha = await AgtConfiguracao.findOne({ where: { organizacao_id: req.organizacao_id } });
    const software = configSoftwareAGT();
    return res.json({
      definida: !!linha,
      ativo: cfg.ativo,
      ambiente: cfg.ambiente,
      baseUrl: cfg.baseUrl,
      username: cfg.username,
      nif: cfg.nif,
      establishment: cfg.establishment,
      eacCode: cfg.eacCode,
      iva: cfg.ivaDefault,
      pronto: agtPronto(cfg),
      // Nunca devolver os segredos: só se estão definidos ou não.
      segredos: {
        senhaDefinida: !!cfg.password,
        taxpayerKeyDefinida: !!cfg.taxpayerKey,
      },
      software: {
        productId: software.productId,
        productVersion: software.productVersion,
        softwareValidationNumber: software.softwareValidationNumber,
        softwareKeyDefinida: !!software.softwareKey,
      },
    });
  } catch (e) {
    console.error("Erro ao buscar configuração AGT:", e);
    return res.status(500).json({ erro: "Erro ao buscar configuração AGT" });
  }
};

exports.guardarAgt = async (req, res) => {
  try {
    const b = req.body || {};
    let linha = await AgtConfiguracao.findOne({ where: { organizacao_id: req.organizacao_id } });
    const dados = {};
    if (b.ativo !== undefined) dados.ativo = !!b.ativo;
    if (b.ambiente !== undefined) {
      const amb = String(b.ambiente).toLowerCase();
      if (!["homologacao", "producao"].includes(amb)) {
        return res.status(422).json({ erro: "Ambiente inválido (use homologacao ou producao)" });
      }
      dados.ambiente = amb;
    }
    if (b.username !== undefined) dados.username = String(b.username || "").trim().slice(0, 120);
    if (b.senha !== undefined && b.senha !== "") dados.senha_cifrada = cifrar(b.senha);
    if (b.nif !== undefined) dados.nif = String(b.nif || "").trim().slice(0, 30);
    if (b.establishment !== undefined) dados.establishment = String(b.establishment || "SEDE").slice(0, 200);
    if (b.eac_code !== undefined) dados.eac_code = String(b.eac_code || "").trim().slice(0, 30);
    if (b.taxpayer_key !== undefined && b.taxpayer_key !== "") dados.taxpayer_key_cifrada = cifrar(b.taxpayer_key);
    if (b.iva !== undefined) dados.iva_default = Number(b.iva) || 0;

    if (linha) {
      await linha.update(dados);
    } else {
      linha = await AgtConfiguracao.create({ organizacao_id: req.organizacao_id, ...dados });
    }
    auditoria.registrar({
      req,
      acao: "configuracao.agt",
      alvoTipo: "organizacao",
      alvoId: req.organizacao_id,
      detalhe: { campos: Object.keys(dados).map((c) => (c.endsWith("_cifrada") ? "segredo" : c)) },
    });
    const cfg = await obterConfigAGT(req.organizacao_id);
    return res.json({ mensagem: "Configuração AGT guardada", definida: true, pronto: agtPronto(cfg) });
  } catch (e) {
    console.error("Erro ao guardar configuração AGT:", e);
    return res.status(500).json({ erro: "Erro ao guardar configuração AGT" });
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
    const email = String(novo_email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(422).json({ erro: "Email inválido" });
    }
    await user.update({
      email,
      token_version: Number(user.token_version || 0) + 1,
    });
    auditoria.registrar({
      req,
      acao: "configuracao.alterar_email",
      alvoTipo: "usuario",
      alvoId: user.id,
      detalhe: { novo_email: email },
    });
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
    if (!nova_senha || String(nova_senha).length < 8) {
      return res.status(422).json({ erro: "A nova senha deve ter pelo menos 8 caracteres" });
    }
    const hash = await bcrypt.hash(nova_senha, 10);
    await user.update({
      senha: hash,
      token_version: Number(user.token_version || 0) + 1,
    });
    auditoria.registrar({
      req,
      acao: "configuracao.alterar_senha",
      alvoTipo: "usuario",
      alvoId: user.id,
    });
    return res.json({ mensagem: "Senha alterada com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao alterar senha" });
  }
};
