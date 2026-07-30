const { sequelize, OrdemProducao, PreImpressao, Impressao, Acabamento, Qualidade, Cliente, Orcamento, ReservaEstoque } = require("../models");
const estoqueService = require("../services/estoque");

const ESTADOS_ORDEM = ["aguardando", "em_producao", "finalizado", "entregue"];

const MAPA_PRE = {
  arquivoRecebido: "arquivo",
  arquivo: "arquivo",
  tamanhoCorreto: "tamanho",
  tamanho: "tamanho",
  sangria: "sangria",
  CMYK: "cmyk",
  cmyk: "cmyk",
  fontesConvertidas: "fontes",
  fontes: "fontes",
  imagem300DPI: "imagens",
  imagens: "imagens",
  revisaoOrtografica: "revisao",
  revisao: "revisao",
  aprovacaoCliente: "aprovacao",
  aprovacao: "aprovacao",
  responsavel: "responsavel",
  observacoes: "observacoes",
};

const MAPA_IMP = {
  maquina: "maquina",
  operador: "operador",
  horaInicio: "data_inicio",
  inicio: "data_inicio",
  horaFim: "data_fim",
  fim: "data_fim",
  quantidadeProduzida: "quantidade_produzida",
  produzido: "quantidade_produzida",
  quantidadeRejeitada: "quantidade_rejeitada",
  rejeitado: "quantidade_rejeitada",
  observacoes: "observacoes",
};

function paraBooleano(v) {
  if (typeof v === "boolean") return v;
  if (v === "ok") return true;
  if (v === "nok") return false;
  return !!v;
}

function includeOrdem() {
  return [Cliente, Orcamento, PreImpressao, Impressao, Acabamento, Qualidade, ReservaEstoque];
}

async function podeAvancar(ordemId, organizacaoId, transaction) {
  const total = await ReservaEstoque.count({
    where: { ordem_producao_id: ordemId, organizacao_id: organizacaoId },
    transaction,
  });
  if (total === 0) return true;
  const op = await OrdemProducao.findByPk(ordemId, { transaction });
  return op?.requisicao_estado === "libertada";
}

exports.listarOrdens = async (req, res) => {
  try {
    const { estado } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    const ordens = await OrdemProducao.findAll({
      where,
      include: includeOrdem(),
      order: [["createdAt", "DESC"]],
    });
    return res.json(ordens);
  } catch (e) {
    console.error("Erro ao listar ordens de produção:", e);
    return res.status(500).json({ erro: "Erro ao listar ordens de produção" });
  }
};

exports.buscarOrdem = async (req, res) => {
  try {
    const ordem = await OrdemProducao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: includeOrdem(),
    });
    if (!ordem) return res.status(404).json({ erro: "Ordem de produção não encontrada" });
    return res.json(ordem);
  } catch (e) {
    console.error("Erro ao buscar ordem:", e);
    return res.status(500).json({ erro: "Erro ao buscar ordem" });
  }
};

exports.criarOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const b = req.body || {};
    const quantidade = parseInt(String(b.quantidade).replace(/\D/g, ""), 10) || 0;
    const estado = ESTADOS_ORDEM.includes(b.estado)
      ? b.estado
      : ESTADOS_ORDEM.includes(b.status)
        ? b.status
        : "aguardando";
    const ordem = await OrdemProducao.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      cliente_id: b.cliente_id || null,
      orcamento_id: b.orcamento_id || null,
      numero: b.numero || `OP-${new Date().getFullYear()}-${Date.now()}`,
      produto: b.produto || null,
      quantidade,
      data_entrada: b.dataEntrada || null,
      data_entrega: b.dataEntrega || null,
      estado,
      observacoes: b.observacoes || null,
    }, { transaction: t });
    await PreImpressao.create(
      { organizacao_id: req.organizacao_id, ordem_producao_id: ordem.id },
      { transaction: t }
    );
    let reservas = [];
    if (Array.isArray(b.itens_materiais) && b.itens_materiais.length) {
      try {
        reservas = await estoqueService.reservarMateriais({
          organizacaoId: req.organizacao_id,
          ordemProducaoId: ordem.id,
          itens: b.itens_materiais,
          usuarioId: req.usuario.id,
          transaction: t,
        });
      } catch (erroReserva) {
        await t.rollback();
        return res.status(erroReserva.status || 422).json({ erro: erroReserva.message || "Estoque insuficiente para reservar materiais" });
      }
    }
    await t.commit();
    const completa = await OrdemProducao.findByPk(ordem.id, { include: includeOrdem() });
    return res.status(201).json(completa);
  } catch (e) {
    await t.rollback();
    console.error("Erro ao criar ordem de produção:", e);
    return res.status(500).json({ erro: "Erro ao criar ordem de produção" });
  }
};

exports.libertarMateriais = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ordem = await OrdemProducao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: Cliente, required: false }],
      transaction: t,
    });
    if (!ordem) {
      await t.rollback();
      return res.status(404).json({ erro: "Ordem não encontrada" });
    }
    if (ordem.requisicao_estado === "libertada") {
      await t.rollback();
      return res.json({ mensagem: "Materiais já foram libertados", ordem: await OrdemProducao.findByPk(ordem.id, { include: includeOrdem() }) });
    }
    const b = req.body || {};
    await estoqueService.baixarReservas({
      organizacaoId: req.organizacao_id,
      ordemProducaoId: ordem.id,
      transaction: t,
      motivo: b.motivo || `Saída para produção — ${ordem.numero}`,
      solicitadoPor: b.solicitado_por,
      permitidoPor: b.permitido_por,
      observacoes: b.observacoes,
      clienteNome: ordem.cliente?.nome || null,
    });
    await ordem.update({ requisicao_estado: "libertada" }, { transaction: t });
    await t.commit();
    const completa = await OrdemProducao.findByPk(ordem.id, { include: includeOrdem() });
    return res.json(completa);
  } catch (e) {
    await t.rollback();
    console.error("Erro ao libertar materiais:", e);
    return res.status(500).json({ erro: "Erro ao libertar materiais" });
  }
};

exports.atualizarOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ordem = await OrdemProducao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      transaction: t,
    });
    if (!ordem) return res.status(404).json({ erro: "Ordem não encontrada" });
    const b = req.body || {};
    const dados = {};
    const estadoAnterior = ordem.estado;
    const estado = ESTADOS_ORDEM.includes(b.estado) ? b.estado : ESTADOS_ORDEM.includes(b.status) ? b.status : null;
    if (estado) dados.estado = estado;
    if (estado === "entregue") dados.entrega_ok = true;
    if (b.produto != null) dados.produto = b.produto;
    if (b.quantidade != null) dados.quantidade = parseInt(String(b.quantidade).replace(/\D/g, ""), 10) || 0;
    if (b.data_entrega != null) dados.data_entrega = b.data_entrega;
    if (b.dataEntrega != null) dados.data_entrega = b.dataEntrega;
    if (b.progresso != null) dados.progresso = b.progresso;
    if (b.observacoes != null) dados.observacoes = b.observacoes;
    if (
      estado &&
      estado !== estadoAnterior &&
      ["em_producao", "finalizado", "entregue"].includes(estado) &&
      !(await podeAvancar(ordem.id, req.organizacao_id, t))
    ) {
      await t.rollback();
      return res.status(422).json({
        erro: "Os materiais desta OP ainda não foram libertados pelo estoque. Faça a saída dos materiais antes de avançar a produção.",
      });
    }
    await ordem.update(dados, { transaction: t });
    if (estado && (estado === "finalizado" || estado === "entregue") && !["finalizado", "entregue"].includes(estadoAnterior)) {
      await estoqueService.baixarReservas({
        organizacaoId: req.organizacao_id,
        ordemProducaoId: ordem.id,
        transaction: t,
      });
    }
    await t.commit();
    const completa = await OrdemProducao.findByPk(ordem.id, { include: includeOrdem() });
    return res.json(completa);
  } catch (e) {
    await t.rollback();
    console.error("Erro ao atualizar ordem:", e);
    return res.status(500).json({ erro: "Erro ao atualizar ordem" });
  }
};

exports.removerOrdem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const ordem = await OrdemProducao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      transaction: t,
    });
    if (!ordem) return res.status(404).json({ erro: "Ordem não encontrada" });
    await estoqueService.cancelarReservas({
      organizacaoId: req.organizacao_id,
      ordemProducaoId: ordem.id,
      transaction: t,
    });
    await ordem.destroy({ transaction: t });
    await t.commit();
    return res.json({ mensagem: "Ordem removida com sucesso" });
  } catch (e) {
    await t.rollback();
    console.error("Erro ao remover ordem:", e);
    return res.status(500).json({ erro: "Erro ao remover ordem" });
  }
};

exports.salvarPreImpressao = async (req, res) => {
  try {
    const { ordem_producao_id } = req.params;
    const [pre, criado] = await PreImpressao.findOrCreate({
      where: { ordem_producao_id, organizacao_id: req.organizacao_id },
      defaults: { organizacao_id: req.organizacao_id, ordem_producao_id },
    });
    const dados = {};
    Object.entries(MAPA_PRE).forEach(([chave, campo]) => {
      if (req.body[chave] !== undefined && req.body[chave] !== null) {
        if (campo === "responsavel" || campo === "observacoes") dados[campo] = String(req.body[chave]);
        else dados[campo] = paraBooleano(req.body[chave]);
      }
    });
    if (Object.keys(dados).length) await pre.update(dados);
    const campos = ["arquivo", "tamanho", "cmyk", "fontes", "imagens", "revisao", "aprovacao"];
    const total = campos.length;
    const ok = campos.filter((c) => pre[c]).length;
    pre.resultado = ok === total ? "aprovado" : ok === 0 ? "pendente" : "reprovado";
    await pre.save();
    const op = await OrdemProducao.findByPk(ordem_producao_id);
    if (op) {
      if (ok === total) {
        if (!(await podeAvancar(op.id, req.organizacao_id))) {
          return res.status(422).json({
            erro: "Os materiais desta OP ainda não foram libertados pelo estoque. Faça a saída dos materiais antes de iniciar a produção.",
          });
        }
        await op.update({
          pre_impressao_ok: true,
          estado: op.estado === "aguardando" ? "em_producao" : op.estado,
        });
      } else {
        await op.update({ pre_impressao_ok: false });
      }
    }
    return res.json(pre);
  } catch (e) {
    console.error("Erro ao salvar pré-impressão:", e);
    return res.status(500).json({ erro: "Erro ao salvar pré-impressão" });
  }
};

exports.salvarImpressao = async (req, res) => {
  try {
    const { ordem_producao_id } = req.params;
    const dados = {};
    Object.entries(MAPA_IMP).forEach(([chave, campo]) => {
      if (req.body[chave] !== undefined && req.body[chave] !== null) dados[campo] = req.body[chave];
    });
    if (dados.quantidade_produzida !== undefined) dados.quantidade_produzida = parseInt(dados.quantidade_produzida, 10) || 0;
    if (dados.quantidade_rejeitada !== undefined) dados.quantidade_rejeitada = parseInt(dados.quantidade_rejeitada, 10) || 0;
    const produzida = dados.quantidade_produzida !== undefined ? dados.quantidade_produzida : 0;
    const rejeitada = dados.quantidade_rejeitada !== undefined ? dados.quantidade_rejeitada : 0;
    const total = produzida + rejeitada;
    dados.taxa_rejeicao = total > 0 ? Number(((rejeitada / total) * 100).toFixed(2)) : 0;
    dados.organizacao_id = req.organizacao_id;
    dados.ordem_producao_id = ordem_producao_id;
    const [imp, criado] = await Impressao.findOrCreate({
      where: { ordem_producao_id, organizacao_id: req.organizacao_id },
      defaults: dados,
    });
    if (!criado) await imp.update(dados);
    await OrdemProducao.update({ impressao_ok: true }, { where: { id: ordem_producao_id } });
    return res.json(imp);
  } catch (e) {
    console.error("Erro ao salvar impressão:", e);
    return res.status(500).json({ erro: "Erro ao salvar impressão" });
  }
};

exports.salvarAcabamento = async (req, res) => {
  try {
    const { ordem_producao_id } = req.params;
    const body = req.body || {};
    let servicos = null;
    if (Array.isArray(body.servicos)) {
      servicos = body.servicos;
    } else if (body && typeof body === "object") {
      servicos = Object.entries(body)
        .filter(([k]) => k !== "entrega" && k !== "responsavel" && k !== "observacoes")
        .map(([servico, estado]) => ({ servico, estado: estado || "pendente" }));
    }
    if (servicos && servicos.length) {
      await Acabamento.destroy({ where: { ordem_producao_id, organizacao_id: req.organizacao_id } });
      const items = servicos.map((s) => ({
        organizacao_id: req.organizacao_id,
        ordem_producao_id: parseInt(ordem_producao_id, 10),
        servico: s.servico,
        estado: s.estado || "pendente",
      }));
      const criados = await Acabamento.bulkCreate(items);
      const todosConcluidos = criados.length > 0 && criados.every((c) => c.estado === "concluido");
      await OrdemProducao.update({ acabamento_ok: todosConcluidos }, { where: { id: ordem_producao_id } });
      return res.json(criados);
    }
    return res.json([]);
  } catch (e) {
    console.error("Erro ao salvar acabamento:", e);
    return res.status(500).json({ erro: "Erro ao salvar acabamento" });
  }
};

exports.salvarQualidade = async (req, res) => {
  try {
    const { ordem_producao_id } = req.params;
    const campos = ["cor", "corte", "quantidade", "acabamento", "embalagem"];
    const dados = {};
    campos.forEach((c) => {
      const v = req.body[c];
      dados[c] = ["aprovado", "reprovado", "pendente"].includes(v) ? v : "pendente";
    });
    if (req.body.observacoes != null) dados.observacoes = req.body.observacoes;
    const [qual, criado] = await Qualidade.findOrCreate({
      where: { ordem_producao_id, organizacao_id: req.organizacao_id },
      defaults: { ...dados, organizacao_id: req.organizacao_id, ordem_producao_id },
    });
    if (!criado) await qual.update(dados);
    const total = campos.length;
    const ok = campos.filter((c) => qual[c] === "aprovado").length;
    qual.resultado = ok === total ? "aprovado" : ok === 0 ? "pendente" : "reprovado";
    await qual.save();
    const op = await OrdemProducao.findByPk(ordem_producao_id);
    if (op) {
      if (ok === total) {
        if (!(await podeAvancar(op.id, req.organizacao_id))) {
          return res.status(422).json({
            erro: "Os materiais desta OP ainda não foram libertados pelo estoque. Faça a saída dos materiais antes de concluir.",
          });
        }
        await op.update({
          qualidade_ok: true,
          estado: ["aguardando", "em_producao"].includes(op.estado) ? "finalizado" : op.estado,
        });
      } else {
        await op.update({ qualidade_ok: false });
      }
    }
    return res.json(qual);
  } catch (e) {
    console.error("Erro ao salvar qualidade:", e);
    return res.status(500).json({ erro: "Erro ao salvar qualidade" });
  }
};
