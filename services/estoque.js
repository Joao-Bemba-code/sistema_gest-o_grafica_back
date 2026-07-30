const { Material, ReservaEstoque, MovimentoEstoque } = require("../models");

const FORMATOS = {
  A0: { largura: 84.1, altura: 118.9 },
  A1: { largura: 59.4, altura: 84.1 },
  A2: { largura: 42, altura: 59.4 },
  A3: { largura: 29.7, altura: 42 },
  A4: { largura: 21, altura: 29.7 },
  A5: { largura: 14.8, altura: 21 },
  A6: { largura: 10.5, altura: 14.8 },
  "66x96": { largura: 66, altura: 96 },
  "70x100": { largura: 70, altura: 100 },
  "76x112": { largura: 76, altura: 112 },
  "64x90": { largura: 64, altura: 90 },
};

function obterFormato(nome) {
  if (!nome) return null;
  const chave = Object.keys(FORMATOS).find(
    (k) => k.toLowerCase() === String(nome).toLowerCase()
  );
  return chave ? FORMATOS[chave] : null;
}

function listarFormatos() {
  return Object.entries(FORMATOS).map(([nome, dims]) => ({ nome, ...dims }));
}

function converterFormato(folhaLargura, folhaAltura, alvoLargura, alvoAltura) {
  const l = Number(folhaLargura);
  const a = Number(folhaAltura);
  const al = Number(alvoLargura);
  const aa = Number(alvoAltura);
  if (!(l > 0) || !(a > 0) || !(al > 0) || !(aa > 0)) {
    return { pecas_por_folha: 0, orientacao: "n/a" };
  }
  const semRotacao = Math.floor(l / al) * Math.floor(a / aa);
  const comRotacao = Math.floor(l / aa) * Math.floor(a / al);
  if (semRotacao >= comRotacao) {
    return { pecas_por_folha: semRotacao, orientacao: "normal" };
  }
  return { pecas_por_folha: comRotacao, orientacao: "rotacionada" };
}

function folhasNecessarias(quantidade, pecasPorFolha) {
  if (!(pecasPorFolha > 0)) return 0;
  return Math.ceil(Number(quantidade) / pecasPorFolha);
}

function aplicarQuebra(quantidade, percentualQuebra) {
  const q = Number(quantidade) || 0;
  const pct = Number(percentualQuebra) || 0;
  return pct > 0 ? Math.ceil(q * (1 + pct / 100)) : q;
}

async function reservarMateriais({ organizacaoId, ordemProducaoId, itens, usuarioId, transaction }) {
  const reservas = [];
  for (const item of itens || []) {
    const material = await Material.findOne({
      where: { id: item.material_id, organizacao_id: organizacaoId },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
    if (!material) throw new Error(`Material ${item.material_id} não encontrado`);
    const base = aplicarQuebra(item.quantidade, material.percentual_quebra);
    const disponivel = parseFloat(material.quantidade) - parseFloat(material.estoque_reservado);
    if (disponivel < base) {
      const erro = new Error(
        `Estoque insuficiente para "${material.nome}" — disponível ${disponivel} ${material.unidade}, necessários ${base}`
      );
      erro.status = 422;
      throw erro;
    }
    await material.update(
      { estoque_reservado: parseFloat(material.estoque_reservado) + base },
      { transaction }
    );
    const reserva = await ReservaEstoque.create(
      {
        organizacao_id: organizacaoId,
        ordem_producao_id: ordemProducaoId,
        material_id: material.id,
        quantidade_reservada: base,
        quantidade_consumida: 0,
        estado: "ativa",
        lote: item.lote || null,
        usuario_id: usuarioId,
      },
      { transaction }
    );
    reservas.push(reserva);
  }
  return reservas;
}

async function baixarReservas({ organizacaoId, ordemProducaoId, transaction, motivo = "Baixa automática — OP finalizada", solicitadoPor, permitidoPor, observacoes, clienteNome }) {
  const reservas = await ReservaEstoque.findAll({
    where: { organizacao_id: organizacaoId, ordem_producao_id: ordemProducaoId, estado: ["ativa", "parcial"] },
    transaction,
  });
  for (const reserva of reservas) {
    const material = await Material.findOne({
      where: { id: reserva.material_id, organizacao_id: organizacaoId },
      transaction,
    });
    if (!material) continue;
    const qtd = parseFloat(reserva.quantidade_reservada);
    const consumir = Math.min(qtd, parseFloat(material.quantidade));
    await material.update(
      {
        quantidade: parseFloat(material.quantidade) - consumir,
        estoque_reservado: Math.max(0, parseFloat(material.estoque_reservado) - qtd),
      },
      { transaction }
    );
    await reserva.update({ quantidade_consumida: consumir, estado: "consumida" }, { transaction });
    await MovimentoEstoque.create(
      {
        organizacao_id: organizacaoId,
        material_id: material.id,
        tipo: "saida",
        quantidade: consumir,
        referencia_tipo: "op",
        referencia_id: ordemProducaoId,
        lote: reserva.lote,
        motivo,
        cliente_nome: clienteNome || null,
        solicitado_por: solicitadoPor || null,
        permitido_por: permitidoPor || null,
        observacoes: observacoes || null,
        usuario_id: reserva.usuario_id,
      },
      { transaction }
    );
  }
  return reservas;
}

async function cancelarReservas({ organizacaoId, ordemProducaoId, transaction }) {
  const reservas = await ReservaEstoque.findAll({
    where: { organizacao_id: organizacaoId, ordem_producao_id: ordemProducaoId, estado: ["ativa", "parcial"] },
    transaction,
  });
  for (const reserva of reservas) {
    const material = await Material.findOne({
      where: { id: reserva.material_id, organizacao_id: organizacaoId },
      transaction,
    });
    const restante = parseFloat(reserva.quantidade_reservada) - parseFloat(reserva.quantidade_consumida);
    if (material) {
      await material.update(
        { estoque_reservado: Math.max(0, parseFloat(material.estoque_reservado) - restante) },
        { transaction }
      );
    }
    await reserva.update(
      {
        quantidade_reservada: parseFloat(reserva.quantidade_consumida),
        estado: parseFloat(reserva.quantidade_consumida) > 0 ? "parcial" : "cancelada",
      },
      { transaction }
    );
  }
  return reservas;
}

module.exports = {
  FORMATOS,
  obterFormato,
  listarFormatos,
  converterFormato,
  folhasNecessarias,
  aplicarQuebra,
  reservarMateriais,
  baixarReservas,
  cancelarReservas,
};
