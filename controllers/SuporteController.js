const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { Op, fn, col, literal } = require("sequelize");
const { SuporteUsuario, Organizacao, Usuario, LoginLog } = require("../models");
const loginLog = require("../services/loginLog");
const suporteAuditoria = require("../services/suporteAuditoria");
const { registarFalha, limparFalhas } = require("../protect/loginLimit");

const SEM_SENHA = { exclude: ["senha"] };

const CARACTERES_SENHA = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";

function gerarSenha(tamanho = 12) {
  const bytes = crypto.randomBytes(tamanho * 2);
  let senha = "";
  for (let i = 0; i < tamanho; i++) {
    senha += CARACTERES_SENHA[bytes[i] % CARACTERES_SENHA.length];
  }
  return senha;
}

function semSenha(instancia) {
  const { senha: _, ...dados } = instancia.toJSON();
  return dados;
}

function paginacao(query, limiteMax = 100) {
  const pagina = Math.max(1, parseInt(query.pagina, 10) || 1);
  const limite = Math.min(limiteMax, Math.max(1, parseInt(query.limite, 10) || 25));
  return { pagina, limite, offset: (pagina - 1) * limite };
}

function erroComStatus(mensagem, status) {
  const e = new Error(mensagem);
  e.status = status;
  return e;
}

async function criarUsuarioDeOrg(organizacaoId, dados) {
  const { nome, email, senha, perfil, funcao, permissoes } = dados;
  if (!nome || !String(nome).trim() || !email || !String(email).trim()) {
    throw erroComStatus("Nome e email do utilizador são obrigatórios", 422);
  }
  const existe = await Usuario.findOne({ where: { email } });
  if (existe) throw erroComStatus("Já existe um utilizador com este email", 409);
  const hash = await bcrypt.hash(senha, 10);
  return Usuario.create({
    organizacao_id: organizacaoId,
    nome,
    email,
    senha: hash,
    perfil: perfil || "producao",
    funcao: funcao || perfil || "operador",
    permissoes: permissoes || null,
  });
}

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(422).json({ erro: "Email e senha são obrigatórios" });
    }
    if (!process.env.SECRET_SUPORTE) {
      return res.status(500).json({ erro: "SECRET_SUPORTE não configurado no servidor" });
    }
    const usuario = await SuporteUsuario.findOne({ where: { email } });
    if (!usuario || !usuario.ativo || !(await bcrypt.compare(senha, usuario.senha))) {
      registarFalha(req);
      await loginLog.registrar({
        email,
        sucesso: false,
        ip: req.ip,
        user_agent: req.headers?.["user-agent"] || null,
      });
      return res.status(401).json({ erro: "Credenciais inválidas" });
    }
    limparFalhas(req);
    await loginLog.registrar({
      email,
      sucesso: true,
      ip: req.ip,
      user_agent: req.headers?.["user-agent"] || null,
    });
    const token = jwt.sign({ id: usuario.id, tipo: "suporte" }, process.env.SECRET_SUPORTE, {
      expiresIn: "8h",
    });
    return res.json({ token, usuario: semSenha(usuario) });
  } catch (e) {
    console.error("Erro no login de suporte:", e);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};

exports.estado = (req, res) => {
  return res.json({ usuario: semSenha(req.suporte) });
};

exports.resumo = async (req, res) => {
  try {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const desde30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [totalOrgs, orgsAtivas, totalUsuarios, usuariosAtivos, logins7d, falhas7d, orgsComAcesso, serieRows] =
      await Promise.all([
        Organizacao.count(),
        Organizacao.count({ where: { ativo: true } }),
        Usuario.count(),
        Usuario.count({ where: { ativo: true } }),
        LoginLog.count({ where: { createdAt: { [Op.gte]: desde }, sucesso: true } }),
        LoginLog.count({ where: { createdAt: { [Op.gte]: desde }, sucesso: false } }),
        LoginLog.findAll({
          attributes: [[fn("DISTINCT", col("organizacao_id")), "org"]],
          where: {
            createdAt: { [Op.gte]: desde },
            sucesso: true,
            organizacao_id: { [Op.ne]: null },
          },
          raw: true,
        }),
        LoginLog.findAll({
          attributes: [
            [fn("DATE", col("createdAt")), "dia"],
            [fn("SUM", literal("CASE WHEN sucesso = 1 THEN 1 ELSE 0 END")), "sucessos"],
            [fn("SUM", literal("CASE WHEN sucesso = 0 THEN 1 ELSE 0 END")), "falhas"],
          ],
          where: { createdAt: { [Op.gte]: desde30 } },
          group: [fn("DATE", col("createdAt"))],
          order: [[fn("DATE", col("createdAt")), "ASC"]],
          raw: true,
        }),
      ]);
    return res.json({
      organizacoes: {
        total: totalOrgs,
        ativas: orgsAtivas,
        inativas: totalOrgs - orgsAtivas,
        comAcesso7d: orgsComAcesso.length,
      },
      utilizadores: { total: totalUsuarios, ativos: usuariosAtivos },
      acessos7d: { sucesso: logins7d, falhas: falhas7d },
      serie: (serieRows || []).map((r) => ({
        dia: r.dia instanceof Date ? r.dia.toISOString().slice(0, 10) : String(r.dia).slice(0, 10),
        sucessos: Number(r.sucessos) || 0,
        falhas: Number(r.falhas) || 0,
      })),
    });
  } catch (e) {
    console.error("Erro no resumo de suporte:", e);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};

exports.listarOrganizacoes = async (req, res) => {
  try {
    const { pagina, limite, offset } = paginacao(req.query);
    const where = {};
    const busca = String(req.query.busca || "").trim();
    if (busca) {
      where[Op.or] = [
        { nome: { [Op.like]: `%${busca}%` } },
        { sigla: { [Op.like]: `%${busca}%` } },
        { email: { [Op.like]: `%${busca}%` } },
        { nif: { [Op.like]: `%${busca}%` } },
      ];
    }
    if (req.query.ativo === "1" || req.query.ativo === "true") where.ativo = true;
    if (req.query.ativo === "0" || req.query.ativo === "false") where.ativo = false;

    const total = await Organizacao.count({ where });
    const orgs = await Organizacao.findAll({
      where,
      order: [["nome", "ASC"]],
      offset,
      limit: limite,
    });

    const ids = orgs.map((o) => o.id);
    let ultimos = [];
    let totais = [];
    if (ids.length) {
      const [l, t] = await Promise.all([
        LoginLog.findAll({
          attributes: ["organizacao_id", [fn("MAX", col("createdAt")), "ultimo"]],
          where: { organizacao_id: { [Op.in]: ids }, sucesso: true },
          group: ["organizacao_id"],
          raw: true,
        }),
        Usuario.findAll({
          attributes: ["organizacao_id", [fn("COUNT", col("id")), "total"]],
          where: { organizacao_id: { [Op.in]: ids } },
          group: ["organizacao_id"],
          raw: true,
        }),
      ]);
      ultimos = l;
      totais = t;
    }
    const mapaUltimos = Object.fromEntries(ultimos.map((r) => [r.organizacao_id, r.ultimo]));
    const mapaTotais = Object.fromEntries(totais.map((r) => [r.organizacao_id, Number(r.total)]));

    return res.json({
      itens: orgs.map((o) => ({
        ...o.toJSON(),
        utilizadores: mapaTotais[o.id] || 0,
        ultimoAcesso: mapaUltimos[o.id] || null,
      })),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    });
  } catch (e) {
    console.error("Erro ao listar organizações (suporte):", e);
    return res.status(500).json({ erro: "Erro ao listar organizações" });
  }
};

exports.criarOrganizacao = async (req, res) => {
  try {
    const { nome, sigla, nif, email, telefone, endereco, website, admin } = req.body || {};
    if (!nome || !String(nome).trim()) {
      return res.status(422).json({ erro: "O nome da organização é obrigatório" });
    }
    const org = await Organizacao.create({ nome, sigla, nif, email, telefone, endereco, website });
    const resposta = { organizacao: org.toJSON() };
    if (admin && (admin.nome || admin.email)) {
      const senhaGerada = admin.senha || gerarSenha();
      await criarUsuarioDeOrg(org.id, { ...admin, senha: senhaGerada });
      resposta.credenciais = { email: admin.email, senha: senhaGerada, gerada: !admin.senha };
    }
    await suporteAuditoria.registar(req, "criar_organizacao", { tipo: "organizacao", id: org.id }, {
      nome: org.nome,
      admin_email: admin?.email || null,
      admin_senha_gerada: !admin?.senha,
    });
    return res.status(201).json(resposta);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error("Erro ao criar organização (suporte):", e);
    return res.status(500).json({ erro: "Erro ao criar organização" });
  }
};

exports.obterOrganizacao = async (req, res) => {
  try {
    const org = await Organizacao.findByPk(req.params.id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    const [utilizadores, ultimoAcesso, totalAcessos] = await Promise.all([
      Usuario.count({ where: { organizacao_id: org.id } }),
      LoginLog.max("createdAt", { where: { organizacao_id: org.id, sucesso: true } }),
      LoginLog.count({ where: { organizacao_id: org.id, sucesso: true } }),
    ]);
    return res.json({ ...org.toJSON(), utilizadores, ultimoAcesso, totalAcessos });
  } catch (e) {
    console.error("Erro ao obter organização (suporte):", e);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};

exports.atualizarOrganizacao = async (req, res) => {
  try {
    const org = await Organizacao.findByPk(req.params.id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    const { nome, sigla, nif, email, telefone, endereco, website, ativo } = req.body || {};
    const alterados = [];
    if (nome !== undefined) { org.nome = nome; alterados.push("nome"); }
    if (sigla !== undefined) { org.sigla = sigla; alterados.push("sigla"); }
    if (nif !== undefined) { org.nif = nif; alterados.push("nif"); }
    if (email !== undefined) { org.email = email; alterados.push("email"); }
    if (telefone !== undefined) { org.telefone = telefone; alterados.push("telefone"); }
    if (endereco !== undefined) { org.endereco = endereco; alterados.push("endereco"); }
    if (website !== undefined) { org.website = website; alterados.push("website"); }
    if (ativo !== undefined) { org.ativo = !!ativo; alterados.push("ativo"); }
    await org.save();
    await suporteAuditoria.registar(req, "atualizar_organizacao", { tipo: "organizacao", id: org.id }, {
      campos: alterados,
      ativo: org.ativo,
    });
    return res.json(org.toJSON());
  } catch (e) {
    console.error("Erro ao atualizar organização (suporte):", e);
    return res.status(500).json({ erro: "Erro ao atualizar organização" });
  }
};

exports.listarUsuarios = async (req, res) => {
  try {
    const org = await Organizacao.findByPk(req.params.id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    const usuarios = await Usuario.findAll({
      where: { organizacao_id: org.id },
      attributes: SEM_SENHA,
      order: [["nome", "ASC"]],
    });
    const ids = usuarios.map((u) => u.id);
    let ultimos = [];
    if (ids.length) {
      ultimos = await LoginLog.findAll({
        attributes: ["usuario_id", [fn("MAX", col("createdAt")), "ultimo"]],
        where: { usuario_id: { [Op.in]: ids }, sucesso: true },
        group: ["usuario_id"],
        raw: true,
      });
    }
    const mapa = Object.fromEntries(ultimos.map((r) => [r.usuario_id, r.ultimo]));
    return res.json(
      usuarios.map((u) => ({ ...u.toJSON(), ultimoAcesso: mapa[u.id] || null }))
    );
  } catch (e) {
    console.error("Erro ao listar utilizadores (suporte):", e);
    return res.status(500).json({ erro: "Erro ao listar utilizadores" });
  }
};

exports.criarUsuario = async (req, res) => {
  try {
    const org = await Organizacao.findByPk(req.params.id);
    if (!org) return res.status(404).json({ erro: "Organização não encontrada" });
    const senhaGerada = req.body?.senha || gerarSenha();
    const novo = await criarUsuarioDeOrg(org.id, { ...req.body, senha: senhaGerada });
    await suporteAuditoria.registar(req, "criar_usuario", { tipo: "usuario", id: novo.id }, {
      organizacao_id: org.id,
      email: novo.email,
      perfil: novo.perfil,
      senha_gerada: !req.body?.senha,
    });
    return res.status(201).json({
      usuario: semSenha(novo),
      credenciais: { email: novo.email, senha: senhaGerada, gerada: !req.body?.senha },
    });
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error("Erro ao criar utilizador (suporte):", e);
    return res.status(500).json({ erro: "Erro ao criar utilizador" });
  }
};

exports.atualizarUsuario = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.params.id);
    if (!usuario) return res.status(404).json({ erro: "Utilizador não encontrado" });
    const { nome, email, perfil, funcao, permissoes, ativo, senha } = req.body || {};
    const senhaReposta = !!(senha && String(senha).trim());
    const alterados = [];
    if (nome !== undefined) { usuario.nome = nome; alterados.push("nome"); }
    if (email !== undefined) { usuario.email = email; alterados.push("email"); }
    if (perfil !== undefined) { usuario.perfil = perfil; alterados.push("perfil"); }
    if (funcao !== undefined) { usuario.funcao = funcao; alterados.push("funcao"); }
    if (permissoes !== undefined) { usuario.permissoes = permissoes; alterados.push("permissoes"); }
    if (ativo !== undefined) { usuario.ativo = !!ativo; alterados.push("ativo"); }
    if (senhaReposta) {
      usuario.senha = await bcrypt.hash(senha, 10);
      alterados.push("senha");
    }
    await usuario.save();
    await suporteAuditoria.registar(
      req,
      senhaReposta ? "repor_senha" : "atualizar_usuario",
      { tipo: "usuario", id: usuario.id },
      { organizacao_id: usuario.organizacao_id, email: usuario.email, campos: alterados }
    );
    return res.json(semSenha(usuario));
  } catch (e) {
    console.error("Erro ao atualizar utilizador (suporte):", e);
    return res.status(500).json({ erro: "Erro ao atualizar utilizador" });
  }
};

exports.listarAcessos = async (req, res) => {
  try {
    const { pagina, limite, offset } = paginacao(req.query);
    const where = {};
    if (req.query.org_id) where.organizacao_id = Number(req.query.org_id);
    if (req.query.so_sucessos === "1" || req.query.so_sucessos === "true") where.sucesso = true;
    if (req.query.so_sucessos === "0" || req.query.so_sucessos === "false") where.sucesso = false;
    const busca = String(req.query.busca || "").trim();
    if (busca) where.email = { [Op.like]: `%${busca}%` };

    const total = await LoginLog.count({ where });
    const logs = await LoginLog.findAll({
      where,
      include: [{ model: Usuario, attributes: ["id", "nome"] }],
      order: [["createdAt", "DESC"]],
      offset,
      limit: limite,
    });
    return res.json({
      itens: logs.map((l) => ({
        ...l.toJSON(),
        usuario_nome: l.Usuario?.nome || null,
      })),
      total,
      pagina,
      limite,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    });
  } catch (e) {
    console.error("Erro ao listar acessos (suporte):", e);
    return res.status(500).json({ erro: "Erro ao listar acessos" });
  }
};
