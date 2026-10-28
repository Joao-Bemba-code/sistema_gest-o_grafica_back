const bcrypt = require("bcryptjs");
const { Usuario, LoginLog } = require("../models");
const { PERFIS } = require("../services/permissoes");
const auditoria = require("../services/auditoria");

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
    const { nome, email, senha, funcao } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: "Nome, email e senha são obrigatórios" });
    }
    const existe = await Usuario.findOne({ where: { email, organizacao_id: req.organizacao_id } });
    if (existe) return res.status(409).json({ erro: "Já existe um utilizador com este email" });

    // Só um administrador pode criar outro administrador ou atribuir
    // permissões personalizadas; caso contrário, força o perfil de produção.
    const eAdmin = req.usuario?.perfil === "admin";
    const perfilPedido = req.body.perfil;
    const perfil = eAdmin && perfilPedido && PERFIS[perfilPedido] ? perfilPedido : "producao";
    const permissoes = eAdmin ? req.body.permissoes || null : null;

    const hash = await bcrypt.hash(senha, 10);
    const novo = await Usuario.create({
      organizacao_id: req.organizacao_id,
      nome,
      email,
      senha: hash,
      perfil,
      permissoes,
      funcao: funcao || perfil || "operador",
    });

    const { senha: _, ...dados } = novo.toJSON();
    auditoria.registrar({
      req,
      acao: "usuario.criar",
      alvoTipo: "usuario",
      alvoId: novo.id,
      detalhe: { email: novo.email, perfil: novo.perfil },
    });
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
    const eAdmin = req.usuario?.perfil === "admin";
    const eProprio = Number(id) === Number(req.usuario?.id);

    // Só administradores podem alterar perfis/permissões ou mexer na conta de
    // outro administrador. Sem isto, quem edita utilizadores promovia-se a si
    // próprio a admin e passava a controlar toda a empresa.
    if (!eAdmin && !eProprio && usuario.perfil === "admin") {
      return res.status(403).json({ erro: "Sem permissão para alterar um administrador" });
    }
    if (!eAdmin && (perfil !== undefined || permissoes !== undefined)) {
      return res.status(403).json({ erro: "Só um administrador pode alterar perfis e permissões" });
    }
    if (perfil !== undefined && !PERFIS[perfil]) {
      return res.status(422).json({ erro: "Perfil inválido" });
    }
    if (senha && !eAdmin && !eProprio) {
      return res.status(403).json({ erro: "Só um administrador pode alterar a senha de outro utilizador" });
    }

    const revogarSessoes =
      !!(senha && String(senha).trim()) ||
      (perfil !== undefined && perfil !== usuario.perfil) ||
      permissoes !== undefined ||
      ativo !== undefined;

    if (nome !== undefined) usuario.nome = nome;
    if (email !== undefined) usuario.email = String(email).trim().toLowerCase();
    if (perfil !== undefined) usuario.perfil = perfil;
    if (funcao !== undefined) usuario.funcao = funcao;
    if (ativo !== undefined) usuario.ativo = ativo;
    if (permissoes !== undefined) usuario.permissoes = permissoes;
    if (revogarSessoes) {
      usuario.token_version = Number(usuario.token_version || 0) + 1;
    }

    // Impedir que um utilizador se auto-desative e se bloqueie do sistema (admin keep)
    if (Number(id) === req.usuario.id && ativo === false) {
      return res.status(400).json({ erro: "Não pode desativar o próprio utilizador" });
    }

    if (senha && String(senha).trim()) {
      usuario.senha = await bcrypt.hash(senha, 10);
    }

    await usuario.save();
    const mudancas = [];
    if (nome !== undefined) mudancas.push("nome");
    if (email !== undefined) mudancas.push("email");
    if (perfil !== undefined) mudancas.push("perfil");
    if (funcao !== undefined) mudancas.push("funcao");
    if (ativo !== undefined) mudancas.push(`ativo=${ativo}`);
    if (permissoes !== undefined) mudancas.push("permissoes");
    if (senha && String(senha).trim()) mudancas.push("senha");
    auditoria.registrar({
      req,
      acao: "usuario.atualizar",
      alvoTipo: "usuario",
      alvoId: usuario.id,
      detalhe: { email: usuario.email, mudancas },
    });
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
    const alvo = await Usuario.findOne({
      where: { id, organizacao_id: req.organizacao_id },
      attributes: ["id"],
    });
    if (!alvo) return res.status(404).json({ erro: "Utilizador não encontrado" });
    const logs = await LoginLog.findAll({
      where: { usuario_id: alvo.id, organizacao_id: req.organizacao_id },
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