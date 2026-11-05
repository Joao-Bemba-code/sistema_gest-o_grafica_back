const { ServicoExecucao, Servico, Organizacao, Usuario } = require("../models");

// O cálculo mora no servidor para que a cifra gravada não dependa do que o
// navegador enviou. A regra é a mesma do formulário de orçamento: o prazo pode
// vir em minutos, horas ou dias (1 dia = 8h) e o total é sempre
// trabalhadores × duração em horas × valor/hora.
const UNIDADES = ["minutos", "horas", "dias"];

function duracaoEmHoras(prazo, unidade) {
  const p = Number(prazo) || 0;
  let horas;
  if (unidade === "minutos") horas = Number((p / 60).toFixed(2));
  else if (unidade === "horas") horas = p;
  else horas = p * 8;
  return horas > 0 ? horas : 8;
}

function inteiro(valor, minimo, maximo) {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return minimo;
  return Math.min(Math.max(n, minimo), maximo);
}

async function normalizarCorpo(req) {
  const servicoId = req.body.servico_id ? inteiro(req.body.servico_id, 1, 1e9) : null;
  let nomeServico = String(req.body.descricao || "").trim();

  let valorHora = Number(req.body.valor_hora);
  if (!Number.isFinite(valorHora) || valorHora <= 0) valorHora = 0;

  let catalogo = null;
  if (servicoId) {
    catalogo = await Servico.findOne({ where: { id: servicoId, organizacao_id: req.organizacao_id } });
    if (!catalogo) {
      const erro = new Error("Serviço não encontrado nesta empresa");
      erro.status = 422;
      throw erro;
    }
    if (!nomeServico) nomeServico = catalogo.nome;
    // Sem valor/hora explícito, segue o catálogo; sem catálogo, o valor da empresa.
    if (!valorHora) valorHora = Number(catalogo.valor_hora) || 0;
  }
  if (!valorHora && !catalogo) {
    const org = await Organizacao.findByPk(req.organizacao_id);
    valorHora = Number(org?.valor_hora_servicos) || 0;
  }

  if (!nomeServico) {
    const erro = new Error("Indique o serviço ou seleccione-o da lista");
    erro.status = 422;
    throw erro;
  }

  const mob = inteiro(req.body.mob ?? 1, 1, 999);
  const prazo = inteiro(req.body.prazo_execucao ?? 1, 1, 9999);
  const unidade = UNIDADES.includes(req.body.prazo_unidade) ? req.body.prazo_unidade : "dias";
  const duracao = duracaoEmHoras(prazo, unidade);

  return {
    organizacao_id: req.organizacao_id,
    servico_id: servicoId,
    descricao: nomeServico.slice(0, 255),
    mob,
    prazo_execucao: prazo,
    prazo_unidade: unidade,
    duracao_horas: duracao,
    valor_hora: valorHora,
    total: Number((mob * duracao * valorHora).toFixed(2)),
    observacoes: String(req.body.observacoes || "").trim() || null,
    usuario_id: req.usuario?.id || null,
  };
}

const INCLUIDOS = [
  { model: Servico, as: "servicoCatalogo", required: false, attributes: ["id", "nome", "valor_hora"] },
  { model: Usuario, as: "usuario", required: false, attributes: ["id", "nome"] },
];

exports.listar = async (req, res) => {
  try {
    const registros = await ServicoExecucao.findAll({
      where: { organizacao_id: req.organizacao_id },
      include: INCLUIDOS,
      order: [["createdAt", "DESC"], ["id", "DESC"]],
    });
    return res.json(registros);
  } catch (e) {
    console.error("Erro ao listar serviços executados:", e.message);
    return res.status(500).json({ erro: "Erro ao listar os serviços" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const registro = await ServicoExecucao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: INCLUIDOS,
    });
    if (!registro) return res.status(404).json({ erro: "Serviço não encontrado" });
    return res.json(registro);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao obter o serviço" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = await normalizarCorpo(req);
    const registro = await ServicoExecucao.create(dados);
    const criado = await ServicoExecucao.findByPk(registro.id, { include: INCLUIDOS });
    return res.status(201).json(criado);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error("Erro ao criar serviço executado:", e.message);
    return res.status(500).json({ erro: "Erro ao guardar o serviço" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const registro = await ServicoExecucao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!registro) return res.status(404).json({ erro: "Serviço não encontrado" });
    const dados = await normalizarCorpo(req);
    // Quem registou e a empresa não se alteram com a edição.
    delete dados.organizacao_id;
    delete dados.usuario_id;
    await registro.update(dados);
    const atualizado = await ServicoExecucao.findByPk(registro.id, { include: INCLUIDOS });
    return res.json(atualizado);
  } catch (e) {
    if (e.status) return res.status(e.status).json({ erro: e.message });
    console.error("Erro ao atualizar serviço executado:", e.message);
    return res.status(500).json({ erro: "Erro ao atualizar o serviço" });
  }
};

exports.remover = async (req, res) => {
  try {
    const registro = await ServicoExecucao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!registro) return res.status(404).json({ erro: "Serviço não encontrado" });
    await registro.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Serviço removido com sucesso" });
  } catch (e) {
    console.error("Erro ao remover serviço executado:", e.message);
    return res.status(500).json({ erro: "Erro ao remover o serviço" });
  }
};
