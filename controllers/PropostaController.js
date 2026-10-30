const { sequelize, Proposta, PropostaEvento, PropostaDocumento, Cliente, Orcamento, Usuario } = require("../models");
const { Op, Transaction } = require("sequelize");

const UNIDADES = {
  "UN-01": { sigla: "AG", rotulo: "Artes Gráficas" },
  "UN-02": { sigla: "FP", rotulo: "Formação Profissional" },
  "UN-03": { sigla: "SD", rotulo: "Solução Digital" },
};

const ESTADOS = ["rascunho", "enviada", "recebida", "avaliada", "aprovada", "rejeitada", "anulada"];

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

// Rótulos dos campos para o registo de quem alterou a proposta.
const ROTULO_CAMPO = {
  cliente_id: "cliente",
  unidade: "unidade de negócio",
  versao: "versão",
  tipo: "tipo",
  origem: "origem",
  objecto: "objecto",
  familia: "família",
  produto: "produto",
  produtos: "produtos",
  formato: "formato",
  quantidade: "quantidade",
  suporte: "suporte",
  cores: "cores",
  acabamento: "acabamento",
  descricao: "descrição",
  data_emissao: "data de emissão",
  validade_data: "validade",
  valor: "valor",
  condicoes_pagamento: "condições de pagamento",
  prazo_execucao: "prazo de execução",
  prazo_entrega: "prazo de entrega",
  local_entrega: "local de entrega",
  condicoes_entrega: "condições de entrega",
  observacoes: "observações",
  estado_documental: "estado documental",
  modelo_documental: "modelo documental",
  responsavel_comercial: "responsável comercial",
  validade: "validade em dias",
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
  if (p.validade_data) {
    const texto = p.validade_data instanceof Date
      ? p.validade_data.toISOString().slice(0, 10)
      : String(p.validade_data).slice(0, 10);
    if (texto) return texto;
  }
  const base = p.data_envio || p.createdAt;
  if (!base) return null;
  const data = new Date(base);
  if (isNaN(data.getTime())) return null;
  data.setDate(data.getDate() + (Number(p.validade) || 0));
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function dataISO(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

// Lista de produtos acabados da proposta. Propostas antigas guardavam um
// único produto nas colunas produto/quantidade — convertem-se numa lista.
function produtosDaProposta(dados) {
  if (Array.isArray(dados.produtos) && dados.produtos.length) {
    return dados.produtos
      .filter((p) => p && String(p.nome || "").trim())
      .map((p) => ({ nome: String(p.nome).trim(), quantidade: String(p.quantidade || "").trim() }));
  }
  if (dados.produto) return [{ nome: dados.produto, quantidade: dados.quantidade || "" }];
  return [];
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
    versao: dados.versao || "",
    tipo: dados.tipo || "",
    origem: dados.origem || "",
    objecto: dados.objecto,
    familia: dados.familia || "",
    produto: dados.produto || "",
    produtos: produtosDaProposta(dados),
    formato: dados.formato || "",
    quantidade: dados.quantidade || "",
    suporte: dados.suporte || "",
    cores: dados.cores || "",
    acabamento: dados.acabamento || "",
    descricao: dados.descricao || "",
    data_emissao: dataISO(dados.data_emissao) || dataISO(dados.createdAt),
    valor: Number(dados.valor) || 0,
    condicoes_pagamento: dados.condicoes_pagamento || "",
    prazo_execucao: dados.prazo_execucao || "",
    prazo_entrega: dados.prazo_entrega || "",
    local_entrega: dados.local_entrega || "",
    condicoes_entrega: dados.condicoes_entrega || "",
    observacoes: dados.observacoes || "",
    estado_documental: dados.estado_documental || "",
    modelo_documental: dados.modelo_documental || "",
    responsavel_comercial: dados.responsavel_comercial || "",
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
    anulado: Boolean(dados.anulado),
    motivo_anulacao: dados.motivo_anulacao || "",
    anulado_por: dados.anulado_por || "",
    data_anulacao: dados.data_anulacao || null,
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
  const prefixo = `KPROP-${ano}-${sigla}-`;
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
  if (body.versao !== undefined) dados.versao = lerTexto(body.versao, 20);
  if (body.tipo !== undefined) dados.tipo = lerTexto(body.tipo, 100);
  if (body.origem !== undefined) dados.origem = lerTexto(body.origem, 100);
  if (body.objecto !== undefined) dados.objecto = lerTexto(body.objecto, 200);
  if (body.familia !== undefined) dados.familia = lerTexto(body.familia, 100);
  if (body.produto !== undefined) dados.produto = lerTexto(body.produto, 150);
  if (body.formato !== undefined) dados.formato = lerTexto(body.formato, 100);
  if (body.quantidade !== undefined) dados.quantidade = lerTexto(body.quantidade, 100);
  if (body.suporte !== undefined) dados.suporte = lerTexto(body.suporte, 100);
  if (body.produtos !== undefined) {
    const lista = Array.isArray(body.produtos) ? body.produtos : [];
    dados.produtos = lista
      .map((p) => ({
        nome: lerTexto(p?.nome, 150) || "",
        quantidade: lerTexto(p?.quantidade, 100) || "",
      }))
      .filter((p) => p.nome);
  }
  if (body.cores !== undefined) dados.cores = lerTexto(body.cores, 100);
  if (body.acabamento !== undefined) dados.acabamento = lerTexto(body.acabamento, 150);
  if (body.descricao !== undefined) dados.descricao = lerTexto(body.descricao);
  if (body.data_emissao !== undefined || body.dataEmissao !== undefined) {
    dados.data_emissao = lerTexto(body.data_emissao ?? body.dataEmissao, 10) || null;
  }
  if (body.validade_data !== undefined || body.validadeData !== undefined) {
    dados.validade_data = lerTexto(body.validade_data ?? body.validadeData, 10) || null;
  }
  if (body.valor !== undefined) dados.valor = Number(body.valor) || 0;
  if (body.condicoes_pagamento !== undefined || body.condicoesPagamento !== undefined) {
    dados.condicoes_pagamento = lerTexto(body.condicoes_pagamento ?? body.condicoesPagamento, 200);
  }
  if (body.prazo_execucao !== undefined || body.prazoExecucao !== undefined) {
    dados.prazo_execucao = lerTexto(body.prazo_execucao ?? body.prazoExecucao, 100);
  }
  if (body.prazo_entrega !== undefined || body.prazoEntrega !== undefined) {
    dados.prazo_entrega = lerTexto(body.prazo_entrega ?? body.prazoEntrega, 100);
  }
  if (body.local_entrega !== undefined || body.localEntrega !== undefined) {
    dados.local_entrega = lerTexto(body.local_entrega ?? body.localEntrega, 200);
  }
  if (body.condicoes_entrega !== undefined || body.condicoesEntrega !== undefined) {
    dados.condicoes_entrega = lerTexto(body.condicoes_entrega ?? body.condicoesEntrega, 200);
  }
  if (body.observacoes !== undefined) dados.observacoes = lerTexto(body.observacoes);
  if (body.estado_documental !== undefined || body.estadoDocumental !== undefined) {
    dados.estado_documental = lerTexto(body.estado_documental ?? body.estadoDocumental, 50);
  }
  if (body.modelo_documental !== undefined || body.modeloDocumental !== undefined) {
    dados.modelo_documental = lerTexto(body.modelo_documental ?? body.modeloDocumental, 100);
  }
  if (body.responsavel_comercial !== undefined || body.responsavelComercial !== undefined) {
    dados.responsavel_comercial = lerTexto(body.responsavel_comercial ?? body.responsavelComercial, 150);
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
    const hoje = new Date().toISOString().slice(0, 10);
    const proposta = await Proposta.create({
      ...dados,
      data_emissao: dados.data_emissao || hoje,
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

    // Campos realmente alterados, para o registo de quem editou.
    const alterados = Object.keys(dados).filter((campo) => {
      const antes = proposta[campo];
      const depois = dados[campo];
      if (campo === "produtos") {
        return JSON.stringify(Array.isArray(antes) ? antes : []) !== JSON.stringify(Array.isArray(depois) ? depois : []);
      }
      if (antes === depois) return false;
      if (antes === undefined || antes === null) return depois !== undefined && depois !== null;
      return String(antes) !== String(depois);
    });

    await proposta.update(dados);
    await registarEvento(
      proposta.id,
      "rascunho",
      req.usuario.id,
      alterados.length
        ? `Alterou: ${alterados.map((c) => ROTULO_CAMPO[c] || c).join(", ")}`
        : "Guardou sem alterações"
    );

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

// Uma proposta nunca é eliminada: é anulada, com motivo obrigatório, e fica
// no histórico com o estado "anulada".
exports.anular = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });
    if (proposta.estado === "anulada") {
      return res.status(422).json({ erro: "Esta proposta já está anulada" });
    }
    const motivo = req.body?.motivo ? String(req.body.motivo).trim() : "";
    if (!motivo) return res.status(422).json({ erro: "Indique o motivo da anulação" });
    await proposta.update({
      estado: "anulada",
      anulado: true,
      motivo_anulacao: motivo,
      anulado_por: req.usuario?.nome || req.usuario?.email || "",
      data_anulacao: new Date(),
    });
    await registarEvento(proposta.id, "anulada", req.usuario.id, `Proposta anulada — ${motivo}`);

    const completa = await carregarCompleta(proposta.id, req.organizacao_id);
    return res.json(serializar(completa));
  } catch (e) {
    console.error("Erro ao anular proposta:", e);
    return res.status(500).json({ erro: "Erro ao anular proposta" });
  }
};

exports.unidades = (req, res) => {
  return res.json(
    Object.entries(UNIDADES).map(([codigo, u]) => ({ codigo, sigla: u.sigla, rotulo: u.rotulo }))
  );
};

// ─── Documentos (anexos) da proposta ───

// Tipo devolvido ao browser derivado da extensão guardada, nunca do mimetype
// enviado pelo cliente (que permitia servir HTML como se fosse PDF).
const MIME_DOCUMENTO = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function mimeDoDocumento(nome) {
  const ext = String(nome || "").toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || "";
  return MIME_DOCUMENTO[ext] || "application/octet-stream";
}

function serializarDocumento(doc) {
  const obj = doc.toJSON ? doc.toJSON() : doc;
  delete obj.conteudo;
  return obj;
}

// Procura um documento garantindo que a proposta pertence à organização.
async function documentoDaOrganizacao(docId, organizacaoId) {
  const doc = await PropostaDocumento.findOne({
    where: { id: docId, organizacao_id: organizacaoId },
  });
  if (!doc) return null;
  const proposta = await Proposta.findOne({
    where: { id: doc.proposta_id, organizacao_id: organizacaoId },
  });
  return proposta ? doc : null;
}

exports.listarDocumentos = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });
    const documentos = await PropostaDocumento.findAll({
      where: { proposta_id: proposta.id, organizacao_id: req.organizacao_id },
      attributes: { exclude: ["conteudo"] },
      order: [["id", "DESC"]],
    });
    return res.json(documentos.map(serializarDocumento));
  } catch (e) {
    console.error("Erro ao listar documentos da proposta:", e);
    return res.status(500).json({ erro: "Erro ao listar documentos" });
  }
};

exports.anexarDocumentos = async (req, res) => {
  try {
    const proposta = await Proposta.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!proposta) return res.status(404).json({ erro: "Proposta não encontrada" });

    const ficheiros = req.files || [];
    if (!ficheiros.length) return res.status(400).json({ erro: "Nenhum ficheiro recebido" });

    const autor = req.usuario?.nome || req.usuario?.email || "";
    const criados = [];
    for (const f of ficheiros) {
      criados.push(await PropostaDocumento.create({
        organizacao_id: req.organizacao_id,
        proposta_id: proposta.id,
        nome_original: f.originalname || "documento",
        mime: f.mimetype || "",
        tamanho: f.size || 0,
        conteudo: f.buffer || null,
        anexado_por: autor,
      }));
    }
    await registarEvento(
      proposta.id,
      proposta.estado,
      req.usuario.id,
      `Anexou ${ficheiros.length} documento(s): ${ficheiros.map((f) => f.originalname).join(", ")}`
    );
    return res.status(201).json(criados.map(serializarDocumento));
  } catch (e) {
    console.error("Erro ao anexar documentos da proposta:", e);
    return res.status(500).json({ erro: "Erro ao anexar documentos" });
  }
};

exports.abrirDocumento = async (req, res) => {
  try {
    const doc = await documentoDaOrganizacao(req.params.docId, req.organizacao_id);
    if (!doc) return res.status(404).json({ erro: "Documento não encontrado" });
    if (!doc.conteudo || !doc.conteudo.length) {
      return res.status(410).json({ erro: "Ficheiro indisponível (não existe cópia guardada)" });
    }

    const nomeSeguro = String(doc.nome_original || "documento").replace(/[^\w.\- ]+/g, "_");
    const mime = mimeDoDocumento(nomeSeguro);
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", doc.conteudo.length);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.setHeader("X-Content-Type-Options", "nosniff");
    const disposicao = mime === "application/octet-stream" ? "attachment" : "inline";
    res.setHeader("Content-Disposition", `${disposicao}; filename*=UTF-8''${encodeURIComponent(nomeSeguro)}`);
    return res.end(doc.conteudo);
  } catch (e) {
    console.error("Erro ao abrir documento da proposta:", e);
    return res.status(500).json({ erro: "Erro ao abrir documento" });
  }
};

// Um documento nunca é eliminado: fica no histórico marcado como anulado.
exports.anularDocumento = async (req, res) => {
  try {
    const doc = await documentoDaOrganizacao(req.params.docId, req.organizacao_id);
    if (!doc) return res.status(404).json({ erro: "Documento não encontrado" });
    if (doc.anulado) return res.status(400).json({ erro: "Este documento já está anulado" });

    await doc.update({
      anulado: true,
      anulado_em: new Date(),
      anulado_por: req.usuario?.nome || req.usuario?.email || "",
    });
    await registarEvento(
      doc.proposta_id,
      (await Proposta.findByPk(doc.proposta_id))?.estado || "rascunho",
      req.usuario.id,
      `Anulou o documento "${doc.nome_original}"`
    );
    return res.json(serializarDocumento(doc));
  } catch (e) {
    console.error("Erro ao anular documento da proposta:", e);
    return res.status(500).json({ erro: "Erro ao anular documento" });
  }
};
