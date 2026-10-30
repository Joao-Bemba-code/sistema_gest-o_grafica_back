const { Cliente, ClienteDocumento, Auditoria, Usuario } = require("../models");
const auditoria = require("../services/auditoria");

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

function gerarCodigo(tipo, id) {
  const prefixo = tipo === "fornecedor" ? "KFOR" : "KCLI";
  return `${prefixo}-${String(id).padStart(4, "0")}`;
}

function normalizarDados(body) {
  const dados = { ...body };
  delete dados.organizacao_id;
  if (dados.dataCadastro !== undefined) {
    dados.data_cadastro = dados.dataCadastro || null;
    delete dados.dataCadastro;
  }
  return dados;
}

function dataISO(valor) {
  if (!valor) return null;
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return String(valor).slice(0, 10);
}

function serializar(cliente) {
  const obj = cliente.toJSON ? cliente.toJSON() : cliente;
  const dataCadastro = dataISO(obj.data_cadastro) || dataISO(obj.createdAt);
  return {
    ...obj,
    codigo: obj.codigo || gerarCodigo(obj.tipo, obj.id),
    dataCadastro,
    data_cadastro: dataCadastro,
  };
}

exports.listar = async (req, res) => {
  try {
    const { tipo, busca } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (tipo) where.tipo = tipo;
    if (busca) {
      const { Op } = require("sequelize");
      where[Op.or] = [
        { nome: { [Op.like]: `%${busca}%` } },
        { empresa: { [Op.like]: `%${busca}%` } },
        { nif: { [Op.like]: `%${busca}%` } },
      ];
    }
    const clientes = await Cliente.findAll({ where, order: [["nome", "ASC"], ["id", "ASC"]] });
    const serializados = clientes.map(serializar);
    const vistos = new Set();
    const unicos = [];
    for (const c of serializados) {
      if (c.deleted === 1 || c.deletedAt) continue;
      const emp = (c.empresa || "").trim().toLowerCase();
      const nom = (c.nome || "").trim().toLowerCase();
      // A chave é o NOME do cliente (não o NIF nem a empresa): registos com o
      // mesmo nome são o mesmo cliente repetido, e clientes diferentes que
      // partilham o mesmo NIF/empresa não podem ser escondidos da lista.
      const chave = nom ? `n:${nom}` : emp ? `e:${emp}` : `id:${c.id}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      unicos.push(c);
    }
    return res.json(unicos);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar clientes" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    return res.json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar cliente" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = normalizarDados(req.body);
    const cliente = await Cliente.create({ ...dados, organizacao_id: req.organizacao_id });
    if (!cliente.codigo) {
      await cliente.update({ codigo: gerarCodigo(cliente.tipo, cliente.id) });
    }
    auditoria.registrar({
      req,
      acao: "cliente.criar",
      alvoTipo: "cliente",
      alvoId: cliente.id,
      detalhe: `${cliente.tipo === "fornecedor" ? "Fornecedor" : "Cliente"} criado: ${cliente.nome}`,
    });
    return res.status(201).json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar cliente" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    const dados = normalizarDados(req.body);
    // Compara com os valores anteriores para descrever o que mudou no histórico.
    const antes = cliente.toJSON ? cliente.toJSON() : cliente;
    const rotulos = {
      nome: "nome", nif: "NIF", telefone: "telefone", whatsapp: "WhatsApp", email: "email",
      endereco: "morada", tipo_cliente: "tipo de cliente", categoria: "categoria",
      setor_atividade: "sector", unidade_negocio: "unidade de negócio",
      provincia: "província", municipio: "município", bairro: "bairro", ativo: "estado",
      observacoes: "observações",
    };
    const alterados = Object.keys(dados).filter(
      (k) => String(dados[k] ?? "") !== String(antes[k] ?? "")
    );
    await cliente.update(dados);
    if (!cliente.codigo) {
      await cliente.update({ codigo: gerarCodigo(cliente.tipo, cliente.id) });
    }
    auditoria.registrar({
      req,
      acao: "cliente.atualizar",
      alvoTipo: "cliente",
      alvoId: cliente.id,
      detalhe: alterados.length
        ? `Alterou: ${alterados.map((k) => rotulos[k] || k).join(", ")}`
        : "Guardou sem alterações",
    });
    return res.json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar cliente" });
  }
};

// Um cliente nunca é eliminado: é anulado, com motivo obrigatório, e fica
// no histórico marcado como anulado.
exports.anular = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    const motivo = req.body?.motivo ? String(req.body.motivo).trim() : "";
    if (!motivo) return res.status(400).json({ erro: "Indique o motivo da anulação" });
    if (cliente.anulado) return res.status(400).json({ erro: "Este cliente já está anulado" });
    await cliente.update({
      anulado: true,
      motivo_anulacao: motivo,
      anulado_por: req.usuario?.nome || req.usuario?.email || "",
      data_anulacao: new Date(),
    });
    auditoria.registrar({
      req,
      acao: "cliente.anular",
      alvoTipo: "cliente",
      alvoId: cliente.id,
      detalhe: `Anulou o cadastro de ${cliente.nome}. Motivo: ${motivo}`,
    });
    return res.json(serializar(cliente));
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao anular cliente" });
  }
};

// Histórico de auditoria do cliente: quem criou, alterou, anulou, anexou ou
// anulou documentos. Registos mais recentes primeiro.
exports.historico = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    const registos = await Auditoria.findAll({
      where: {
        organizacao_id: req.organizacao_id,
        alvo_tipo: "cliente",
        alvo_id: cliente.id,
      },
      include: [{ model: Usuario, attributes: ["id", "nome", "email"] }],
      order: [["id", "DESC"]],
      limit: 200,
    });
    const lista = registos.map((r) => {
      const obj = r.toJSON ? r.toJSON() : r;
      return {
        id: obj.id,
        acao: obj.acao,
        detalhe: obj.detalhe,
        ip: obj.ip,
        criado_em: obj.createdAt,
        usuario: obj.usuario?.nome || obj.usuario?.email || "Sistema",
      };
    });
    // Clientes criados antes da auditoria automática não têm registo de
    // criação: compõe-se uma entrada a partir da data de cadastro, para o
    // histórico mostrar sempre que o cliente foi cadastrado (quem criou, nesses
    // casos antigos, não ficou registado).
    if (!lista.some((r) => r.acao === "cliente.criar")) {
      lista.push({
        id: 0,
        acao: "cliente.criar",
        detalhe: "Cadastro criado (registado antes da auditoria automática)",
        ip: null,
        criado_em: cliente.data_cadastro || cliente.createdAt,
        usuario: null,
      });
    }
    lista.sort((a, b) => new Date(b.criado_em || 0) - new Date(a.criado_em || 0));
    return res.json(lista);
  } catch (e) {
    console.error("Erro ao listar histórico do cliente:", e);
    return res.status(500).json({ erro: "Erro ao listar histórico" });
  }
};

// Procura um documento garantindo que o cliente pertence à organização.
async function documentoDaOrganizacao(docId, organizacaoId) {
  const doc = await ClienteDocumento.findOne({
    where: { id: docId, organizacao_id: organizacaoId },
  });
  if (!doc) return null;
  const cliente = await Cliente.findOne({
    where: { id: doc.cliente_id, organizacao_id: organizacaoId },
  });
  return cliente ? doc : null;
}

exports.listarDocumentos = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });
    const documentos = await ClienteDocumento.findAll({
      where: { cliente_id: cliente.id, organizacao_id: req.organizacao_id },
      attributes: { exclude: ["conteudo"] },
      order: [["id", "DESC"]],
    });
    return res.json(documentos.map(serializarDocumento));
  } catch (e) {
    console.error("Erro ao listar documentos do cliente:", e);
    return res.status(500).json({ erro: "Erro ao listar documentos" });
  }
};

exports.anexarDocumentos = async (req, res) => {
  try {
    const cliente = await Cliente.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado" });

    const ficheiros = req.files || [];
    if (!ficheiros.length) return res.status(400).json({ erro: "Nenhum ficheiro recebido" });

    const autor = req.usuario?.nome || req.usuario?.email || "";
    const criados = [];
    for (const f of ficheiros) {
      criados.push(await ClienteDocumento.create({
        organizacao_id: req.organizacao_id,
        cliente_id: cliente.id,
        nome_original: f.originalname || "documento",
        mime: f.mimetype || "",
        tamanho: f.size || 0,
        conteudo: f.buffer || null,
        anexado_por: autor,
      }));
    }
    auditoria.registrar({
      req,
      acao: "cliente.documento.anexar",
      alvoTipo: "cliente",
      alvoId: cliente.id,
      detalhe: `Anexou ${ficheiros.length} documento(s): ${ficheiros.map((f) => f.originalname).join(", ")}`,
    });
    return res.status(201).json(criados.map(serializarDocumento));
  } catch (e) {
    console.error("Erro ao anexar documentos do cliente:", e);
    return res.status(500).json({ erro: "Erro ao anexar documentos" });
  }
};

// Devolve o conteúdo do documento guardado na base de dados.
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
    console.error("Erro ao abrir documento do cliente:", e);
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
    auditoria.registrar({
      req,
      acao: "cliente.documento.anular",
      alvoTipo: "cliente",
      alvoId: doc.cliente_id,
      detalhe: `Anulou o documento "${doc.nome_original}"`,
    });
    return res.json(serializarDocumento(doc));
  } catch (e) {
    console.error("Erro ao anular documento do cliente:", e);
    return res.status(500).json({ erro: "Erro ao anular documento" });
  }
};
