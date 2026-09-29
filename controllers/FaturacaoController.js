const { Faturacao, Cliente, Orcamento, OrcamentoItem, OrdemProducao, TesourariaMovimento, ContaBancaria, Organizacao, SerieAGT } = require("../models");
const agtClient = require("../services/agtClient");
const { configAGT, agtPronto } = require("../services/agtConfig");

const ESTADOS = ["emitida", "paga", "parcial", "vencida", "cancelada"];
const TIPOS = ["fatura", "recibo", "proforma", "nota_credito", "factura_recibo"];

// Tipos de documento que representam recebimento de dinheiro (geram entrada automática).
const TIPOS_ENTRADA = ["fatura", "recibo", "factura_recibo"];

/**
 * Regista automaticamente a ENTRADA de tesouraria quando uma fatura/recibo é
 * liquidada (paga). As saídas e transferências são sempre manuais.
 * Evita duplicados: só cria se ainda não existir um movimento de entrada ligado
 * à fatura. Devolve true se criar, false caso contrário.
 */
async function registarEntradaTesouraria(req, fatura, valorPago, metodo, contaId) {
  try {
    if (!fatura || !fatura.id) return false;
    if (!TIPOS_ENTRADA.includes(fatura.tipo)) return false;
    const valor = parseFloat(valorPago);
    if (!valor || valor <= 0) return false;

    const existente = await TesourariaMovimento.findOne({
      where: { fatura_id: fatura.id, tipo: "entrada", organizacao_id: req.organizacao_id },
    });
    if (existente) return false;

    const numero = fatura.numero || `#${fatura.id}`;
    const rotulo = fatura.tipo === "factura_recibo" ? "Factura Recibo" : fatura.tipo === "recibo" ? "Recibo" : "Fatura";

    const movimento = await TesourariaMovimento.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      tipo: "entrada",
      categoria: "venda",
      descricao: `Pagamento ${rotulo} ${numero}`,
      valor,
      data_movimento: fatura.data_pagamento || new Date().toISOString().split("T")[0],
      hora_movimento: new Date().toTimeString().split(" ")[0],
      referencia: numero,
      referencia_tipo: fatura.tipo === "factura_recibo" ? "recibo" : "fatura",
      referencia_id: fatura.id,
      cliente_id: fatura.cliente_id || null,
      fatura_id: fatura.id,
      conta_bancaria_id: contaId || fatura.conta_bancaria_id || null,
      metodo_pagamento: metodo || fatura.metodo_pagamento || null,
      estado: "confirmado",
      observacoes: "Entrada automática gerada pela liquidação da fatura",
    });

    if (movimento.conta_bancaria_id) {
      const conta = await ContaBancaria.findByPk(movimento.conta_bancaria_id);
      if (conta) {
        const novoSaldo = Number(conta.saldo_atual) + valor;
        await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }
    return true;
  } catch (e) {
    console.error("Erro ao registar entrada automática de tesouraria:", e);
    return false;
  }
}

function resolverClienteId(body) {
  if (body.cliente_id) return body.cliente_id;
  return null;
}

function normalizarItens(itens) {
  return (itens || [])
    .map((i) => {
      const quantidade = parseInt(i.quantidade, 10) || 0;
      const preco = parseFloat(i.preco_unit != null ? i.preco_unit : i.valorUnitario) || 0;
      return {
        descricao: String(i.descricao || "").trim(),
        quantidade,
        preco_unit: preco,
        total: Number((quantidade * preco).toFixed(2)),
      };
    })
    .filter((i) => i.descricao);
}

function calcularTotais(body, itens) {
  let subtotal = 0;
  if (itens.length) {
    subtotal = itens.reduce((s, i) => s + i.total, 0);
  } else {
    subtotal = parseFloat(body.subtotal != null ? body.subtotal : body.valor) || 0;
  }
  const ivaPct = parseFloat(body.iva != null ? body.iva : 0) || 0;
  const valorIva = subtotal * (ivaPct / 100);
  const total = parseFloat(body.total != null ? body.total : 0) || subtotal + valorIva;
  return {
    subtotal: Number(subtotal.toFixed(2)),
    iva: ivaPct,
    valor_iva: Number(valorIva.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

async function proximoNumero(organizacao_id, tipo) {
  const prefixo = tipo === "recibo" ? "REC" : tipo === "proforma" ? "PRF" : tipo === "factura_recibo" ? "FR" : "FAT";
  const ano = new Date().getFullYear();
  const count = await Faturacao.count({ where: { organizacao_id } });
  return `${prefixo}-${ano}-${String(count + 1).padStart(4, "0")}`;
}

async function resolverCliente(req, body) {
  const id = resolverClienteId(body);
  if (id) return id;
  if (body.cliente && String(body.cliente).trim()) {
    const cli = await Cliente.findOne({
      where: { nome: String(body.cliente).trim(), organizacao_id: req.organizacao_id },
    });
    if (cli) return cli.id;
  }
  return null;
}

function arredondarExcesso(valor) {
  return Math.ceil((Number(valor) + Number.EPSILON) * 100) / 100;
}

function montarDocumentoAGT(fatura, cliente, nif, serie) {
  const cfg = configAGT();
  const numero = String(serie.nextDocumentNo);
  const documentNo = `${serie.documentType} ${serie.seriesCode}/${numero}`;
  const netTotal = Number(fatura.subtotal) || 0;
  const taxPayable = Number(fatura.valor_iva) || 0;
  const grossTotal = Number(fatura.total) || Number((netTotal + taxPayable).toFixed(2));
  const percentual = parseFloat(fatura.iva);
  const pctFinal = !isNaN(percentual) ? percentual : cfg.ivaDefault;

  const linhas = (fatura.itens || []).map((i, idx) => {
    const quantidade = Number(i.quantidade) || 0;
    const preco = Number(i.preco_unit) || 0;
    const total = Number(i.total) || Number((quantidade * preco).toFixed(2));
    return {
      lineNumber: idx + 1,
      operationType: "TB",
      productCode: String(i.sku || i.codigo || `ITEM${idx + 1}`).slice(0, 60),
      productDescription: String(i.descricao || "Serviço").slice(0, 200),
      quantity: quantidade,
      unitOfMeasure: "UN",
      unitPriceBase: preco,
      unitPrice: preco,
      debitAmount: Number(total.toFixed(2)),
      settlementAmount: 0,
      taxes: [],
    };
  });

  const somaBase = linhas.reduce((s, l) => s + l.debitAmount, 0);
  let taxaRestante = taxPayable;
  linhas.forEach((l, idx) => {
    let contribuicao = 0;
    if (somaBase > 0) {
      contribuicao = idx === linhas.length - 1 ? Number(taxaRestante.toFixed(2)) : arredondarExcesso(taxPayable * (l.debitAmount / somaBase));
      taxaRestante = Number((taxaRestante - contribuicao).toFixed(2));
    }
    l.taxes =
      contribuicao > 0
        ? [{ taxType: "IVA", taxCountryRegion: "AO", taxCode: "NOR", taxPercentage: pctFinal, taxContribution: Number(contribuicao.toFixed(2)) }]
        : [{ taxType: "NS", taxCountryRegion: "AO", taxPercentage: 0 }];
  });

  const customerTaxID = cliente?.nif ? String(cliente.nif).trim() : "999999999";
  const companyName = String(cliente?.nome || fatura.cliente || "Consumidor Final").slice(0, 200);
  const documentTotals = {
    taxPayable: Number(taxPayable.toFixed(2)),
    netTotal: Number(netTotal.toFixed(2)),
    grossTotal: Number(grossTotal.toFixed(2)),
  };

  const documento = {
    documentNo,
    documentStatus: "N",
    documentDate: fatura.data_emissao,
    documentType: serie.documentType,
    systemEntryDate: new Date().toISOString().slice(0, 19),
    customerTaxID,
    customerCountry: "AO",
    companyName,
    lines: linhas,
    documentTotals,
  };

  documento.jwsDocumentSignature = agtClient.assinarDocumento(
    {
      documentNo,
      taxRegistrationNumber: nif,
      documentType: serie.documentType,
      documentDate: fatura.data_emissao,
      customerTaxID,
      customerCountry: "AO",
      companyName,
      documentTotals,
    },
    configAGT()
  );

  if (cfg.eacCode) documento.eacCode = cfg.eacCode;
  return documento;
}

async function registarSerieAGT(organizacao_id, dados, cfg) {
  const r = dados?.seriesFEResult;
  if (!r?.seriesCode) return null;
  return SerieAGT.create({
    organizacao_id,
    seriesCode: r.seriesCode,
    documentType: dados.documentType || "FT",
    seriesYear: dados.seriesYear || new Date().getFullYear(),
    establishmentNumber: dados.establishmentNumber || cfg.establishment,
    contingencyIndicator: dados.seriesContingencyIndicator || "N",
    firstDocumentNo: r.firstDocumentNo || "1",
    lastDocumentNo: r.lastDocumentNo || r.firstDocumentNo || "1",
    nextDocumentNo: parseInt(r.firstDocumentNo, 10) || 1,
    status: "A",
  });
}

async function obterOuCriarSerieFT(organizacao, nif, cfg) {
  const ano = new Date().getFullYear();
  const onde = { organizacao_id: organizacao.id, documentType: "FT", seriesYear: ano, contingencyIndicator: "N" };
  const serie = await SerieAGT.findOne({ where: onde, order: [["createdAt", "DESC"]] });
  if (serie && serie.nextDocumentNo <= parseInt(serie.lastDocumentNo, 10)) return serie;
  const { status, dados } = await agtClient.solicitarSerie({
    nif,
    establishment: cfg.establishment,
    seriesYear: ano,
    documentType: "FT",
    contingencyIndicator: "N",
  });
  if (status === 200 && dados?.seriesFEResult?.seriesCode) {
    return registarSerieAGT(organizacao.id, { ...dados, documentType: "FT", seriesYear: ano, establishmentNumber: cfg.establishment, seriesContingencyIndicator: "N" }, cfg);
  }
  const erro = new Error("AGT: falha ao solicitar série de faturação");
  erro.detalhes = dados;
  erro.statusAGT = status;
  throw erro;
}

async function submitFaturaAGT(fatura) {
  const cfg = configAGT();
  if (!agtPronto()) return null;
  const organizacao = await Organizacao.findByPk(fatura.organizacao_id);
  if (!organizacao || !organizacao.nif) return null;
  const nif = cfg.nif || String(organizacao.nif).trim();
  const cliente = fatura.cliente_id ? await Cliente.findByPk(fatura.cliente_id) : null;
  const serie = await obterOuCriarSerieFT(organizacao, nif, cfg);
  const documento = montarDocumentoAGT(fatura, cliente, nif, serie);
  const { status, dados } = await agtClient.registarFacturas({ nif, documentos: [documento] });
  if (status === 200 && dados?.requestID) {
    await fatura.update({ agt_document_no: documento.documentNo, agt_request_id: dados.requestID, agt_status: "pendente", agt_erros: null });
    await SerieAGT.increment("nextDocumentNo", { where: { id: serie.id } });
  } else {
    await fatura.update({ agt_document_no: documento.documentNo, agt_erros: dados || { status } });
  }
  return { status, dados, documento };
}

async function atualizarEstadoAGT(fatura) {
  const cfg = configAGT();
  if (!agtPronto() || !fatura.agt_request_id) return null;
  const organizacao = await Organizacao.findByPk(fatura.organizacao_id);
  if (!organizacao || !organizacao.nif) return null;
  const nif = cfg.nif || String(organizacao.nif).trim();
  const { status, dados } = await agtClient.obterEstado({ nif, requestID: fatura.agt_request_id });
  const linhas = status === 200 && Array.isArray(dados?.documentStatusList) ? dados.documentStatusList : [];
  const linha = linhas.find((l) => l.documentNo === fatura.agt_document_no) || linhas[0];
  if (linha) {
    const novoEstado = linha.documentStatus === "V" ? "valida" : linha.documentStatus === "I" ? "invalida" : fatura.agt_status;
    await fatura.update({ agt_status: novoEstado, agt_erros: linha.documentStatus === "I" ? linha.errorList || [] : null });
  }
  return { status, dados };
}

exports.listar = async (req, res) => {
  try {
    const { estado, tipo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    if (tipo) where.tipo = tipo;
    const faturas = await Faturacao.findAll({
      where,
      include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }],
      order: [["createdAt", "DESC"]],
    });
    return res.json(faturas);
  } catch (e) {
    console.error("Erro ao listar faturas:", e);
    return res.status(500).json({ erro: "Erro ao listar faturas" });
  }
};

exports.buscar = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }],
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    return res.json(fatura);
  } catch (e) {
    console.error("Erro ao buscar fatura:", e);
    return res.status(500).json({ erro: "Erro ao buscar fatura" });
  }
};

exports.exportar = async (req, res) => {
  try {
    const { estado, tipo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado && estado !== "todas" && estado !== "todos") where.estado = estado;
    if (tipo) where.tipo = tipo;
    const faturas = await Faturacao.findAll({ where, include: [{ model: Cliente, required: false }] });
    const linhas = [
      ["id", "numero", "tipo", "cliente", "data_emissao", "data_vencimento", "subtotal", "iva", "valor_iva", "total", "valor_pago", "estado", "metodo_pagamento"],
      ...faturas.map((f) => [
        f.id, f.numero, f.tipo, f.cliente?.nome || "", f.data_emissao, f.data_vencimento || "",
        f.subtotal, f.iva, f.valor_iva, f.total, f.valor_pago, f.estado, f.metodo_pagamento || "",
      ]),
    ];
    const csv = linhas
      .map((l) => l.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="faturas_${new Date().toISOString().split("T")[0]}.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error("Erro ao exportar faturas:", e);
    return res.status(500).json({ erro: "Erro ao exportar faturas" });
  }
};

async function criarRegisto(req, body) {
  const tipo = TIPOS.includes(body.tipo) ? body.tipo : "fatura";
  const itens = normalizarItens(body.itens);
  const totais = calcularTotais(body, itens);
  const hoje = new Date();
  const hojeStr = hoje.toISOString().split("T")[0];
  const dataEmissao = body.data_emissao || hojeStr;
  const dataVencimento =
    body.data_vencimento || new Date(hoje.getTime() + 30 * 86400000).toISOString().split("T")[0];
  const clienteId = await resolverCliente(req, body);
  let valorPago = parseFloat(body.valor_pago) || 0;
  let estado = ESTADOS.includes(body.estado) ? body.estado : null;
  if (tipo === "factura_recibo") {
    estado = "paga";
    valorPago = totais.total;
  }
  if (!estado) {
    estado = valorPago >= totais.total ? "paga" : valorPago > 0 ? "parcial" : "emitida";
  }
  const numero = body.numero || (await proximoNumero(req.organizacao_id, tipo));
  const fatura = await Faturacao.create({
    organizacao_id: req.organizacao_id,
    usuario_id: req.usuario.id,
    orcamento_id: body.orcamento_id || null,
    ordem_producao_id: body.op || body.ordem_producao_id || null,
    cliente_id: clienteId,
    tipo,
    numero,
    data_emissao: dataEmissao,
    data_vencimento: dataVencimento,
    data_pagamento: estado === "paga" ? body.data_pagamento || hojeStr : body.data_pagamento || null,
    itens,
    ...totais,
    valor: totais.total,
    valor_pago: valorPago,
    estado,
    metodo_pagamento: body.metodo || body.metodo_pagamento || null,
    conta_bancaria_id: body.conta_bancaria_id || null,
    observacoes: body.observacoes || null,
  });
  if (tipo === "fatura" && agtPronto()) {
    try {
      await submitFaturaAGT(fatura);
    } catch (eSubmit) {
      console.error("AGT: falha ao submeter fatura automaticamente", eSubmit.detalhes || eSubmit.message);
    }
  }
  if (estado === "paga" && valorPago > 0) {
    await registarEntradaTesouraria(req, { ...fatura.toJSON(), data_pagamento: fatura.data_pagamento }, valorPago, fatura.metodo_pagamento, fatura.conta_bancaria_id);
  }
  return Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }] });
}

exports.criar = async (req, res) => {
  try {
    const completa = await criarRegisto(req, req.body || {});
    return res.status(201).json(completa);
  } catch (e) {
    console.error("Erro ao criar fatura:", e);
    return res.status(500).json({ erro: "Erro ao criar fatura" });
  }
};

exports.fromOrcamento = async (req, res) => {
  try {
    const orcamento = await Orcamento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: Cliente, required: false }, { model: OrcamentoItem, required: false }],
    });
    if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado" });
    const itens = (orcamento.orcamento_items || []).map((i) => ({
      descricao: i.descricao,
      quantidade: Number(i.quantidade) || 0,
      preco_unit: Number(i.preco_unit) || 0,
    }));
    const subtotal = Number(orcamento.total_sem_iva) || 0;
    const ivaPct = subtotal > 0 ? Number(((Number(orcamento.total_iva) / subtotal) * 100).toFixed(2)) : 0;
    const body = {
      tipo: req.body?.tipo || "fatura",
      orcamento_id: orcamento.id,
      cliente_id: orcamento.cliente_id,
      itens,
      iva: ivaPct,
      total: Number(orcamento.total_com_iva) || 0,
      data_emissao: new Date().toISOString().split("T")[0],
      observacoes: `Facturado a partir do orçamento ${orcamento.numero}`,
    };
    const completa = await criarRegisto(req, body);
    return res.status(201).json(completa);
  } catch (e) {
    console.error("Erro ao faturar orçamento:", e);
    return res.status(500).json({ erro: "Erro ao faturar orçamento" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.usuario_id;
    delete dados.cliente;
    if (dados.estado !== undefined && !ESTADOS.includes(dados.estado)) delete dados.estado;
    if (dados.valor_pago !== undefined) {
      const total = parseFloat(fatura.total || fatura.valor) || 0;
      const vp = parseFloat(dados.valor_pago) || 0;
      dados.estado = vp >= total ? "paga" : vp > 0 ? "parcial" : "emitida";
    }
    await fatura.update(dados);
    const estadoPos = dados.estado !== undefined ? dados.estado : fatura.estado;
    const valorPos = dados.valor_pago !== undefined ? parseFloat(dados.valor_pago) || 0 : parseFloat(fatura.valor_pago) || 0;
    if (estadoPos === "paga" && valorPos > 0) {
      await registarEntradaTesouraria(req, { ...fatura.toJSON(), data_pagamento: dados.data_pagamento || fatura.data_pagamento }, valorPos, dados.metodo_pagamento || dados.metodo || fatura.metodo_pagamento, dados.conta_bancaria_id || fatura.conta_bancaria_id);
    }
    const completa = await Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }] });
    return res.json(completa);
  } catch (e) {
    console.error("Erro ao atualizar fatura:", e);
    return res.status(500).json({ erro: "Erro ao atualizar fatura" });
  }
};

exports.marcarPaga = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    if (fatura.estado === "cancelada") {
      return res.status(400).json({ erro: "Fatura cancelada não pode ser marcada como paga" });
    }
    const body = req.body || {};
    const total = parseFloat(fatura.total || fatura.valor) || 0;
    let valorPago = parseFloat(body.valor_pago) || 0;
    if (valorPago <= 0 || valorPago >= total) valorPago = total;
    await fatura.update({
      valor_pago: valorPago,
      estado: valorPago >= total ? "paga" : "parcial",
      metodo_pagamento: body.metodo || body.metodo_pagamento || fatura.metodo_pagamento,
      data_pagamento: body.data_pagamento || new Date().toISOString().split("T")[0],
      conta_bancaria_id: body.conta_bancaria_id || body.conta || fatura.conta_bancaria_id,
    });
    if (valorPago >= total) {
      await registarEntradaTesouraria(
        req,
        { ...fatura.toJSON(), data_pagamento: body.data_pagamento || fatura.data_pagamento },
        valorPago,
        body.metodo || body.metodo_pagamento || fatura.metodo_pagamento,
        body.conta_bancaria_id || body.conta || fatura.conta_bancaria_id
      );
    }
    const completa = await Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }, { model: Orcamento, required: false }, { model: OrdemProducao, required: false }] });
    return res.json(completa);
  } catch (e) {
    console.error("Erro ao marcar fatura como paga:", e);
    return res.status(500).json({ erro: "Erro ao marcar fatura como paga" });
  }
};

exports.remover = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    await fatura.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Fatura removida com sucesso" });
  } catch (e) {
    console.error("Erro ao remover fatura:", e);
    return res.status(500).json({ erro: "Erro ao remover fatura" });
  }
};

exports.agtConfig = async (req, res) => {
  try {
    const cfg = configAGT();
    return res.json({
      ativo: agtPronto(),
      ambiente: cfg.ambiente,
      baseUrl: cfg.baseUrl,
      nif: cfg.nif,
      establishment: cfg.establishment,
      productId: cfg.productId,
      productVersion: cfg.productVersion,
      softwareValidationNumber: cfg.softwareValidationNumber,
      eacCode: cfg.eacCode,
      iva: cfg.ivaDefault,
    });
  } catch (e) {
    console.error("Erro ao obter config AGT:", e);
    return res.status(500).json({ erro: "Erro ao obter config AGT" });
  }
};

exports.solicitarSerie = async (req, res) => {
  try {
    const organizacao = await Organizacao.findByPk(req.organizacao_id);
    if (!organizacao || !organizacao.nif) {
      return res.status(400).json({ erro: "NIF da organização não definido" });
    }
    if (!agtPronto()) return res.status(400).json({ erro: "AGT não configurado no .env" });
    const cfg = configAGT();
    const nif = cfg.nif || String(organizacao.nif).trim();
    const ano = parseInt(req.body?.seriesYear, 10) || new Date().getFullYear();
    const documentType = req.body?.documentType || "FT";
    const resultado = await agtClient.solicitarSerie({
      nif,
      establishment: req.body?.establishment || cfg.establishment,
      seriesYear: ano,
      documentType,
      contingencyIndicator: req.body?.contingency || "N",
    });
    if (resultado.status === 200 && resultado.dados?.seriesFEResult?.seriesCode) {
      await registarSerieAGT(
        organizacao.id,
        {
          ...resultado.dados,
          documentType,
          seriesYear: ano,
          establishmentNumber: req.body?.establishment || cfg.establishment,
          seriesContingencyIndicator: req.body?.contingency || "N",
        },
        cfg
      );
      return res.status(201).json(resultado.dados);
    }
    return res.status(resultado.status >= 400 ? resultado.status : 400).json(resultado.dados || { erro: "AGT: falha ao solicitar série" });
  } catch (e) {
    console.error("Erro ao solicitar série AGT:", e);
    return res.status(500).json({ erro: "Erro ao solicitar série AGT", detalhes: e.detalhes || e.message });
  }
};

exports.listarSeries = async (req, res) => {
  try {
    const organizacao = await Organizacao.findByPk(req.organizacao_id);
    if (!organizacao || !organizacao.nif) {
      return res.status(400).json({ erro: "NIF da organização não definido" });
    }
    if (!agtPronto()) return res.status(400).json({ erro: "AGT não configurado no .env" });
    const cfg = configAGT();
    const nif = cfg.nif || String(organizacao.nif).trim();
    const criterios = {};
    if (req.query?.seriesCode) criterios.seriesCode = req.query.seriesCode;
    if (req.query?.seriesYear) criterios.seriesYear = req.query.seriesYear;
    if (req.query?.documentType) criterios.documentType = req.query.documentType;
    if (req.query?.seriesStatus) criterios.seriesStatus = req.query.seriesStatus;
    const resultado = await agtClient.listarSeries({ nif, criterios });
    if (resultado.status !== 200) {
      return res.status(resultado.status >= 400 ? resultado.status : 400).json(resultado.dados || { erro: "AGT: falha ao listar séries" });
    }
    return res.json(resultado.dados);
  } catch (e) {
    console.error("Erro ao listar séries AGT:", e);
    return res.status(500).json({ erro: "Erro ao listar séries AGT", detalhes: e.detalhes || e.message });
  }
};

exports.consultarEstado = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    if (!fatura.agt_request_id) return res.status(400).json({ erro: "Fatura ainda não submetida à AGT" });
    const agt_consulta = await atualizarEstadoAGT(fatura);
    const completa = await Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }] });
    return res.json({ ...completa.toJSON(), agt_consulta });
  } catch (e) {
    console.error("Erro ao consultar estado AGT:", e);
    return res.status(500).json({ erro: "Erro ao consultar estado AGT", detalhes: e.detalhes || e.message });
  }
};

exports.enviarAGT = async (req, res) => {
  try {
    const fatura = await Faturacao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!fatura) return res.status(404).json({ erro: "Fatura não encontrada" });
    if (fatura.tipo !== "fatura") {
      return res.status(400).json({ erro: "Apenas faturas (FT) são enviadas à AGT por agora" });
    }
    if (!agtPronto()) return res.status(400).json({ erro: "AGT não configurado no .env" });
    const agt_envio = await submitFaturaAGT(fatura);
    const completa = await Faturacao.findByPk(fatura.id, { include: [{ model: Cliente, required: false }] });
    return res.json({ ...completa.toJSON(), agt_envio });
  } catch (e) {
    console.error("Erro ao enviar fatura à AGT:", e);
    return res.status(500).json({ erro: "Erro ao enviar fatura à AGT", detalhes: e.detalhes || e.message });
  }
};
