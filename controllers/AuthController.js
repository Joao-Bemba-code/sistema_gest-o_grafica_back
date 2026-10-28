const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Usuario, Organizacao } = require("../models");
const { registarFalha, limparFalhas } = require("../protect/loginLimit");
const loginLog = require("../services/loginLog");
const { COOKIE_SESSAO } = require("../protect/auth");

const COOKIE_OPTS = () => ({
  httpOnly: true,
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 8 * 60 * 60 * 1000,
  path: "/",
});

function emitirToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      organizacao_id: usuario.organizacao_id,
      funcao: usuario.funcao,
      perfil: usuario.perfil,
      tv: Number(usuario.token_version || 0),
    },
    process.env.SECRET,
    { expiresIn: "8h" }
  );
}

function semSenha(usuario) {
  const { senha: _, ...dados } = usuario.toJSON ? usuario.toJSON() : usuario;
  return dados;
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""));
}

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(422).json({ erro: "Email e senha são obrigatórios" });
    }
    const ip = req.ip;
    const userAgent = req.headers?.["user-agent"] || null;
    const usuario = await Usuario.findOne({ where: { email }, include: [Organizacao] });

    // Resposta igual para conta inexistente, inativa ou senha errada: não se
    // revela quais emails existem no sistema (enumeração de contas).
    const credenciaisInvalidas = async (alvo, mensagem) => {
      registarFalha(req);
      await loginLog.registrar({
        organizacao_id: alvo?.organizacao_id,
        usuario_id: alvo?.id,
        email,
        sucesso: false,
        ip,
        user_agent: userAgent,
      });
      return res.status(401).json({ erro: mensagem });
    };

    if (!usuario) {
      return credenciaisInvalidas(null, "Credenciais inválidas");
    }
    if (!usuario.ativo || usuario.Organizacao?.ativo === false) {
      return credenciaisInvalidas(usuario, "Credenciais inválidas");
    }
    const senhaOk = await bcrypt.compare(senha, usuario.senha);
    if (!senhaOk) {
      return credenciaisInvalidas(usuario, "Credenciais inválidas");
    }
    limparFalhas(req);
    await loginLog.registrar({
      organizacao_id: usuario.organizacao_id,
      usuario_id: usuario.id,
      email,
      sucesso: true,
      ip,
      user_agent: userAgent,
    });
    const token = emitirToken(usuario);
    // Sessão principal via cookie HttpOnly; o token no corpo mantém-se apenas
    // como reserva para ambientes locais onde o browser não envia o cookie.
    res.cookie(COOKIE_SESSAO, token, COOKIE_OPTS());
    return res.json({ token, usuario: semSenha(usuario) });
  } catch (e) {
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};

exports.logout = (req, res) => {
  res.clearCookie(COOKIE_SESSAO, { ...COOKIE_OPTS(), maxAge: undefined });
  return res.json({ mensagem: "Sessão terminada" });
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
    // Fase 0 do relatório de segurança: enquanto o onboarding não estiver
    // pronto, o operador pode desligar o registo público com
    // SIGRAF_REGISTRO_PUBLICO=false (produção). Localmente continua aberto.
    if (process.env.SIGRAF_REGISTRO_PUBLICO === "false") {
      return res.status(403).json({
        erro: "O registo público está desativado. Contacte o suporte para criar a sua conta.",
      });
    }
    const { nome, senha, organizacao_nome } = req.body;
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!nome || !email || !senha || !organizacao_nome) {
      return res.status(422).json({ erro: "Nome, email, senha e organização são obrigatórios" });
    }
    if (!emailValido(email)) {
      return res.status(422).json({ erro: "Email inválido" });
    }
    if (String(senha).length < 8) {
      return res.status(422).json({ erro: "A senha deve ter pelo menos 8 caracteres" });
    }
    if (String(organizacao_nome).trim().length < 2) {
      return res.status(422).json({ erro: "Nome da organização inválido" });
    }
    const existe = await Usuario.findOne({ where: { email } });
    if (existe) return res.status(409).json({ erro: "Email já cadastrado" });
    const organizacao = await Organizacao.create({ nome: String(organizacao_nome).trim() });
    const hash = await bcrypt.hash(senha, 10);
    const usuario = await Usuario.create({
      organizacao_id: organizacao.id,
      nome: String(nome).trim().slice(0, 150),
      email,
      senha: hash,
      funcao: "admin",
      perfil: "admin",
    });
    await loginLog.registrar({
      organizacao_id: organizacao.id,
      usuario_id: usuario.id,
      email,
      sucesso: true,
      ip: req.ip,
      user_agent: req.headers?.["user-agent"] || null,
    });
    const token = emitirToken(usuario);
    res.cookie(COOKIE_SESSAO, token, COOKIE_OPTS());
    return res.status(201).json({
      mensagem: "Conta criada com sucesso",
      token,
      usuario: semSenha(usuario),
    });
  } catch (e) {
    console.error("Erro no registo:", e);
    return res.status(500).json({ erro: "Erro interno no servidor" });
  }
};
