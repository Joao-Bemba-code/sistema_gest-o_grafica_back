const { Transaction } = require("sequelize");
const {
  sequelize,
  RequisicaoMaterial,
  RequisicaoMaterialItem,
  Cliente,
  Orcamento,
  Material,
  ReservaEstoque,
  Sequencia,
} = require("../models");

// Etiqueta usada quando a requisição é mesmo da própria organização (material
// acabado, consumíveis de fábrica) e não existe cliente associado.
const SEM_CLIENTE = "Consumo interno / produção";

// Sequência única das requisições de material da organização (KREQ-0001...).
// Corre na transacção do chamador: abrir outra transacção aninhada (ou uma
// segunda ligação, em SQLite) provoca bloqueios de escrita.
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

// Resolve o cliente de uma OP por ordem de fiabilidade:
//   1. relação Cliente já carregada;
//   2. cliente_id da OP;
//   3. cliente do orçamento que originou a OP.
// Só fica "Consumo interno" quando realmente não existe cliente. Isto evita
// que uma OP ligada a um orçamento apareça como consumo interno só porque o
// cliente_id não foi copiado para a ordem.
async function clienteDaOrdem({ ordem, organizacaoId, transaction }) {
  if (ordem?.cliente?.nome) {
    return { id: ordem.cliente.id || ordem.cliente_id || null, nome: ordem.cliente.nome };
  }

  if (ordem?.cliente_id) {
    const cliente = await Cliente.findOne({
      where: { id: ordem.cliente_id, organizacao_id: organizacaoId },
      transaction,
    });
    if (cliente) return { id: cliente.id, nome: cliente.nome };
  }

  if (ordem?.orcamento_id) {
    const orcamento = await Orcamento.findOne({
      where: { id: ordem.orcamento_id, organizacao_id: organizacaoId },
      include: [{ model: Cliente, required: false }],
      transaction,
    });
    if (orcamento?.cliente?.nome) {
      return { id: orcamento.cliente.id, nome: orcamento.cliente.nome };
    }
    if (orcamento?.cliente_id) {
      const cliente = await Cliente.findOne({
        where: { id: orcamento.cliente_id, organizacao_id: organizacaoId },
        transaction,
      });
      if (cliente) return { id: cliente.id, nome: cliente.nome };
    }
  }

  return { id: null, nome: SEM_CLIENTE };
}

// Garante que a requisição feita pelo fluxo da OP (reservas de stock) também
// fica visível no módulo de Estoque: cria uma requisição em "pendente" com os
// materiais reservados, para o stock receber a notificação e poder aprovar no
// mesmo sítio onde aprova as restantes.
async function garantirRequisicaoDaOrdem({ ordem, organizacaoId, solicitadoPor, usuarioId, transaction }) {
  if (!ordem?.id) return { requisicao: null, criada: false };

  const existente = await RequisicaoMaterial.findOne({
    where: { organizacao_id: organizacaoId, ordem_producao_id: ordem.id, estado: "pendente" },
    transaction,
  });
  if (existente) return { requisicao: existente, criada: false };

  const reservas = await ReservaEstoque.findAll({
    where: {
      organizacao_id: organizacaoId,
      ordem_producao_id: ordem.id,
      estado: ["ativa", "parcial"],
    },
    order: [["id", "ASC"]],
    transaction,
  });

  // Soma o que ainda está por consumir em cada material (pode haver mais do
  // que uma reserva do mesmo material depois de um complemento).
  const porMaterial = new Map();
  for (const reserva of reservas) {
    const restante = Number(reserva.quantidade_reservada || 0) - Number(reserva.quantidade_consumida || 0);
    if (restante <= 0) continue;
    const id = Number(reserva.material_id);
    porMaterial.set(id, Number(((porMaterial.get(id) || 0) + restante).toFixed(2)));
  }
  if (!porMaterial.size) return { requisicao: null, criada: false };

  const materiais = await Material.findAll({
    where: { id: [...porMaterial.keys()], organizacao_id: organizacaoId },
    transaction,
  });
  const porId = new Map(materiais.map((m) => [Number(m.id), m]));
  const cliente = await clienteDaOrdem({ ordem, organizacaoId, transaction });
  const numero = await proximoNumero(organizacaoId, transaction);

  const requisicao = await RequisicaoMaterial.create(
    {
      numero,
      organizacao_id: organizacaoId,
      ordem_producao_id: ordem.id,
      cliente_id: cliente.id,
      cliente_nome: cliente.nome,
      estado: "pendente",
      observacoes: ordem.observacoes_requisicao || null,
      solicitado_por: solicitadoPor || ordem.solicitado_por || null,
      data_requisicao: new Date(),
      usuario_id: usuarioId || null,
      total_itens: porMaterial.size,
    },
    { transaction }
  );

  await RequisicaoMaterialItem.bulkCreate(
    [...porMaterial.entries()].map(([materialId, quantidade]) => {
      const material = porId.get(materialId);
      return {
        requisicao_id: requisicao.id,
        organizacao_id: organizacaoId,
        material_id: materialId,
        material_codigo: material?.codigo || null,
        material_nome: material?.nome || `Material #${materialId}`,
        unidade: material?.unidade || "un",
        quantidade,
      };
    }),
    { transaction }
  );

  return { requisicao, criada: true };
}

module.exports = {
  SEM_CLIENTE,
  proximoNumero,
  clienteDaOrdem,
  garantirRequisicaoDaOrdem,
};
