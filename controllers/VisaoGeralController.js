const path = require("path");
const { Op } = require("sequelize");
const {
  sequelize,
  Usuario,
  FechoDiario,
  MetaUnidade,
  AprovacaoGestao,
  TravaSistemica,
  ReuniaoSemanal,
  AcaoSemanal,
  VisaoGeralAnexo,
  ContaBancaria,
  Proposta,
  OrdemProducao,
  Faturacao,
} = require("../models");
const auditoria = require("../services/auditoria");
const {
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
} = require("../services/visaoGeral");

const ATRIBUTOS_ANEXO = ["id", "entidade_tipo", "entidade_id", "nome_original", "mime", "extensao", "tamanho", "usuario_id", "createdAt"];
const MIMES = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function erro(res, e, fallback) {
  if (e?.status && e?.message) return res.status(e.status).json({ erro: e.message });
  console.error(`${fallback}:`, e);
  return res.status(500).json({ erro: fallback });
}

function unidadeValida(unidade) {
  return unidade === "TODAS" || UNIDADES.some((u) => u.codigo === unidade);
}

function inicioMes(mes) {
  return `${String(mes).slice(0, 7)}-01`;
}

function somar(lista, campo) {
  return Number(lista.reduce((total, item) => total + Number(item[campo] || 0), 0).toFixed(2));
}

function percentual(atual, anterior) {
  if (!anterior) return null;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

async function vincularAnexo(req, anexoId, entidadeTipo, entidadeId) {
  if (!anexoId) return null;
  const anexo = await VisaoGeralAnexo.findOne({
    where: { id: Number(anexoId), organizacao_id: req.organizacao_id },
  });
  if (!anexo) {
    const e = new Error("Comprovativo não encontrado.");
    e.status = 404;
    throw e;
  }
  if (anexo.entidade_id && (anexo.entidade_tipo !== entidadeTipo || Number(anexo.entidade_id) !== Number(entidadeId))) {
    const e = new Error("Este comprovativo já está associado a outro registo.");
    e.status = 409;
    throw e;
  }
  anexo.entidade_tipo = entidadeTipo;
  anexo.entidade_id = entidadeId;
  await anexo.save();
  return anexo.id;
}

exports.resumo = async (req, res) => {
  try {
    const org = req.organizacao_id;
    const mes = mesAtualISO();
    const mesAnt = mesAnteriorISO();
    const hoje = hojeISO();
    const [
      fechos,
      metas,
      aprovacoes,
      travas,
      atas,
      acoes,
      anexos,
      pessoas,
      usuarioPin,
      saldo,
      carteira,
      ordens,
      faturasMes,
    ] = await Promise.all([
      FechoDiario.findAll({
        where: { organizacao_id: org },
        include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome"] }],
        order: [["data_referencia", "DESC"], ["id", "DESC"]],
        limit: 180,
      }),
      MetaUnidade.findAll({
        where: { organizacao_id: org },
        include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome"] }],
        order: [["mes", "DESC"], ["unidade", "ASC"]],
      }),
      AprovacaoGestao.findAll({
        where: { organizacao_id: org },
        include: [
          { model: Usuario, as: "criador", attributes: ["id", "nome"] },
          { model: Usuario, as: "decisor", attributes: ["id", "nome"] },
        ],
        order: [["createdAt", "DESC"]],
        limit: 150,
      }),
      TravaSistemica.findAll({
        where: { organizacao_id: org },
        include: [
          { model: Usuario, as: "criador", attributes: ["id", "nome"] },
          { model: Usuario, as: "regularizador", attributes: ["id", "nome"] },
        ],
        order: [["createdAt", "DESC"]],
        limit: 150,
      }),
      ReuniaoSemanal.findAll({
        where: { organizacao_id: org },
        include: [{ model: Usuario, as: "usuario", attributes: ["id", "nome"] }],
        order: [["data_reuniao", "DESC"], ["id", "DESC"]],
        limit: 30,
      }),
      AcaoSemanal.findAll({
        where: { organizacao_id: org },
        order: [["createdAt", "DESC"]],
        limit: 300,
      }),
      VisaoGeralAnexo.findAll({
        where: { organizacao_id: org },
        attributes: ATRIBUTOS_ANEXO,
        order: [["createdAt", "DESC"]],
        limit: 150,
      }),
      Usuario.findAll({
        where: { organizacao_id: org, ativo: true },
        attributes: ["id", "nome", "funcao", "perfil"],
        order: [["nome", "ASC"]],
      }),
      Usuario.findByPk(req.usuario.id, { attributes: ["id", "pin_hash"] }),
      ContaBancaria.sum("saldo_atual", { where: { organizacao_id: org, ativo: true } }),
      Proposta.sum("valor", {
        where: { organizacao_id: org, estado: { [Op.in]: ["enviada", "recebida", "avaliada"] } },
      }),
      OrdemProducao.count({
        where: { organizacao_id: org, estado: { [Op.in]: ["aguardando", "em_producao"] } },
      }),
      Faturacao.sum("total", {
        where: {
          organizacao_id: org,
          estado: { [Op.ne]: "cancelada" },
          data_emissao: { [Op.gte]: mes, [Op.lt]: new Date(Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 1)).toISOString().slice(0, 10) },
        },
      }),
    ]);

    const fechosMes = fechos.filter((f) => String(f.data_referencia).startsWith(mes.slice(0, 7)));
    const fechosMesAnt = fechos.filter((f) => String(f.data_referencia).startsWith(mesAnt.slice(0, 7)));
    const fechosPorUnidade = fechosMes.filter((f) => f.unidade !== "TODAS");
    const fechosConsolidados = fechosMes.filter((f) => f.unidade === "TODAS");
    const faturacaoFechos = fechosPorUnidade.length ? somar(fechosPorUnidade, "receita_faturada") : somar(fechosConsolidados, "receita_faturada");
    const faturacaoAnterior = fechosMesAnt.filter((f) => f.unidade !== "TODAS").length
      ? somar(fechosMesAnt.filter((f) => f.unidade !== "TODAS"), "receita_faturada")
      : somar(fechosMesAnt.filter((f) => f.unidade === "TODAS"), "receita_faturada");

    const ataCorrente = atas.find((a) => a.estado === "aberta") || atas[0] || null;
    const acoesFormatadas = acoes.map((a) => {
      const ata = atas.find((r) => r.id === a.ata_id);
      return {
        ...a.toJSON(),
        ata_codigo: ata?.codigo || null,
        ata_data: ata?.data_reuniao || null,
        pauta: ata?.pauta || null,
      };
    });
    const acoesDaAta = ataCorrente ? acoesFormatadas.filter((a) => a.ata_id === ataCorrente.id) : [];

    return res.json({
      unidades: UNIDADES,
      hoje,
      mes_atual: mes,
      usuario: {
        id: req.usuario.id,
        nome: req.usuario.nome,
        funcao: req.usuario.funcao,
        perfil: req.usuario.perfil,
        pin_configurado: !!usuarioPin?.pin_hash,
      },
      fechos,
      metas,
      aprovacoes,
      travas: travas,
      atas,
      acoes: acoesFormatadas,
      anexos,
      pessoas,
      indicadores: {
        faturacao_mes: faturacaoFechos,
        faturacao_mes_anterior: faturacaoAnterior,
        variacao_faturacao: percentual(faturacaoFechos, faturacaoAnterior),
        faturacao_documentos_mes: Number(saldoFaturacao(faturasMes)),
        saldo_bancos: Number(saldo || 0),
        carteira_propostas: Number(carteira || 0),
        carteira_teto: somar(metas.filter((m) => String(m.mes).startsWith(mes.slice(0, 7))), "meta_mensal"),
        ordens_ativas: Number(ordens || 0),
        travas_ativas: travas.filter((t) => t.estado !== "regularizado").length,
        aprovacoes: {
          pendentes_kscp: aprovacoes.filter((a) => a.estado === "pendente" && a.alcada === "KSCP").length,
          pendentes_direcao: aprovacoes.filter((a) => a.estado === "pendente" && a.alcada === "Direção Geral").length,
          aprovadas_hoje: aprovacoes.filter((a) => a.estado === "aprovada" && a.data_decisao && new Date(a.data_decisao) >= new Date(`${hoje}T00:00:00.000Z`)).length,
          aprovadas_valor_hoje: somar(aprovacoes.filter((a) => a.estado === "aprovada" && a.data_decisao && new Date(a.data_decisao) >= new Date(`${hoje}T00:00:00.000Z`)), "valor"),
          devolvidas: aprovacoes.filter((a) => a.estado === "devolvida").length,
        },
        ritual: {
          ata_corrente: ataCorrente?.codigo || null,
          data_reuniao: ataCorrente?.data_reuniao || null,
          total_acoes: acoesDaAta.length,
          concluidas: acoesDaAta.filter((a) => a.estado === "concluida").length,
          pendentes: acoesDaAta.filter((a) => a.estado !== "concluida").length,
          leads: ataCorrente?.leads || 0,
          visitas: ataCorrente?.visitas || 0,
        },
      },
    });
  } catch (e) {
    return erro(res, e, "Erro ao carregar a Visão Geral");
  }
};

function saldoFaturacao(valor) {
  return Number(valor || 0);
}

exports.salvarFecho = async (req, res) => {
  try {
    const { data_referencia, unidade, receita_faturada, entrada_caixa_banco, ocorrencias, conciliado, pin } = req.body || {};
    if (!dataValida(data_referencia)) return res.status(422).json({ erro: "Data de referência inválida." });
    if (!unidadeValida(unidade)) return res.status(422).json({ erro: "Unidade de negócio inválida." });
    const receita = numeroValor(receita_faturada, { permitirZero: false });
    const entradas = numeroValor(entrada_caixa_banco);
    if (receita === null) return res.status(422).json({ erro: "Receita faturada inválida." });
    if (entradas === null) return res.status(422).json({ erro: "Entradas em caixa/bancos inválida." });
    await validarPin(req, pin);

    const dados = {
      organizacao_id: req.organizacao_id,
      data_referencia,
      unidade,
      receita_faturada: receita,
      entrada_caixa_banco: entradas,
      ocorrencias: texto(ocorrencias, 2000) || null,
      conciliado: conciliado === true,
      usuario_id: req.usuario.id,
    };
    const [fecho] = await FechoDiario.upsert(dados, {
      fields: ["receita_faturada", "entrada_caixa_banco", "ocorrencias", "conciliado", "usuario_id", "updatedAt"],
    });
    auditoria.registrar({
      req,
      acao: "visao_geral.fecho.salvar",
      alvoTipo: "fecho_diario",
      alvoId: fecho.id,
      detalhe: { data_referencia, unidade, receita_faturada: receita, entrada_caixa_banco: entradas },
    });
    return res.json({ mensagem: "Fecho diário guardado com sucesso.", fecho });
  } catch (e) {
    return erro(res, e, "Erro ao guardar o fecho diário");
  }
};

exports.salvarMeta = async (req, res) => {
  try {
    const { unidade, mes, meta_mensal } = req.body || {};
    if (!unidadeValida(unidade) || unidade === "TODAS") return res.status(422).json({ erro: "Selecione uma unidade de negócio." });
    if (!dataValida(mes)) return res.status(422).json({ erro: "Mês de referência inválido." });
    const meta = numeroValor(meta_mensal, { permitirZero: false });
    if (meta === null) return res.status(422).json({ erro: "Meta mensal inválida." });
    const [registro] = await MetaUnidade.upsert({
      organizacao_id: req.organizacao_id,
      unidade,
      mes: inicioMes(mes),
      meta_mensal: meta,
      usuario_id: req.usuario.id,
    }, { fields: ["meta_mensal", "usuario_id", "updatedAt"] });
    auditoria.registrar({ req, acao: "visao_geral.meta.salvar", alvoTipo: "meta_unidade", alvoId: registro.id, detalhe: { unidade, mes: inicioMes(mes), meta_mensal: meta } });
    return res.json({ mensagem: "Meta mensal guardada com sucesso.", meta: registro });
  } catch (e) {
    return erro(res, e, "Erro ao guardar a meta mensal");
  }
};

exports.criarAprovacao = async (req, res) => {
  try {
    const { origem, descricao, valor, alcada, requisito, verificacao_documental, condicao_execucao, comprovativo_id } = req.body || {};
    if (!texto(origem, 100) || !texto(descricao, 300)) return res.status(422).json({ erro: "Origem e descrição são obrigatórias." });
    const valorNumero = numeroValor(valor);
    if (valorNumero === null) return res.status(422).json({ erro: "Valor inválido." });
    if (!["KSCP", "Direção Geral"].includes(alcada)) return res.status(422).json({ erro: "Alçada inválida." });
    const codigo = await proximoCodigo(AprovacaoGestao, req.organizacao_id, "PROP");
    const aprovacao = await AprovacaoGestao.create({
      organizacao_id: req.organizacao_id,
      codigo,
      origem: texto(origem, 100),
      descricao: texto(descricao, 300),
      valor: valorNumero,
      alcada,
      requisito: texto(requisito, 300) || null,
      verificacao_documental: texto(verificacao_documental, 300) || null,
      condicao_execucao: texto(condicao_execucao, 300) || null,
      criado_por: req.usuario.id,
    });
    await vincularAnexo(req, comprovativo_id, "aprovacao", aprovacao.id);
    auditoria.registrar({ req, acao: "visao_geral.aprovacao.criar", alvoTipo: "aprovacao_gestao", alvoId: aprovacao.id, detalhe: { codigo, valor: valorNumero, alcada } });
    return res.status(201).json({ mensagem: "Processo registado com sucesso.", aprovacao });
  } catch (e) {
    return erro(res, e, "Erro ao registar o processo");
  }
};

exports.decidirAprovacao = async (req, res) => {
  try {
    const { decisao, pin, requisito, verificacao_documental, condicao_execucao, observacao, comprovativo_id } = req.body || {};
    if (!["aprovar", "devolver", "rejeitar"].includes(decisao)) return res.status(422).json({ erro: "Decisão inválida." });
    await validarPin(req, pin);
    const aprovacao = await AprovacaoGestao.findOne({ where: { id: req.params.id, organizacao_id: req.organizacao_id } });
    if (!aprovacao) return res.status(404).json({ erro: "Processo não encontrado." });
    if (aprovacao.estado === "aprovada" || aprovacao.estado === "rejeitada") return res.status(409).json({ erro: "Este processo já teve uma decisão final." });
    if (decisao !== "aprovar" && !texto(observacao, 2000)) return res.status(422).json({ erro: "Indique o motivo da devolução ou rejeição." });
    aprovacao.estado = decisao === "aprovar" ? "aprovada" : decisao === "devolver" ? "devolvida" : "rejeitada";
    aprovacao.requisito = texto(requisito, 300) || aprovacao.requisito;
    aprovacao.verificacao_documental = texto(verificacao_documental, 300) || aprovacao.verificacao_documental;
    aprovacao.condicao_execucao = texto(condicao_execucao, 300) || aprovacao.condicao_execucao;
    aprovacao.observacao_decisao = texto(observacao, 2000) || null;
    aprovacao.decidido_por = req.usuario.id;
    aprovacao.data_decisao = new Date();
    aprovacao.pin_validado_em = new Date();
    await aprovacao.save();
    await vincularAnexo(req, comprovativo_id, "aprovacao", aprovacao.id);
    auditoria.registrar({ req, acao: `visao_geral.aprovacao.${decisao}`, alvoTipo: "aprovacao_gestao", alvoId: aprovacao.id, detalhe: { codigo: aprovacao.codigo, decisao } });
    return res.json({ mensagem: decisao === "aprovar" ? "Processo aprovado e assinado com PIN." : "Processo devolvido para revisão.", aprovacao });
  } catch (e) {
    return erro(res, e, "Erro ao registar a decisão");
  }
};

exports.criarTrava = async (req, res) => {
  try {
    const { entidade, referencia, motivo, exposicao, estado, comprovativo_id } = req.body || {};
    if (!texto(entidade, 200) || !texto(referencia, 100) || !texto(motivo, 400)) return res.status(422).json({ erro: "Entidade, referência e motivo são obrigatórios." });
    const valor = numeroValor(exposicao);
    if (valor === null) return res.status(422).json({ erro: "Exposição inválida." });
    if (!["bloqueado", "retido_os", "alerta_sla"].includes(estado)) return res.status(422).json({ erro: "Estado inicial inválido." });
    const codigo = await proximoCodigo(TravaSistemica, req.organizacao_id, "TRV");
    const trava = await TravaSistemica.create({
      organizacao_id: req.organizacao_id,
      codigo,
      entidade: texto(entidade, 200),
      referencia: texto(referencia, 100),
      motivo: texto(motivo, 400),
      exposicao: valor,
      estado,
      criado_por: req.usuario.id,
    });
    await vincularAnexo(req, comprovativo_id, "trava", trava.id);
    auditoria.registrar({ req, acao: "visao_geral.trava.criar", alvoTipo: "trava_sistemica", alvoId: trava.id, detalhe: { codigo, estado, exposicao: valor } });
    return res.status(201).json({ mensagem: "Trava registada com sucesso.", trava });
  } catch (e) {
    return erro(res, e, "Erro ao registar a trava");
  }
};

exports.regularizarTrava = async (req, res) => {
  try {
    const { decisao, pin, tipo_regularizacao, valor_liquidado, justificativa, observacao, comprovativo_id } = req.body || {};
    if (!["regularizar", "manter"].includes(decisao)) return res.status(422).json({ erro: "Acção inválida." });
    await validarPin(req, pin);
    const trava = await TravaSistemica.findOne({ where: { id: req.params.id, organizacao_id: req.organizacao_id } });
    if (!trava) return res.status(404).json({ erro: "Trava não encontrada." });
    if (trava.estado === "regularizado") return res.status(409).json({ erro: "Esta trava já foi regularizada." });
    if (decisao === "manter") {
      trava.observacao_acompanhamento = texto(observacao || justificativa, 2000) || null;
      trava.pin_validado_em = new Date();
      await trava.save();
      auditoria.registrar({ req, acao: "visao_geral.trava.manter", alvoTipo: "trava_sistemica", alvoId: trava.id, detalhe: { codigo: trava.codigo } });
      return res.json({ mensagem: "Acompanhamento da trava guardado.", trava });
    }
    if (!texto(tipo_regularizacao, 200) || !texto(justificativa, 2000)) return res.status(422).json({ erro: "Tipo de regularização e justificativa são obrigatórios." });
    const valor = numeroValor(valor_liquidado);
    if (valor === null) return res.status(422).json({ erro: "Valor liquidado inválido." });
    if (!comprovativo_id) return res.status(422).json({ erro: "Anexe o comprovativo da regularização." });
    trava.estado = "regularizado";
    trava.tipo_regularizacao = texto(tipo_regularizacao, 200);
    trava.valor_liquidado = valor;
    trava.justificativa = texto(justificativa, 2000);
    trava.regularizado_por = req.usuario.id;
    trava.data_regularizacao = new Date();
    trava.pin_validado_em = new Date();
    await trava.save();
    await vincularAnexo(req, comprovativo_id, "trava", trava.id);
    auditoria.registrar({ req, acao: "visao_geral.trava.regularizar", alvoTipo: "trava_sistemica", alvoId: trava.id, detalhe: { codigo: trava.codigo, valor_liquidado: valor } });
    return res.json({ mensagem: "Trava regularizada e libertada com sucesso.", trava });
  } catch (e) {
    return erro(res, e, "Erro ao regularizar a trava");
  }
};

exports.criarAta = async (req, res) => {
  try {
    const { data_reuniao, pauta, leads, visitas } = req.body || {};
    if (!dataValida(data_reuniao)) return res.status(422).json({ erro: "Data da reunião inválida." });
    if (!texto(pauta, 300)) return res.status(422).json({ erro: "Pauta da reunião obrigatória." });
    const leadsNumero = Number(leads || 0);
    const visitasNumero = Number(visitas || 0);
    if (!Number.isInteger(leadsNumero) || leadsNumero < 0 || !Number.isInteger(visitasNumero) || visitasNumero < 0) return res.status(422).json({ erro: "Leads e visitas devem ser números inteiros positivos." });
    await sequelize.transaction(async (t) => {
      await ReuniaoSemanal.update({ estado: "fechada" }, { where: { organizacao_id: req.organizacao_id, estado: "aberta" }, transaction: t });
      const codigo = await proximoCodigo(ReuniaoSemanal, req.organizacao_id, "COM-ATA", t);
      await ReuniaoSemanal.create({
        organizacao_id: req.organizacao_id,
        codigo,
        data_reuniao,
        pauta: texto(pauta, 300),
        leads: leadsNumero,
        visitas: visitasNumero,
        estado: "aberta",
        usuario_id: req.usuario.id,
      }, { transaction: t });
    });
    auditoria.registrar({ req, acao: "visao_geral.ata.criar", alvoTipo: "reuniao_semanal", detalhe: { data_reuniao, pauta: texto(pauta, 300) } });
    return res.status(201).json({ mensagem: "Nova ata semanal criada com sucesso." });
  } catch (e) {
    return erro(res, e, "Erro ao criar a ata semanal");
  }
};

exports.criarAcao = async (req, res) => {
  try {
    const { ata_id, descricao, responsavel_id, responsavel_nome, prazo, estado, pin } = req.body || {};
    if (!texto(descricao, 400)) return res.status(422).json({ erro: "Descrição da ação obrigatória." });
    const ata = await ReuniaoSemanal.findOne({ where: { id: ata_id, organizacao_id: req.organizacao_id } });
    if (!ata) return res.status(404).json({ erro: "Ata não encontrada." });
    if (ata.estado !== "aberta") return res.status(409).json({ erro: "A ata está fechada. Crie uma nova ata para registar ações." });
    if (prazo && !dataValida(prazo)) return res.status(422).json({ erro: "Prazo inválido." });
    if (!["em_curso", "concluida", "pendente", "sem_prazo"].includes(estado || "pendente")) return res.status(422).json({ erro: "Estado da ação inválido." });
    let nome = texto(responsavel_nome, 150);
    let responsavel = null;
    if (responsavel_id) {
      responsavel = await Usuario.findOne({ where: { id: responsavel_id, organizacao_id: req.organizacao_id, ativo: true }, attributes: ["id", "nome"] });
      if (!responsavel) return res.status(404).json({ erro: "Responsável não encontrado." });
      nome = responsavel.nome;
    }
    if (!nome) return res.status(422).json({ erro: "Selecione o responsável pela ação." });
    await validarPin(req, pin);
    const acao = await AcaoSemanal.create({
      organizacao_id: req.organizacao_id,
      ata_id: ata.id,
      descricao: texto(descricao, 400),
      responsavel_id: responsavel?.id || null,
      responsavel_nome: nome,
      prazo: prazo || null,
      estado: prazo ? (estado || "pendente") : "sem_prazo",
      criado_por: req.usuario.id,
    });
    auditoria.registrar({ req, acao: "visao_geral.acao.criar", alvoTipo: "acao_semanal", alvoId: acao.id, detalhe: { ata: ata.codigo, responsavel: nome, prazo: prazo || null } });
    return res.status(201).json({ mensagem: "Ação gravada na ata com sucesso.", acao });
  } catch (e) {
    return erro(res, e, "Erro ao gravar a ação na ata");
  }
};

exports.atualizarAcao = async (req, res) => {
  try {
    const { estado } = req.body || {};
    if (!["em_curso", "concluida", "pendente", "sem_prazo"].includes(estado)) return res.status(422).json({ erro: "Estado inválido." });
    const acao = await AcaoSemanal.findOne({ where: { id: req.params.id, organizacao_id: req.organizacao_id } });
    if (!acao) return res.status(404).json({ erro: "Ação não encontrada." });
    acao.estado = estado;
    acao.atualizado_por = req.usuario.id;
    await acao.save();
    auditoria.registrar({ req, acao: "visao_geral.acao.atualizar", alvoTipo: "acao_semanal", alvoId: acao.id, detalhe: { estado } });
    return res.json({ mensagem: "Estado da ação atualizado.", acao });
  } catch (e) {
    return erro(res, e, "Erro ao atualizar a ação");
  }
};

exports.pessoas = async (req, res) => {
  try {
    const pessoas = await Usuario.findAll({
      where: { organizacao_id: req.organizacao_id, ativo: true },
      attributes: ["id", "nome", "funcao", "perfil"],
      order: [["nome", "ASC"]],
    });
    return res.json({ pessoas });
  } catch (e) {
    return erro(res, e, "Erro ao carregar responsáveis");
  }
};

exports.estadoPin = async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.usuario.id, { attributes: ["id", "nome", "funcao", "pin_hash", "pin_atualizado_em"] });
    return res.json({ configurado: !!usuario?.pin_hash, atualizado_em: usuario?.pin_atualizado_em || null });
  } catch (e) {
    return erro(res, e, "Erro ao verificar o PIN");
  }
};

exports.salvarPin = async (req, res) => {
  try {
    const dados = await configurarPin(req, req.body?.pin, req.body?.senha_atual);
    auditoria.registrar({ req, acao: "visao_geral.pin.configurar", alvoTipo: "usuario", alvoId: req.usuario.id });
    return res.json({ mensagem: "PIN eletrónico configurado com sucesso.", ...dados });
  } catch (e) {
    return erro(res, e, "Erro ao configurar o PIN");
  }
};

exports.submeterAnexo = async (req, res) => {
  try {
    const ficheiro = req.files?.[0];
    if (!ficheiro) return res.status(400).json({ erro: "Selecione um ficheiro PDF ou imagem." });
    const ext = path.extname(ficheiro.originalname || "").toLowerCase();
    const mime = MIMES[ext];
    if (!mime) return res.status(400).json({ erro: "Formato não permitido. Use PDF, JPG, PNG ou WEBP." });
    const anexo = await VisaoGeralAnexo.create({
      organizacao_id: req.organizacao_id,
      nome_original: texto(ficheiro.originalname, 255),
      mime,
      extensao: ext,
      tamanho: ficheiro.size,
      conteudo: ficheiro.buffer,
      usuario_id: req.usuario.id,
    });
    auditoria.registrar({ req, acao: "visao_geral.anexo.criar", alvoTipo: "visao_geral_anexo", alvoId: anexo.id, detalhe: { nome: anexo.nome_original, tamanho: anexo.tamanho } });
    return res.status(201).json({ anexo: { id: anexo.id, nome_original: anexo.nome_original, mime: anexo.mime, tamanho: anexo.tamanho } });
  } catch (e) {
    return erro(res, e, "Erro ao carregar o comprovativo");
  }
};

exports.baixarAnexo = async (req, res) => {
  try {
    const anexo = await VisaoGeralAnexo.findOne({ where: { id: req.params.id, organizacao_id: req.organizacao_id } });
    if (!anexo) return res.status(404).json({ erro: "Comprovativo não encontrado." });
    const nome = encodeURIComponent(anexo.nome_original);
    res.setHeader("Content-Type", anexo.mime);
    res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${nome}`);
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.send(anexo.conteudo);
  } catch (e) {
    return erro(res, e, "Erro ao descarregar o comprovativo");
  }
};
