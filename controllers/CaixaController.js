const { CaixaSessao, ContaBancaria, TesourariaMovimento } = require("../models");
const { Op } = require("sequelize");

// Calcula o que deveria estar na conta/caixa desde a abertura da sessão:
// valor de abertura + entradas confirmadas − saídas confirmadas.
// Transferências contam: sai da conta de origem, entra na conta de destino.
async function calcularResumo(sessao) {
  const base = {
    organizacao_id: sessao.organizacao_id,
    deleted: false,
    estado: "confirmado",
    createdAt: { [Op.gte]: sessao.data_abertura },
  };
  const [entradas, saidas, transfEntrada, transfSaida] = await Promise.all([
    TesourariaMovimento.sum("valor", {
      where: { ...base, conta_bancaria_id: sessao.conta_bancaria_id, tipo: "entrada" },
    }),
    TesourariaMovimento.sum("valor", {
      where: { ...base, conta_bancaria_id: sessao.conta_bancaria_id, tipo: "saida" },
    }),
    TesourariaMovimento.sum("valor", {
      where: { ...base, conta_destino_id: sessao.conta_bancaria_id, tipo: "transferencia" },
    }),
    TesourariaMovimento.sum("valor", {
      where: { ...base, conta_bancaria_id: sessao.conta_bancaria_id, tipo: "transferencia" },
    }),
  ]);

  const totalEntradas = Number(entradas || 0) + Number(transfEntrada || 0);
  const totalSaidas = Number(saidas || 0) + Number(transfSaida || 0);
  const esperado = Number((
    Number(sessao.valor_abertura || 0) + totalEntradas - totalSaidas
  ).toFixed(2));

  return {
    entradas: Number(totalEntradas.toFixed(2)),
    saidas: Number(totalSaidas.toFixed(2)),
    esperado,
  };
}

exports.listar = async (req, res) => {
  try {
    const { conta_id, estado } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (conta_id) where.conta_bancaria_id = conta_id;
    if (estado) where.estado = estado;

    const sessoes = await CaixaSessao.findAll({
      where,
      include: [{
        model: ContaBancaria,
        as: "conta",
        attributes: ["id", "banco_nome", "numero_conta", "tipo_conta", "saldo_atual"],
        required: false,
      }],
      order: [["data_abertura", "DESC"]],
    });

    const resultado = [];
    for (const sessao of sessoes) {
      const item = sessao.toJSON();
      item.resumo = sessao.estado === "aberto"
        ? await calcularResumo(sessao)
        : {
            entradas: null,
            saidas: null,
            esperado: Number(sessao.valor_esperado || 0),
          };
      resultado.push(item);
    }

    return res.json(resultado);
  } catch (e) {
    console.error("Erro ao listar sessões de caixa:", e);
    return res.status(500).json({ erro: "Erro ao listar sessões de caixa" });
  }
};

exports.abrir = async (req, res) => {
  try {
    const { conta_bancaria_id, valor_abertura, observacoes } = req.body || {};
    if (!conta_bancaria_id) {
      return res.status(400).json({ erro: "Indique a conta ou caixa a abrir" });
    }
    const valor = Number(valor_abertura);
    if (!Number.isFinite(valor) || valor < 0) {
      return res.status(400).json({ erro: "Indique um valor de abertura válido" });
    }

    const conta = await ContaBancaria.findOne({
      where: { id: conta_bancaria_id, organizacao_id: req.organizacao_id },
    });
    if (!conta) return res.status(404).json({ erro: "Conta ou caixa não encontrada" });
    if (conta.ativo === false) {
      return res.status(422).json({ erro: "Esta conta/caixa está inativa" });
    }

    const jaAberta = await CaixaSessao.findOne({
      where: {
        organizacao_id: req.organizacao_id,
        conta_bancaria_id: conta.id,
        estado: "aberto",
      },
    });
    if (jaAberta) {
      return res.status(422).json({
        erro: `Já existe uma sessão aberta para ${conta.banco_nome}. Feche-a antes de abrir outra.`,
      });
    }

    const sessao = await CaixaSessao.create({
      organizacao_id: req.organizacao_id,
      conta_bancaria_id: conta.id,
      data_abertura: new Date(),
      valor_abertura: valor,
      usuario_abertura_id: req.usuario?.id || null,
      usuario_abertura_nome: req.usuario?.nome || null,
      observacoes_abertura: String(observacoes || "").trim() || null,
      estado: "aberto",
    });

    const completa = await CaixaSessao.findByPk(sessao.id, {
      include: [{ model: ContaBancaria, as: "conta", required: false }],
    });
    return res.status(201).json({
      ...completa.toJSON(),
      resumo: await calcularResumo(sessao),
    });
  } catch (e) {
    console.error("Erro ao abrir caixa:", e);
    return res.status(500).json({ erro: "Erro ao abrir caixa" });
  }
};

exports.fechar = async (req, res) => {
  try {
    const sessao = await CaixaSessao.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id, estado: "aberto" },
      include: [{ model: ContaBancaria, as: "conta", required: false }],
    });
    if (!sessao) {
      return res.status(404).json({ erro: "Sessão de caixa aberta não encontrada" });
    }

    const valorFecho = Number(req.body?.valor_fecho);
    if (!Number.isFinite(valorFecho) || valorFecho < 0) {
      return res.status(400).json({ erro: "Indique o valor contado no fecho" });
    }

    const resumo = await calcularResumo(sessao);
    const diferenca = Number((valorFecho - resumo.esperado).toFixed(2));

    await sessao.update({
      data_fecho: new Date(),
      valor_esperado: resumo.esperado,
      valor_fecho: valorFecho,
      diferenca,
      usuario_fecho_id: req.usuario?.id || null,
      usuario_fecho_nome: req.usuario?.nome || null,
      observacoes_fecho: String(req.body?.observacoes || "").trim() || null,
      estado: "fechado",
    });

    const completa = await CaixaSessao.findByPk(sessao.id, {
      include: [{ model: ContaBancaria, as: "conta", required: false }],
    });
    return res.json({
      ...completa.toJSON(),
      resumo: { ...resumo, diferenca },
      mensagem: "Caixa fechado com sucesso",
    });
  } catch (e) {
    console.error("Erro ao fechar caixa:", e);
    return res.status(500).json({ erro: "Erro ao fechar caixa" });
  }
};
