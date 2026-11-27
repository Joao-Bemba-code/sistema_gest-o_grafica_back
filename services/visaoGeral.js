const bcrypt = require("bcryptjs");
const { Usuario } = require("../models");

const UNIDADES = [
  { codigo: "UN-01", nome: "Artes Gráficas (B2)" },
  { codigo: "UN-02", nome: "Academia Formação" },
  { codigo: "UN-03", nome: "Atelier Tecnológico" },
  { codigo: "UN-04", nome: "Comercial & Serviços" },
];

const fusos = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Luanda",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function hojeISO() {
  return fusos.format(new Date());
}

function mesAtualISO() {
  return `${hojeISO().slice(0, 7)}-01`;
}

function mesAnteriorISO() {
  const [ano, mes] = mesAtualISO().split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 2, 1)).toISOString().slice(0, 10);
}

function dataValida(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor;
}

function numeroValor(valor, { permitirZero = true } = {}) {
  if (valor === "" || valor === null || valor === undefined) return permitirZero ? 0 : null;
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 0 || (!permitirZero && numero === 0)) return null;
  return Number(numero.toFixed(2));
}

function texto(valor, maximo = 300) {
  return String(valor || "").trim().slice(0, maximo);
}

async function proximoCodigo(Model, organizacaoId, prefixo, transaction) {
  const ultimo = await Model.findOne({
    where: { organizacao_id: organizacaoId },
    order: [["id", "DESC"]],
    transaction,
  });
  const ultimoNumero = Number(String(ultimo?.codigo || "").match(/(\d+)$/)?.[1] || 0);
  return `${prefixo}-${new Date().getFullYear()}/${String(ultimoNumero + 1).padStart(3, "0")}`;
}

const tentativasPin = new Map();

function chavePin(req) {
  return `${req.organizacao_id}:${req.usuario.id}:${req.ip || "local"}`;
}

async function validarPin(req, pin) {
  const usuario = await Usuario.findByPk(req.usuario.id, {
    attributes: ["id", "pin_hash"],
  });
  if (!usuario?.pin_hash) {
    const erro = new Error("Configure o PIN eletrónico antes de assinar.");
    erro.status = 428;
    throw erro;
  }

  const chave = chavePin(req);
  const tentativa = tentativasPin.get(chave);
  const agora = Date.now();
  if (tentativa && tentativa.bloqueadoAte > agora) {
    const erro = new Error("PIN bloqueado temporariamente. Tente novamente mais tarde.");
    erro.status = 429;
    throw erro;
  }

  const valido = /^\d{4,6}$/.test(String(pin || "")) && await bcrypt.compare(String(pin), usuario.pin_hash);
  if (!valido) {
    const falhas = (!tentativa || tentativa.bloqueadoAte <= agora ? 0 : tentativa.falhas) + 1;
    tentativasPin.set(chave, {
      falhas,
      bloqueadoAte: falhas >= 5 ? agora + 15 * 60 * 1000 : 0,
    });
    const erro = new Error(falhas >= 5 ? "PIN bloqueado por 15 minutos." : "PIN eletrónico inválido.");
    erro.status = falhas >= 5 ? 429 : 401;
    throw erro;
  }

  tentativasPin.delete(chave);
  return true;
}

async function configurarPin(req, pin, senhaAtual) {
  if (!/^\d{4,6}$/.test(String(pin || ""))) {
    const erro = new Error("O PIN deve ter entre 4 e 6 dígitos.");
    erro.status = 422;
    throw erro;
  }
  const usuario = await Usuario.findByPk(req.usuario.id, { attributes: ["id", "senha"] });
  if (!usuario || !(await bcrypt.compare(String(senhaAtual || ""), usuario.senha))) {
    const erro = new Error("Senha atual inválida.");
    erro.status = 401;
    throw erro;
  }
  usuario.pin_hash = await bcrypt.hash(String(pin), 10);
  usuario.pin_atualizado_em = new Date();
  await usuario.save();
  return { configurado: true, atualizado_em: usuario.pin_atualizado_em };
}

module.exports = {
  UNIDADES,
  hojeISO,
  mesAtualISO,
  mesAnteriorISO,
  dataValida,
  numeroValor,
  texto,
  proximoCodigo,
  validarPin,
  configurarPin,
};
