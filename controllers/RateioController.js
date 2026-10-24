const {
  sequelize,
  RateioCusto,
  TesourariaMovimento,
  OrdemProducao,
  ContaBancaria,
  Cliente,
} = require("../models");
const { Op } = require("sequelize");

function arredondar(v) {
  return Number(Number(v || 0).toFixed(2));
}

// Lista as despesas da tesouraria com os respectivos rateios, as ordens de
// produção disponíveis e os totais por OP. O utilizador escolhe uma despesa
// e reparte o valor por uma ou mais OPs.
exports.listar = async (req, res) => {
  try {
    const { termo, data_inicio, data_fim, ordem_producao_id, pendentes } = req.query;
    const where = {
      organizacao_id: req.organizacao_id,
      deleted: false,
      tipo: "saida",
      estado: { [Op.ne]: "anulado" },
    };
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    if (termo && String(termo).trim()) {
      const busca = `%${String(termo).trim()}%`;
      where[Op.or] = [
        { descricao: { [Op.like]: busca } },
        { categoria: { [Op.like]: busca } },
        { referencia: { [Op.like]: busca } },
      ];
    }

    let movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        {
          model: ContaBancaria,
          as: "conta",
          attributes: ["id", "banco_nome", "numero_conta", "tipo_conta"],
          required: false,
        },
        {
          model: RateioCusto,
          as: "rateios",
          required: false,
          include: [{
            model: OrdemProducao,
            as: "ordem",
            attributes: ["id", "numero", "produto", "estado"],
            required: false,
          }],
        },
      ],
      order: [["data_movimento", "DESC"], ["createdAt", "DESC"]],
    });

    if (ordem_producao_id) {
      movimentos = movimentos.filter((m) =>
        (m.rateios || []).some((r) => String(r.ordem_producao_id) === String(ordem_producao_id))
      );
    }

    let lista = movimentos.map((m) => {
      const item = m.toJSON();
      const totalRateado = arredondar(
        (item.rateios || []).reduce((s, r) => s + Number(r.valor || 0), 0)
      );
      item.total_rateado = totalRateado;
      item.restante = arredondar(Number(item.valor || 0) - totalRateado);
      return item;
    });

    if (String(pendentes || "") === "1") {
      lista = lista.filter((m) => m.restante > 0.004);
    }

    const ordens = await OrdemProducao.findAll({
      where: { organizacao_id: req.organizacao_id, deleted: false },
      attributes: ["id", "numero", "produto", "quantidade", "estado"],
      include: [{
        model: Cliente,
        as: "cliente",
        attributes: ["id", "nome", "empresa"],
        required: false,
      }],
      order: [["createdAt", "DESC"]],
    });

    // Totais por OP dentro do conjunto filtrado (período/pesquisa).
    const totaisMapa = new Map();
    lista.forEach((m) => {
      (m.rateios || []).forEach((r) => {
        const chave = String(r.ordem_producao_id);
        const atual = totaisMapa.get(chave) || {
          ordem_producao_id: r.ordem_producao_id,
          numero: r.ordem?.numero || `OP ${r.ordem_producao_id}`,
          produto: r.ordem?.produto || "",
          total: 0,
          despesas: new Set(),
        };
        atual.total = arredondar(atual.total + Number(r.valor || 0));
        atual.despesas.add(m.id);
        totaisMapa.set(chave, atual);
      });
    });

    const totaisPorOrdem = [...totaisMapa.values()]
      .map((t) => ({ ...t, despesas: t.despesas.size }))
      .sort((a, b) => b.total - a.total);

    const totalDespesas = arredondar(lista.reduce((s, m) => s + Number(m.valor || 0), 0));
    const totalRateado = arredondar(lista.reduce((s, m) => s + Number(m.total_rateado || 0), 0));

    return res.json({
      movimentos: lista,
      ordens,
      totais_por_ordem: totaisPorOrdem,
      resumo: {
        total_despesas: totalDespesas,
        total_rateado: totalRateado,
        total_por_ratear: arredondar(totalDespesas - totalRateado),
        despesas: lista.length,
      },
    });
  } catch (e) {
    console.error("Erro ao listar rateios:", e);
    return res.status(500).json({ erro: "Erro ao listar custos e rateios" });
  }
};

// Substitui a repartição de uma despesa. `itens` vazio remove os rateios.
// Cada item pode trazer `valor` ou `percentagem`; o valor prevalece.
exports.salvar = async (req, res) => {
  const transacao = await sequelize.transaction();
  try {
    const { movimento_id, itens } = req.body || {};
    if (!movimento_id) {
      await transacao.rollback();
      return res.status(400).json({ erro: "Indique a despesa a ratear" });
    }
    if (!Array.isArray(itens)) {
      await transacao.rollback();
      return res.status(400).json({ erro: "Formato de rateio inválido" });
    }

    const movimento = await TesourariaMovimento.findOne({
      where: { id: movimento_id, organizacao_id: req.organizacao_id },
      transaction: transacao,
    });
    if (!movimento) {
      await transacao.rollback();
      return res.status(404).json({ erro: "Despesa não encontrada" });
    }
    if (movimento.tipo !== "saida") {
      await transacao.rollback();
      return res.status(422).json({ erro: "Só é possível ratear despesas (saídas)" });
    }
    if (movimento.estado === "anulado") {
      await transacao.rollback();
      return res.status(422).json({ erro: "Esta despesa foi anulada e não pode ser rateada" });
    }

    const valorDespesa = Number(movimento.valor || 0);
    const vistos = new Set();
    const linhas = [];
    const observacoesPorOrdem = new Map(
      (itens || []).map((i) => [Number(i?.ordem_producao_id), i?.observacoes])
    );

    for (const item of itens) {
      const opId = Number(item?.ordem_producao_id);
      if (!opId) {
        await transacao.rollback();
        return res.status(400).json({ erro: "Selecione a ordem de produção em todas as linhas" });
      }
      if (vistos.has(opId)) {
        await transacao.rollback();
        return res.status(422).json({ erro: "A mesma ordem de produção aparece mais de uma vez" });
      }
      vistos.add(opId);

      const ordem = await OrdemProducao.findOne({
        where: { id: opId, organizacao_id: req.organizacao_id },
        transaction: transacao,
      });
      if (!ordem) {
        await transacao.rollback();
        return res.status(404).json({ erro: `Ordem de produção ${opId} não encontrada` });
      }

      const temValor = item?.valor !== undefined && item?.valor !== null && item?.valor !== "";
      const valor = temValor
        ? Number(item.valor)
        : (Number(item?.percentagem || 0) / 100) * valorDespesa;

      if (!Number.isFinite(valor) || valor <= 0) {
        await transacao.rollback();
        return res.status(400).json({ erro: `Valor inválido para a OP ${ordem.numero}` });
      }

      linhas.push({ ordem, valor: arredondar(valor) });
    }

    const total = arredondar(linhas.reduce((s, l) => s + l.valor, 0));
    if (total > arredondar(valorDespesa) + 0.004) {
      await transacao.rollback();
      return res.status(422).json({
        erro: `A soma dos rateios (${total.toFixed(2)}) não pode ultrapassar o valor da despesa (${valorDespesa.toFixed(2)})`,
      });
    }

    await RateioCusto.destroy({
      where: {
        organizacao_id: req.organizacao_id,
        movimento_id: movimento.id,
      },
      transaction: transacao,
    });

    for (const linha of linhas) {
      const percentagem = valorDespesa > 0
        ? Number(((linha.valor / valorDespesa) * 100).toFixed(2))
        : 0;
      await RateioCusto.create({
        organizacao_id: req.organizacao_id,
        movimento_id: movimento.id,
        ordem_producao_id: linha.ordem.id,
        percentagem,
        valor: linha.valor,
        observacoes: String(observacoesPorOrdem.get(linha.ordem.id) || "").trim() || null,
        criado_por: req.usuario?.id || null,
      }, { transaction: transacao });
    }

    await transacao.commit();

    const rateios = await RateioCusto.findAll({
      where: { organizacao_id: req.organizacao_id, movimento_id: movimento.id },
      include: [{
        model: OrdemProducao,
        as: "ordem",
        attributes: ["id", "numero", "produto", "estado"],
        required: false,
      }],
    });

    return res.json({
      mensagem: linhas.length
        ? "Rateio guardado com sucesso"
        : "Rateio removido desta despesa",
      movimento_id: movimento.id,
      total_rateado: total,
      restante: arredondar(valorDespesa - total),
      rateios,
    });
  } catch (e) {
    if (transacao && !transacao.finished) {
      await transacao.rollback().catch(() => {});
    }
    console.error("Erro ao guardar rateio:", e);
    return res.status(500).json({ erro: "Erro ao guardar rateio" });
  }
};
