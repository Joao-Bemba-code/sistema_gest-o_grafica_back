const { sequelize, Proposta, PropostaEvento, Cliente, Orcamento, Usuario } = require("../models");
const { Op, Transaction } = require("sequelize");

const UNIDADES = {
  "UN-01": { sigla: "AG", rotulo: "Artes Gráficas" },
  "UN-02": { sigla: "FP", rotulo: "Formação Profissional" },
  "UN-03": { sigla: "SD", rotulo: "Solução Digital" },
};

const ESTADOS = ["rascunho", "enviada", "recebida", "avaliada", "aprovada", "rejeitada"];

// Passos permitidos do ciclo da proposta.
const TRANSICOES = {
  rascunho: ["enviada"],
  enviada: ["recebida", "rejeitada"],
  recebida: ["avaliada", "rejeitada"],
  avaliada: ["aprovada", "rejeitada"],
  aprovada: [],
  rejeitada: [],
};

const CAMPO_DATA = {
  enviada: "data_envio",
  recebida: "data_recebida",
  avaliada: "data_avaliada",
  aprovada: "data_aprovada",
  rejeitada: "data_rejeitada",
};

function includeCliente() {
  return [
    { model: Cliente, required: false },
    { model: Usuario, as: "usuario", required: false, attributes: ["id", "nome"] },
    { model: Orcamento, as: "orcamento", required: false, attributes: ["id", "numero", "estado"] },
  ];
}

function serializarCliente(cli) {
  if (!cli) return null;
  return {
    id: cli.id,
    nome: cli.nome || "",
    empresa: cli.empresa || "",
    nif: cli.nif || "",
    telefone: cli.telefone || "",
    email: cli.email || "",
    endereco: cli.endereco || "",
  };
}

function dataValidade(p) {
  const base = p.data_envio || p.createdAt;
  if (!base) return null;
  const data = new Date(base);
  if (isNaN(data.getTime())) return null;
  data.setDate(data.getDate() + (Number(p.validade) || 0));
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function serializar(p, eventos) {
  const dados = p.toJSON ? p.toJSON() : p;
  const eventosOrdenados = [...(eventos || dados.eventos || [])].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
  return {
    id: dados.id,
    numero: dados.numero,
    unidade: dados.unidade,
    unidade_rotulo: UNIDADES[dados.unidade]?.rotulo || "",
    cliente_id: dados.cliente_id,
    cliente: serializarCliente(dados.cliente),
    objecto: dados.objecto,
    descricao: dados.descricao || "",
    prazo_execucao: dados.prazo_execucao || "",
    validade: Number(dados.validade) || 0,
    validade_data: dataValidade(dados),
    estado: dados.estado,
    data_envio: dados.data_envio || null,
    data_recebida: dados.data_recebida || null,
    data_avaliada: dados.data_avaliada || null,
    data_aprovada: dados.data_aprovada || null,
    data_rejeitada: dados.data_rejeitada || null,
    avaliacao: dados.avaliacao || "",
    motivo_rejeicao: dados.motivo_rejeicao || "",
    orcamento_id: dados.orcamento_id || null,
    orcamento: dados.orcamento
      ? { id: dados.orcamento.id, numero: dados.orcamento.numero, estado: dados.orcamento.estado }
      : null,
    responsavel: dados.usuario?.nome || "",
    criada_em: dados.createdAt || null,
    eventos: eventosOrdenados.map((e) => ({
      id: e.id,
      estado: e.estado,
      observacao: e.observacao || "",
      usuario: e.usuario?.nome || "",
      data: e.createdAt || null,
    })),
  };
}

async function proximoNumero(organizacao_id, unidade) {
  const ano = new Date().getFullYear();
  const sigla = UNIDADES[unidade]?.sigla || "AG";
  const prefixo = `PROP-${ano}-${sigla}-`;
  return sequelize.transaction(async (t) => {
    const lock = sequelize.getDialect() === "mysql" ? Transaction.LOCK.UPDATE : undefined;
    // Inclui propostas eliminadas para nunca reutilizar um número.
    const existentes = await Proposta.unscoped().findAll({
      where: { organizacao_id, numero: { [Op.like]: `${prefixo}%` } },
      attributes: ["numero"],
      transaction: t,
      lock,
    });
    const maior = existentes.reduce((max, p) => {
      const seq = parseInt(String(p.numero).slice(prefixo.length), 10) || 0;
      return Math.max(max, seq);
    }, 0);
    return `${prefixo}${String(maior + 1).padStart(3, "0")}`;
  });
}

function lerTexto(valor, limite) {
  if (valor === undefined || valor === null) return undefined;
  const texto = String(valor).trim();
  if (!texto) return "";
  return limite ? texto.slice(0, limite) : texto;
}

function normalizarDados(body) {
  const dados = {};
  if (body.cliente_id !== undefined) dados.cliente_id = Number(body.cliente_id) || null;
  if (body.unidade !== undefined) dados.unidade = String(body.unidade).trim();
  if (body.objecto !== undefined) dados.objecto = lerTexto(body.objecto, 200);
  if (body.descricao !== undefined) dados.descricao = lerTexto(body.descricao);
  if (body.prazo_execucao !== undefined || body.prazoExecucao !== undefined) {
    dados.prazo_execucao = lerTexto(body.prazo_execucao ?? body.prazoExecucao, 100);
  }
  if (body.validade !== undefined) dados.validade = Number(body.validade);
  return dados;
}

async function validar(dados, organizacao_id, { parcial = false } = {}) {
  if (!parcial || dados.cliente_id !== undefined) {
    if (!dados.cliente_id) return "Escolha o cliente da proposta";
    const cliente = await Cliente.findOne({ where: { id: dados.cliente_id, organizacao_id } });
    if (!cliente) return "Cliente não encontrado";
  }
  if (!parcial || dados.unidade !== undefined) {
    if (!UNIDADES[dados.unidade]) return "Unidade de negócio inválida";
  }
  if (!parcial || dados.objecto !== undefined) {
    if (!dados.objecto) return "Indique o objecto da proposta";
  }
  if (dados.validade !== undefined) {
    if (!Number.isFinite(dados.validade) || dados.validade < 0 || dados.validade > 3650) {
      return "Validade inválida (indicar em dias)";
    }
  }
  return null;
}

async function registarEvento(proposta_id, estado, usuario_id, observacao) {
  return PropostaEvento.create({ proposta_id, estado, usuario_id, observacao: observacao || null });
}

async function carregarCompleta(id, organizacao_id) {
  return Proposta.findOne({
    where: { id, organizacao_id },
    include: [...includeCliente(), { model: PropostaEvento, as: "eventos", required: false, include: [{ model: Usuario, as: "usuario", required: false, attributes: ["id", "nome"] }] }],
  });
}

exports.listar = async (req, res) => {
  try {
    const where = { organizacao_id: req.organizacao_id };
    if (req.query.estado && ESTADOS.includes(req.query.estado)) where.estado = req.query.estado;
    if (req.query.unidade && UNIDADES[req.query.unidade]) where.unidade = req.query.unidade;
    if (req.query.cliente_id) where.cliente_id = Number(req.query.cliente_id) || 0;

    const propostas = await Proposta.findAll({
      where,
      include: includeCliente(),
      order: [["createdAt", "DESC"]],
    });
    return res.json(propostas.map((p) => serializar(p)));
  } catch (e) {
    console.error("Erro ao listar propostas:", e);
    return res.status(500).json({ erro: "Erro ao listar propostas" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const proposta = await carregarCompleta(req.params.id, req.organizacao_id);
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });
    return res.json(serializar(proposta));
  } catch (e) {
    console.error("Erro ao buscar proposta:", e);
    return res.status(500).json({ erro: "Erro ao buscar proposta" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = normalizarDados(req.body);
    const erro = await validar(dados, req.organizacao_id);
    if (erro) return res.status(422).json({ erro });

    const numero = await proximoNumero(req.organizacao_id, dados.unidade);
    const proposta = await Proposta.create({
      ...dados,
      numero,
      estado: "rascunho",
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
    });
    await registarEvento(proposta.id, "rascunho", req.usuario.id, "Proposta criada");

    const completa = await carregarCompleta(proposta.id, req.organizacao_id);
    return res.status(201).json(serializar(completa));
  } catch (e) {
    console.error("Erro ao criar proposta:", e);
    return res.status(500).json({ erro: "Erro ao criar proposta" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });
    if (proposta.estado !== "rascunho") {
      return res.status(422).json({ erro: "Só é possível editar propostas em rascunho" });
    }
    const dados = normalizarDados(req.body);
    const erro = await validar(dados, req.organizacao_id, { parcial: true });
    if (erro) return res.status(422).json({ erro });

    await proposta.update(dados);
    const completa = await carregarCompleta(proposta.id, req.organizacao_id);
    return res.json(serializar(completa));
  } catch (e) {
    console.error("Erro ao atualizar proposta:", e);
    return res.status(500).json({ erro: "Erro ao atualizar proposta" });
  }
};

exports.mudarEstado = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });

    const novo = String(req.body.estado || "").trim();
    if (!ESTADOS.includes(novo)) return res.status(422).json({ erro: "Estado inválido" });
    const permitidos = TRANSICOES[proposta.estado] || [];
    if (!permitidos.includes(novo)) {
      return res.status(422).json({
        erro: `Não é possível passar de "${proposta.estado}" para "${novo}"`,
      });
    }

    const dados = { estado: novo, [CAMPO_DATA[novo]]: new Date() };
    if (novo === "avaliada" && req.body.avaliacao !== undefined) {
      dados.avaliacao = lerTexto(req.body.avaliacao);
    }
    if (novo === "rejeitada" && req.body.motivo !== undefined) {
      dados.motivo_rejeicao = lerTexto(req.body.motivo);
    }
    await proposta.update(dados);

    const rotulo = {
      enviada: "Proposta enviada ao cliente",
      recebida: "Cliente confirmou a recepção",
      avaliada: "Proposta avaliada pelo cliente",
      aprovada: "Proposta aprovada pelo cliente",
      rejeitada: "Proposta rejeitada pelo cliente",
    }[novo];
    await registarEvento(
      proposta.id,
      novo,
      req.usuario.id,
      dados.motivo_rejeicao || dados.avaliacao || rotulo
    );

    const completa = await carregarCompleta(proposta.id, req.organizacao_id);
    return res.json(serializar(completa));
  } catch (e) {
    console.error("Erro ao mudar estado da proposta:", e);
    return res.status(500).json({ erro: "Erro ao mudar o estado da proposta" });
  }
};

exports.vincularOrcamento = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });
    if (proposta.estado !== "aprovada") {
      return res.status(422).json({ erro: "Só se cria orçamento a partir de propostas aprovadas" });
    }
    const orcamento_id = Number(req.body.orcamento_id) || null;
    if (!orcamento_id) return res.status(422).json({ erro: "Orçamento inválido" });
    const orcamento = await Orcamento.findOne({
      where: { id: orcamento_id, organizacao_id: req.organizacao_id },
      attributes: ["id", "numero"],
    });
    if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado" });

    await proposta.update({ orcamento_id: orcamento.id });
    await registarEvento(
      proposta.id,
      proposta.estado,
      req.usuario.id,
      `Orçamento ${orcamento.numero} associado à proposta`
    );

    const completa = await carregarCompleta(proposta.id, req.organizacao_id);
    return res.json(serializar(completa));
  } catch (e) {
    console.error("Erro ao associar orçamento à proposta:", e);
    return res.status(500).json({ erro: "Erro ao associar orçamento à proposta" });
  }
};

exports.remover = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });
    if (proposta.estado !== "rascunho") {
      return res.status(422).json({ erro: "Só é possível eliminar propostas em rascunho" });
    }
    await proposta.update({ deleted: true, deletedAt: new Date() });
    return res.json({ ok: true });
  } catch (e) {
    console.error("Erro ao eliminar proposta:", e);
    return res.status(500).json({ erro: "Erro ao eliminar proposta" });
  }
};

exports.unidades = (req, res) => {
  return res.json(
    Object.entries(UNIDADES).map(([codigo, u]) => ({ codigo, sigla: u.sigla, rotulo: u.rotulo }))
  );
};
