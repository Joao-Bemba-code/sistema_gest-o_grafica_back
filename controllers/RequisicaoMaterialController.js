const { sequelize, RequisicaoMaterial, RequisicaoMaterialItem, Cliente, Material, MovimentoEstoque, Sequencia, OrdemProducao } = require("../models");
const { Transaction } = require("sequelize");
const { pode } = require("../services/permissoes");
const notificacoesService = require("../services/notificacoes");

// As requisições partem do chão de fábrica. Quem gere o stock regista
// saídas manuais no Provisionamento e limita-se a aprovar/rejeitar pedidos.
// O administrador não fica preso a esta separação de funções: tem de poder
// criar e cancelar pedidos quando está a fazer a gestão a tempo inteiro.
function gereStock(usuario) {
  if (!usuario) return false;
  if (usuario.perfil === "admin") return false;
  return pode(usuario, "estoque", "editar");
}

// Cliente opcional: uma requisição de material acabado (ou de consumo interno
// na fábrica) não tem cliente associado — é consumo da própria organização.
const SEM_CLIENTE = "Consumo interno / produção";

function parseNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/[^\d,.\-]/g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

// Corre sequencia na transacao do chamador: abrir uma transaccao aninhada
// seria uma segunda ligacao e, em SQLite, cause SQLITE_BUSY (a transaccao
// exterior ja segura a escrita).
async function proximoNumero(organizacao_id, t) {
  const lock = sequelize.getDialect() === "mysql" ? Transaction.LOCK.UPDATE : undefined;
  let seq = await Sequencia.findOne({ where: { organizacao_id }, transaction: t, lock });
  if (!seq) {
    seq = await Sequencia.create({ organizacao_id, numero: 0 }, { transaction: t });
  }
  const novo = Number(seq.numero || 0) + 1;
  await seq.update({ numero: novo }, { transaction: t });
  return `KREQ-${String(novo).padStart(4, "0")}`;
}

// A aprovação de uma requisição de material só acontece depois de o Estoque
// dizer quem preparou a recolha, quem a entregou, quem a recebeu e a data/hora
// da saída. Devolve { erro } quando falta alguma dessas peças, para a mensagem
// chegar ao utilizador antes de sequer tocar no stock.
function lerPreparacao(body = {}) {
  const preparado = String(body.preparado_por || "").trim().slice(0, 200);
  const entregue = String(body.entregue_por || "").trim().slice(0, 200);
  const recebido = String(body.recebido_por || "").trim().slice(0, 200);
  const data = String(body.data || "").trim();
  const hora = String(body.hora || "").trim();

  const faltam = [];
  if (!preparado) faltam.push("quem preparou");
  if (!entregue) faltam.push("quem entregou");
  if (!recebido) faltam.push("quem recebeu");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) faltam.push("a data");
  if (!/^(\d{1,2}):(\d{2})$/.test(hora)) faltam.push("a hora");
  if (faltam.length) return { erro: `Para aprovar indica: ${faltam.join(", ")}.` };

  const [hh, mm] = hora.split(":").map((n) => Number(n));
  if (hh > 23 || mm > 59) return { erro: "Hora inválida — usa o formato 24 horas (ex.: 14:30)." };
  const quando = new Date(`${data}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00`);
  if (Number.isNaN(quando.getTime())) return { erro: "Data inválida." };

  return {
    preparado_por: preparado,
    entregue_por: entregue,
    recebido_por: recebido,
    entregue_em: quando,
  };
}

function serializar(r) {
  const itens = (r.itens || []).map((i) => ({
    id: i.id,
    material_id: i.material_id,
    codigo: i.material_codigo,
    nome: i.material_nome,
    unidade: i.unidade,
    quantidade: Number(i.quantidade) || 0,
    quantidade_atendida: Number(i.quantidade_atendida) || 0,
    quantidade_devolvida: Number(i.quantidade_devolvida) || 0,
    observacoes: i.observacoes || "",
  }));
  return {
    id: r.id,
    numero: r.numero,
    ordem_producao_id: r.ordem_producao_id || null,
    ordem_producao_numero: r.ordem_producao?.numero || null,
    cliente_id: r.cliente_id,
    cliente_nome: r.cliente_nome,
    estado: r.estado,
    observacoes: r.observacoes,
    solicitado_por: r.solicitado_por,
    aprovado_por: r.aprovado_por,
    preparado_por: r.preparado_por || "",
    entregue_por: r.entregue_por || "",
    recebido_por: r.recebido_por || "",
    entregue_em: r.entregue_em || null,
    data_requisicao: r.data_requisicao || r.createdAt,
    data_aprovacao: r.data_aprovacao,
    motivo_rejeicao: r.motivo_rejeicao || "",
    total_itens: itens.length,
    itens,
  };
}

const INCLUDE = [
  { model: RequisicaoMaterialItem, as: "itens", required: false },
  { model: Cliente, as: "cliente", required: false },
  {
    model: OrdemProducao,
    as: "ordem_producao",
    required: false,
    attributes: ["id", "numero", "produto", "quantidade", "estado"],
  },
];

// Opções mínimas para o formulário da produção. Evita expor todo o cadastro
// comercial/material a perfis que só precisam de criar uma requisição.
exports.auxiliares = async (req, res) => {
  try {
    if (gereStock(req.usuario)) {
      return res.status(422).json({ erro: "O formulário de requisição é do pessoal da produção. O stock aprova ou rejeita os pedidos." });
    }
    const [clientes, materiais, ordens] = await Promise.all([
      Cliente.findAll({
        where: { organizacao_id: req.organizacao_id, tipo: "cliente", ativo: true },
        attributes: ["id", "nome", "empresa"],
        order: [["nome", "ASC"]],
      }),
      Material.findAll({
        where: { organizacao_id: req.organizacao_id, ativo: true, mover_estoque: true },
        attributes: ["id", "codigo", "nome", "unidade", "quantidade", "estoque_reservado"],
        order: [["nome", "ASC"]],
      }),
      // A requisição é sempre feita a partir de uma ordem de produção aberta.
      OrdemProducao.findAll({
        where: { organizacao_id: req.organizacao_id, estado: ["aguardando", "em_producao"] },
        attributes: ["id", "numero", "produto", "quantidade", "cliente_id", "estado"],
        include: [{ model: Cliente, required: false, attributes: ["id", "nome", "empresa"] }],
        order: [["createdAt", "DESC"]],
      }),
    ]);

    return res.json({
      clientes: clientes.map((c) => ({ id: c.id, nome: c.nome, empresa: c.empresa || "" })),
      ordens: ordens.map((o) => ({
        id: o.id,
        numero: o.numero,
        produto: o.produto || "",
        quantidade: Number(o.quantidade) || 0,
        estado: o.estado,
        cliente_id: o.cliente_id || null,
        cliente_nome: o.cliente?.nome || SEM_CLIENTE,
        cliente_empresa: o.cliente?.empresa || "",
      })),
      materiais: materiais.map((m) => {
        const quantidade = Number(m.quantidade) || 0;
        const reservado = Number(m.estoque_reservado) || 0;
        return {
          id: m.id,
          codigo: m.codigo || "",
          nome: m.nome,
          unidade: m.unidade || "un",
          quantidade,
          estoque_reservado: reservado,
          estoque_disponivel: Number((quantidade - reservado).toFixed(2)),
        };
      }),
    });
  } catch (e) {
    console.error("Erro ao carregar auxiliares da requisição:", e);
    return res.status(500).json({ erro: "Erro ao carregar clientes e materiais" });
  }
};

exports.listar = async (req, res) => {
  try {
    const { estado, cliente_id, ordem_producao_id } = req.query || {};
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    if (cliente_id) where.cliente_id = cliente_id;
    if (ordem_producao_id) where.ordem_producao_id = ordem_producao_id;
    const requisicoes = await RequisicaoMaterial.findAll({
      where,
      include: INCLUDE,
      order: [["createdAt", "DESC"]],
    });
    return res.json(requisicoes.map(serializar));
  } catch (e) {
    console.error("Erro ao listar requisições:", e);
    return res.status(500).json({ erro: "Erro ao listar requisições" });
  }
};

exports.criar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    if (gereStock(req.usuario)) {
      await t.rollback();
      return res.status(422).json({ erro: "As requisições são criadas pelo pessoal da produção. O stock deve aprovar ou rejeitar o pedido." });
    }
    const b = req.body || {};
    // A requisição é feita com base numa ordem de produção: é a OP que define o
    // cliente e o destino do material. O cliente não é escolhido à parte.
    const ordemId = Number(b.ordem_producao_id);
    if (!Number.isInteger(ordemId) || ordemId <= 0) {
      await t.rollback();
      return res.status(422).json({ erro: "Selecione a ordem de produção a que se destina a requisição" });
    }
    const ordem = await OrdemProducao.findOne({
      where: { id: ordemId, organizacao_id: req.organizacao_id },
      include: [{ model: Cliente, required: false }],
      transaction: t,
    });
    if (!ordem) {
      await t.rollback();
      return res.status(422).json({ erro: "Seleccione uma ordem de produção válida" });
    }
    if (["finalizado", "entregue"].includes(ordem.estado)) {
      await t.rollback();
      return res.status(422).json({ erro: "A ordem de produção já está fechada e não admite novas requisições de material" });
    }
    const cliente = ordem.cliente || null;
    const brutos = (Array.isArray(b.itens) ? b.itens : []).filter((i) => i && i.material_id);
    if (!brutos.length) {
      await t.rollback();
      return res.status(422).json({ erro: "Adicione pelo menos um material" });
    }
    // Consolida materiais repetidos antes de validar stock.
    const porMaterial = new Map();
    for (const i of brutos) {
      const id = Number(i.material_id);
      const qtd = parseNum(i.quantidade);
      if (!qtd || qtd <= 0) continue;
      const anterior = porMaterial.get(id);
      porMaterial.set(id, {
        material_id: id,
        quantidade: Number(((anterior?.quantidade || 0) + qtd).toFixed(2)),
        observacoes: i.observacoes || anterior?.observacoes || null,
      });
    }
    if (!porMaterial.size) {
      await t.rollback();
      return res.status(422).json({ erro: "Informe a quantidade de pelo menos um material" });
    }
    const materiais = await Material.findAll({
      where: { id: [...porMaterial.keys()], organizacao_id: req.organizacao_id },
      transaction: t,
    });
    if (materiais.length !== porMaterial.size) {
      await t.rollback();
      return res.status(422).json({ erro: "Um ou mais materiais não existem ou não pertencem à organização" });
    }
    const porId = new Map(materiais.map((m) => [Number(m.id), m]));

    // A requisição não bloqueia stock: valida-se a disponibilidade agora para
    // avisar cedo, mas o-stock real é conferido e baixado no momento da aprovação.
    const semStock = [];
    for (const item of porMaterial.values()) {
      const m = porId.get(item.material_id);
      const disponivel = parseFloat(m.quantidade) - parseFloat(m.estoque_reservado || 0);
      if (disponivel < item.quantidade) {
        semStock.push(`${m.nome} (disponível ${disponivel} ${m.unidade}, pedido ${item.quantidade})`);
      }
    }
    if (semStock.length) {
      await t.rollback();
      return res.status(422).json({
        erro: `Stock insuficiente no momento: ${semStock.join("; ")}. Ajuste a quantidade ou aguarde reposição.`,
      });
    }

    const numero = await proximoNumero(req.organizacao_id, t);
    const requisicao = await RequisicaoMaterial.create(
      {
        numero,
        organizacao_id: req.organizacao_id,
        ordem_producao_id: ordem.id,
        cliente_id: cliente ? cliente.id : null,
        cliente_nome: cliente ? cliente.nome : SEM_CLIENTE,
        estado: "pendente",
        observacoes: b.observacoes || null,
        solicitado_por: b.solicitado_por || req.usuario?.nome || null,
        data_requisicao: new Date(),
        usuario_id: req.usuario?.id || null,
      },
      { transaction: t }
    );
    await RequisicaoMaterialItem.bulkCreate(
      [...porMaterial.values()].map((i) => {
        const m = porId.get(i.material_id);
        return {
          requisicao_id: requisicao.id,
          organizacao_id: req.organizacao_id,
          material_id: i.material_id,
          material_codigo: m.codigo || null,
          material_nome: m.nome,
          unidade: m.unidade || "un",
          quantidade: i.quantidade,
          observacoes: i.observacoes,
        };
      }),
      { transaction: t }
    );
    await requisicao.update({ total_itens: porMaterial.size }, { transaction: t });

    // A requisição nasce de uma OP: a OP passa a "requisitada" (e volta a
    // precisar de aprovação do estoque se o material já tinha sido libertado,
    // tal como acontece no fluxo de material adicional do ProducaoController).
    try {
      const op = await OrdemProducao.findOne({
        where: { id: ordem.id, organizacao_id: req.organizacao_id },
        transaction: t,
      });
      if (op) {
        // pendente → requisitada; requisitada mantém-se; libertada volta a
        // requisitada porque o novo material precisa de nova aprovação.
        await op.update({
          requisicao_estado: "requisitada",
          solicitado_por: b.solicitado_por || req.usuario?.nome || op.solicitado_por,
        }, { transaction: t });
      }
    } catch (e) {
      console.error("Erro ao actualizar a OP da requisição:", e);
    }
    await t.commit();

    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "estoque",
        nivel: "warning",
        icone: "pending_actions",
        titulo: `Requisição de material ${numero}`,
        descricao: `${requisicao.solicitado_por || "Produção"} requisitou ${porMaterial.size} material(is) para a OP ${ordem.numero || ordem.id}${cliente ? ` · ${cliente.nome}` : " · consumo interno"}. Aguarda aprovação.`,
        link: "/estoque",
        usuarioId: req.usuario?.id || null,
      });
    } catch (e) {
      console.error("Erro ao notificar requisição de material:", e);
    }

    // A transação já foi committed: um erro aqui não pode invalidar a criação.
    const completa = await RequisicaoMaterial.findByPk(requisicao.id, { include: INCLUDE })
      .catch(() => requisicao);
    return res.status(201).json(serializar(completa));
  } catch (e) {
    if (!t.finished) await t.rollback().catch(() => {});
    console.error("Erro ao criar requisição de material:", e);
    return res.status(500).json({ erro: "Erro ao criar requisição de material" });
  }
};

exports.aprovar = async (req, res) => {
  // Primeiro os dados da preparação/entrega: se faltarem, o stock não é tocado.
  const preparacao = lerPreparacao(req.body || {});
  if (preparacao.erro) return res.status(422).json({ erro: preparacao.erro });

  const t = await sequelize.transaction();
  try {
    const requisicao = await RequisicaoMaterial.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: RequisicaoMaterialItem, as: "itens", required: false }],
      transaction: t,
    });
    if (!requisicao) {
      await t.rollback();
      return res.status(404).json({ erro: "Requisição não encontrada" });
    }
    if (requisicao.estado !== "pendente") {
      await t.rollback();
      return res.status(422).json({ erro: `Esta requisição já está em "${requisicao.estado}" e não pode ser aprovada de novo` });
    }
    const itens = requisicao.itens || [];
    if (!itens.length) {
      await t.rollback();
      return res.status(422).json({ erro: "A requisição não tem itens" });
    }

    // Confirma e bloqueia cada material antes de baixar stock.
    const materials = new Map();
    for (const item of itens) {
      const m = await Material.findOne({
        where: { id: item.material_id, organizacao_id: req.organizacao_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!m) {
        await t.rollback();
        return res.status(422).json({ erro: `Material "${item.material_nome}" não existe mais` });
      }
      materials.set(Number(item.id), m);
    }
    const semStock = [];
    for (const item of itens) {
      const m = materials.get(Number(item.id));
      const disponivel = parseFloat(m.quantidade) - parseFloat(m.estoque_reservado || 0);
      const pedido = parseFloat(item.quantidade) || 0;
      if (disponivel < pedido) {
        semStock.push(`${m.nome} (disponível ${disponivel} ${m.unidade}, pedido ${pedido})`);
      }
    }
    if (semStock.length) {
      await t.rollback();
      return res.status(422).json({
        erro: `Não foi possível aprovar por falta de stock: ${semStock.join("; ")}.`,
      });
    }

    for (const item of itens) {
      const m = materials.get(Number(item.id));
      const qtd = parseFloat(item.quantidade) || 0;
      await m.update({ quantidade: Number((parseFloat(m.quantidade) - qtd).toFixed(2)) }, { transaction: t });
      await MovimentoEstoque.create(
        {
          organizacao_id: req.organizacao_id,
          material_id: item.material_id,
          tipo: "saida",
          quantidade: qtd,
          referencia_tipo: "requisicao_material",
          referencia_id: requisicao.id,
          motivo: `Requisição de material ${requisicao.numero} aprovada`,
          cliente_nome: requisicao.cliente_nome,
          solicitado_por: requisicao.solicitado_por,
          permitido_por: preparacao.entregue_por,
          observacoes: `Preparado por ${preparacao.preparado_por} · entregue por ${preparacao.entregue_por} · recebido por ${preparacao.recebido_por}`,
          usuario_id: req.usuario?.id || null,
        },
        { transaction: t }
      );
      await item.update({ quantidade_atendida: qtd }, { transaction: t });
    }
    const aprovadoPor = req.usuario?.nome || null;
    await requisicao.update(
      {
        estado: "aprovada",
        aprovado_por: aprovadoPor,
        data_aprovacao: new Date(),
        preparado_por: preparacao.preparado_por,
        entregue_por: preparacao.entregue_por,
        recebido_por: preparacao.recebido_por,
        entregue_em: preparacao.entregue_em,
      },
      { transaction: t }
    );
    // A aprovação desbloqueia a OP de origem: o material saiu do stock e a
    // produção pode avançar (espelho do aprovarMateriais do ProducaoController).
    try {
      if (requisicao.ordem_producao_id) {
        const op = await OrdemProducao.findOne({
          where: { id: requisicao.ordem_producao_id, organizacao_id: req.organizacao_id },
          transaction: t,
        });
        if (op && op.requisicao_estado !== "libertada") {
          await op.update({ requisicao_estado: "libertada", permitido_por: aprovadoPor }, { transaction: t });
        }
      }
    } catch (e) {
      console.error("Erro ao libertar a OP da requisição aprovada:", e);
    }
    await t.commit();
    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "producao",
        nivel: "success",
        icone: "inventory",
        titulo: `Requisição de material ${requisicao.numero} aprovada`,
        descricao: `${itens.length} material(is) para ${requisicao.cliente_nome} — preparado por ${preparacao.preparado_por}, entregue por ${preparacao.entregue_por}, recebido por ${preparacao.recebido_por}.`,
        link: "/producao",
        usuarioId: req.usuario?.id || null,
      });
    } catch (e) {
      console.error("Erro ao notificar aprovação da requisição:", e);
    }
    // A transação já foi committed: um erro aqui não pode invalidar a
    // aprovação nem deixar a request pendurada sem resposta.
    const completa = await RequisicaoMaterial.findByPk(requisicao.id, { include: INCLUDE })
      .catch(() => requisicao);
    return res.json(serializar(completa));
  } catch (e) {
    if (!t.finished) await t.rollback().catch(() => {});
    console.error("Erro ao aprovar requisição de material:", e);
    return res.status(500).json({ erro: "Erro ao aprovar requisição de material" });
  }
};

exports.rejeitar = async (req, res) => {
  try {
    const requisicao = await RequisicaoMaterial.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!requisicao) return res.status(404).json({ erro: "Requisição não encontrada" });
    if (requisicao.estado !== "pendente") {
      return res.status(422).json({ erro: `Só é possível rejeitar requisições pendentes (actual: ${requisicao.estado})` });
    }
    const motivo = String(req.body?.motivo || "").trim();
    if (!motivo) return res.status(422).json({ erro: "Indique o motivo da rejeição" });
    await requisicao.update({
      estado: "rejeitada",
      motivo_rejeicao: motivo.slice(0, 400),
      aprovado_por: req.usuario?.nome || null,
      data_aprovacao: new Date(),
    });
    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "producao",
        nivel: "error",
        icone: "cancel",
        titulo: `Requisição de material ${requisicao.numero} rejeitada`,
        descricao: `Pedido para ${requisicao.cliente_nome} recusado por ${req.usuario?.nome || "Estoque"}. Motivo: ${motivo.slice(0, 400)}.`,
        link: "/producao",
        usuarioId: req.usuario?.id || null,
      });
    } catch (e) {
      console.error("Erro ao notificar rejeição da requisição:", e);
    }
    const completa = await RequisicaoMaterial.findByPk(requisicao.id, { include: INCLUDE });
    return res.json(serializar(completa));
  } catch (e) {
    console.error("Erro ao rejeitar requisição de material:", e);
    return res.status(500).json({ erro: "Erro ao rejeitar requisição de material" });
  }
};

exports.cancelar = async (req, res) => {
  try {
    if (gereStock(req.usuario)) {
      return res.status(422).json({ erro: "O cancelamento é feito pelo pessoal da produção. O stock deve aprovar ou rejeitar o pedido." });
    }
    const requisicao = await RequisicaoMaterial.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!requisicao) return res.status(404).json({ erro: "Requisição não encontrada" });
    if (requisicao.estado !== "pendente") {
      return res.status(422).json({ erro: "Só é possível cancelar uma requisição pendente" });
    }
    await requisicao.update({ estado: "cancelada" });
    const completa = await RequisicaoMaterial.findByPk(requisicao.id, { include: INCLUDE });
    return res.json(serializar(completa));
  } catch (e) {
    console.error("Erro ao cancelar requisição de material:", e);
    return res.status(500).json({ erro: "Erro ao cancelar requisição de material" });
  }
};

// Devolve material ao stock. Só é possível devolver o que já saiu (quantidade
// atendida) e nunca mais do que isso — o acumulado devolvido fica sempre
// dentro do recebido. Cada devolução gera um movimento de entrada auditável.
exports.devolver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const requisicao = await RequisicaoMaterial.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: RequisicaoMaterialItem, as: "itens", required: false }],
      transaction: t,
    });
    if (!requisicao) {
      await t.rollback();
      return res.status(404).json({ erro: "Requisição não encontrada" });
    }
    if (!["aprovada", "consumida"].includes(requisicao.estado)) {
      await t.rollback();
      return res.status(422).json({ erro: "Só é possível devolver material de requisições aprovadas ou concluídas" });
    }
    const itens = requisicao.itens || [];
    if (!itens.length) {
      await t.rollback();
      return res.status(422).json({ erro: "A requisição não tem itens" });
    }
    const porId = new Map(itens.map((i) => [Number(i.id), i]));

    const brutos = (Array.isArray(req.body?.itens) ? req.body.itens : [])
      .map((i) => ({ item: porId.get(Number(i.item_id)), quantidade: parseNum(i.quantidade) }))
      .filter((x) => x.item && x.quantidade > 0);
    if (!brutos.length) {
      await t.rollback();
      return res.status(422).json({ erro: "Indique a quantidade a devolver de pelo menos um material" });
    }

    // Nunca devolver mais do que o recebido nesta requisição.
    const excedidos = [];
    for (const { item, quantidade } of brutos) {
      const atendida = Number(item.quantidade_atendida) || 0;
      const devolvida = Number(item.quantidade_devolvida) || 0;
      if (quantidade > Number((atendida - devolvida).toFixed(2)) + 1e-9) {
        excedidos.push(
          `${item.material_nome} (recebido ${atendida}, já devolvido ${devolvida}, devolver ${quantidade})`
        );
      }
    }
    if (excedidos.length) {
      await t.rollback();
      return res.status(422).json({
        erro: `A devolução não pode ser superior ao recebido: ${excedidos.join("; ")}.`,
      });
    }

    const devolvidoPor = req.body?.devolvido_por || req.usuario?.nome || null;
    const motivo = String(req.body?.motivo || "").trim();
    for (const { item, quantidade } of brutos) {
      const material = await Material.findOne({
        where: { id: item.material_id, organizacao_id: req.organizacao_id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!material) {
        await t.rollback();
        return res.status(422).json({ erro: `Material "${item.material_nome}" não existe mais` });
      }
      await material.update(
        { quantidade: Number((parseFloat(material.quantidade) + quantidade).toFixed(2)) },
        { transaction: t }
      );
      await MovimentoEstoque.create(
        {
          organizacao_id: req.organizacao_id,
          material_id: item.material_id,
          tipo: "entrada",
          quantidade,
          referencia_tipo: "devolucao",
          referencia_id: requisicao.id,
          motivo: motivo || `Devolução de material ${requisicao.numero}`,
          cliente_nome: requisicao.cliente_nome,
          solicitado_por: requisicao.solicitado_por,
          permitido_por: devolvidoPor,
          usuario_id: req.usuario?.id || null,
        },
        { transaction: t }
      );
      const jaDevolvida = Number(item.quantidade_devolvida) || 0;
      await item.update(
        { quantidade_devolvida: Number((jaDevolvida + quantidade).toFixed(2)) },
        { transaction: t }
      );
    }
    await t.commit();

    try {
      await notificacoesService.criar({
        organizacaoId: req.organizacao_id,
        tipo: "estoque",
        nivel: "info",
        icone: "undo",
        titulo: `Devolução na requisição ${requisicao.numero}`,
        descricao: `Material devolvido ao stock por ${devolvidoPor || "Produção"}.`,
        link: "/estoque",
        usuarioId: req.usuario?.id || null,
      });
    } catch (e) {
      console.error("Erro ao notificar devolução de material:", e);
    }

    const completa = await RequisicaoMaterial.findByPk(requisicao.id, { include: INCLUDE })
      .catch(() => requisicao);
    return res.json(serializar(completa));
  } catch (e) {
    if (!t.finished) await t.rollback().catch(() => {});
    console.error("Erro ao devolver material da requisição:", e);
    return res.status(500).json({ erro: "Erro ao devolver material da requisição" });
  }
};
