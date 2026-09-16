const { TesourariaMovimento, ContaBancaria, Cliente, Faturacao, Usuario } = require("../models");
const { Op, fn, col, literal } = require("sequelize");
const { gerarExcel } = require("../services/tesourariaExcel");

const ESTADOS = ["pendente", "confirmado", "cancelado"];
const TIPOS = ["entrada", "saida", "transferencia"];
const CATEGORIAS_ENTRADA = ["venda", "servico", "devolucao", "comissao", "deposito"];
const CATEGORIAS_SAIDA = ["compra", "despesa", "salario", "imposto", "aluguel", "utilidades", "emprestimo", "levantamento"];
const CATEGORIAS_TRANSFERENCIA = ["transferencia_interna"];

function resolverClienteId(body) {
  if (body.cliente_id) return body.cliente_id;
  return null;
}

exports.listar = async (req, res) => {
  try {
    const { tipo, categoria, estado, conta_id, data_inicio, data_fim, cliente_id } = req.query;
    const where = { organizacao_id: req.organizacao_id, deleted: false };
    if (tipo) where.tipo = tipo;
    if (categoria) where.categoria = categoria;
    if (estado) where.estado = estado;
    if (conta_id) where.conta_bancaria_id = conta_id;
    if (cliente_id) where.cliente_id = cliente_id;
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    const movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        { model: ContaBancaria, as: "conta", attributes: ["id", "banco_nome", "numero_conta", "tipo_conta"], required: false },
        { model: Cliente, as: "cliente", attributes: ["id", "nome", "empresa"], required: false },
        { model: Faturacao, as: "fatura", attributes: ["id", "numero", "total"], required: false },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"], required: false },
      ],
      order: [["data_movimento", "DESC"], ["createdAt", "DESC"]],
    });
    return res.json(movimentos);
  } catch (e) {
    console.error("Erro ao listar movimentos:", e);
    return res.status(500).json({ erro: "Erro ao listar movimentos de tesouraria" });
  }
};

exports.buscar = async (req, res) => {
  try {
    const movimento = await TesourariaMovimento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [
        { model: ContaBancaria, as: "conta", required: false },
        { model: Cliente, as: "cliente", required: false },
        { model: Faturacao, as: "fatura", required: false },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"], required: false },
        { model: Usuario, as: "aprovador", attributes: ["id", "nome"], required: false },
      ],
    });
    if (!movimento) return res.status(404).json({ erro: "Movimento não encontrado" });
    return res.json(movimento);
  } catch (e) {
    console.error("Erro ao buscar movimento:", e);
    return res.status(500).json({ erro: "Erro ao buscar movimento" });
  }
};

exports.criar = async (req, res) => {
  try {
    const {
      tipo, categoria, descricao, valor, data_movimento, hora_movimento,
      referencia, referencia_tipo, referencia_id, cliente_id, fatura_id,
      conta_bancaria_id, conta_destino_id, metodo_pagamento, comprovativo,
      estado, observacoes,
    } = req.body;

    if (!tipo || !TIPOS.includes(tipo)) return res.status(400).json({ erro: "Tipo de movimento inválido" });
    if (tipo === "entrada" && categoria !== "comissao") {
      return res.status(400).json({ erro: "Entradas só podem ser registadas manualmente para comissões. Para vendas, marque a fatura como paga." });
    }
    if (!descricao || !String(descricao).trim()) return res.status(400).json({ erro: "Descrição é obrigatória" });
    const valorNum = parseFloat(valor);
    if (!valorNum || valorNum <= 0) return res.status(400).json({ erro: "Valor deve ser maior que zero" });

    if (categoria) {
      const categoriasValidas = tipo === "entrada" ? CATEGORIAS_ENTRADA
        : tipo === "saida" ? CATEGORIAS_SAIDA
        : CATEGORIAS_TRANSFERENCIA;
      if (!categoriasValidas.includes(categoria)) {
        return res.status(400).json({ erro: `Categoria "${categoria}" não é válida para o tipo "${tipo}"` });
      }
    }

    const movimento = await TesourariaMovimento.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      tipo,
      categoria: categoria || (tipo === "entrada" ? "venda" : tipo === "saida" ? "despesa" : "transferencia_interna"),
      descricao: String(descricao).trim(),
      valor: valorNum,
      data_movimento: data_movimento || new Date().toISOString().split("T")[0],
      hora_movimento: hora_movimento || new Date().toTimeString().split(" ")[0],
      referencia: referencia || null,
      referencia_tipo: referencia_tipo || null,
      referencia_id: referencia_id || null,
      cliente_id: resolverClienteId(req.body),
      fatura_id: fatura_id || null,
      conta_bancaria_id: conta_bancaria_id || null,
      conta_destino_id: conta_destino_id || null,
      metodo_pagamento: metodo_pagamento || null,
      comprovativo: comprovativo || null,
      estado: ESTADOS.includes(estado) ? estado : "confirmado",
      observacoes: observacoes || null,
    });

    if (conta_bancaria_id && movimento.estado === "confirmado") {
      const conta = await ContaBancaria.findByPk(conta_bancaria_id);
      if (conta) {
        const novoSaldo = tipo === "entrada"
          ? Number(conta.saldo_atual) + valorNum
          : Number(conta.saldo_atual) - valorNum;
        await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }

    if (tipo === "transferencia" && conta_destino_id && movimento.estado === "confirmado") {
      const contaDest = await ContaBancaria.findByPk(conta_destino_id);
      if (contaDest) {
        const novoSaldo = Number(contaDest.saldo_atual) + valorNum;
        await contaDest.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }

    const completa = await TesourariaMovimento.findByPk(movimento.id, {
      include: [
        { model: ContaBancaria, as: "conta", required: false },
        { model: Cliente, as: "cliente", required: false },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"], required: false },
      ],
    });
    return res.status(201).json(completa);
  } catch (e) {
    console.error("Erro ao criar movimento:", e?.message || e);
    if (e?.original) console.error("DB Error:", e.original.code, e.original.sqlMessage);
    return res.status(500).json({ erro: "Erro ao criar movimento" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const movimento = await TesourariaMovimento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!movimento) return res.status(404).json({ erro: "Movimento não encontrado" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.usuario_id;
    if (dados.tipo && !TIPOS.includes(dados.tipo)) delete dados.tipo;
    if (dados.tipo === "entrada") {
      return res.status(400).json({ erro: "Entradas não podem ser registadas manualmente. Marque a fatura como paga para gerar a entrada automaticamente." });
    }
    if (dados.estado && !ESTADOS.includes(dados.estado)) delete dados.estado;
    await movimento.update(dados);
    const completa = await TesourariaMovimento.findByPk(movimento.id, {
      include: [
        { model: ContaBancaria, as: "conta", required: false },
        { model: Cliente, as: "cliente", required: false },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"], required: false },
      ],
    });
    return res.json(completa);
  } catch (e) {
    console.error("Erro ao atualizar movimento:", e);
    return res.status(500).json({ erro: "Erro ao atualizar movimento" });
  }
};

exports.remover = async (req, res) => {
  try {
    const movimento = await TesourariaMovimento.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!movimento) return res.status(404).json({ erro: "Movimento não encontrado" });
    if (movimento.estado === "confirmado") {
      // Repor o saldo da conta de origem.
      if (movimento.conta_bancaria_id) {
        const conta = await ContaBancaria.findByPk(movimento.conta_bancaria_id);
        if (conta) {
          const novoSaldo = movimento.tipo === "entrada"
            ? Number(conta.saldo_atual) - Number(movimento.valor)
            : Number(conta.saldo_atual) + Number(movimento.valor);
          await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
        }
      }
      // Repor o saldo da conta destino (transferência).
      if (movimento.tipo === "transferencia" && movimento.conta_destino_id) {
        const contaDest = await ContaBancaria.findByPk(movimento.conta_destino_id);
        if (contaDest) {
          const novoSaldo = Number(contaDest.saldo_atual) - Number(movimento.valor);
          await contaDest.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
        }
      }
    }
    await movimento.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Movimento removido com sucesso" });
  } catch (e) {
    console.error("Erro ao remover movimento:", e);
    return res.status(500).json({ erro: "Erro ao remover movimento" });
  }
};

exports.resumo = async (req, res) => {
  try {
    const org = req.organizacao_id;
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().split("T")[0];
    const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().split("T")[0];
    const inicioAno = new Date(hoje.getFullYear(), 0, 1).toISOString().split("T")[0];
    const fimAno = new Date(hoje.getFullYear(), 11, 31).toISOString().split("T")[0];

    const whereBase = { organizacao_id: org, estado: "confirmado" };

    const [entradasMes, saidasMes, entradasAno, saidasAno, totalContas, comissoesMes, emprestimosMes] = await Promise.all([
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "entrada", data_movimento: { [Op.between]: [inicioMes, fimMes] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "saida", data_movimento: { [Op.between]: [inicioMes, fimMes] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "entrada", data_movimento: { [Op.between]: [inicioAno, fimAno] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, tipo: "saida", data_movimento: { [Op.between]: [inicioAno, fimAno] } },
      }),
      ContaBancaria.sum("saldo_atual", {
        where: { organizacao_id: org, ativo: true },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, categoria: "comissao", data_movimento: { [Op.between]: [inicioMes, fimMes] } },
      }),
      TesourariaMovimento.sum("valor", {
        where: { ...whereBase, categoria: "emprestimo", data_movimento: { [Op.between]: [inicioMes, fimMes] } },
      }),
    ]);

    const contas = await ContaBancaria.findAll({
      where: { organizacao_id: org, ativo: true },
      attributes: ["id", "banco_nome", "numero_conta", "saldo_atual", "tipo_conta", "favorita"],
    });

    const movimentosHoje = await TesourariaMovimento.count({
      where: { ...whereBase, data_movimento: hoje.toISOString().split("T")[0] },
    });

    return res.json({
      saldoTotal: Number(totalContas || 0),
      entradasMes: Number(entradasMes || 0),
      saidasMes: Number(saidasMes || 0),
      saldoMes: Number((entradasMes || 0) - (saidasMes || 0)),
      entradasAno: Number(entradasAno || 0),
      saidasAno: Number(saidasAno || 0),
      comissoesMes: Number(comissoesMes || 0),
      emprestimosMes: Number(emprestimosMes || 0),
      movimentosHoje,
      contas,
    });
  } catch (e) {
    console.error("Erro ao gerar resumo de tesouraria:", e);
    return res.status(500).json({ erro: "Erro ao gerar resumo de tesouraria" });
  }
};

exports.movimentosPorConta = async (req, res) => {
  try {
    const { conta_id } = req.params;
    const { data_inicio, data_fim } = req.query;
    const where = { organizacao_id: req.organizacao_id, conta_bancaria_id: conta_id };
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    const movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        { model: Cliente, as: "cliente", attributes: ["id", "nome"], required: false },
        { model: Usuario, as: "usuario", attributes: ["id", "nome"], required: false },
      ],
      order: [["data_movimento", "DESC"]],
    });
    return res.json(movimentos);
  } catch (e) {
    console.error("Erro ao listar movimentos por conta:", e);
    return res.status(500).json({ erro: "Erro ao listar movimentos" });
  }
};

exports.exportar = async (req, res) => {
  try {
    const { tipo, categoria, data_inicio, data_fim, conta_id } = req.query;
    const where = { organizacao_id: req.organizacao_id, deleted: false };
    if (tipo) where.tipo = tipo;
    if (categoria) where.categoria = categoria;
    if (conta_id) where.conta_bancaria_id = conta_id;
    if (data_inicio || data_fim) {
      where.data_movimento = {};
      if (data_inicio) where.data_movimento[Op.gte] = data_inicio;
      if (data_fim) where.data_movimento[Op.lte] = data_fim;
    }
    const movimentos = await TesourariaMovimento.findAll({
      where,
      include: [
        { model: ContaBancaria, as: "conta", attributes: ["id", "banco_nome", "numero_conta"], required: false },
        { model: ContaBancaria, as: "contaDestino", attributes: ["id", "banco_nome", "numero_conta"], required: false },
        { model: Cliente, as: "cliente", attributes: ["id", "nome", "empresa"], required: false },
      ],
      order: [["data_movimento", "ASC"], ["createdAt", "ASC"]],
    });

    function fmtData(v) {
      if (!v) return "";
      const d = new Date(v + "T00:00:00");
      if (isNaN(d.getTime())) return String(v);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }

    function fmtHora(v) {
      if (!v) return "";
      const s = String(v).split(":").slice(0, 2).join(":");
      return s;
    }

    function fmtValor(v) {
      return Number(v || 0).toFixed(2).replace(".", ",");
    }

    const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

    // Começamos o saldo acumulado a partir dos saldos actuais e retrocedemos.
    // Para o extracto, simplesmente percorremos os movimentos e acumulamos.
    // Melhor abordagem: usar o saldo da conta antes do período (se pedido).
    let saldoAnterior = 0;
    if (conta_id && movimentos.length) {
      // Calcular o total dos movimentos confirma dos fora do período para a mesma conta.
      const ids = movimentos.map((m) => m.id);
      const fora = await TesourariaMovimento.sum("valor", {
        where: {
          organizacao_id: req.organizacao_id,
          deleted: false,
          conta_bancaria_id: conta_id,
          estado: "confirmado",
          id: { [Op.notIn]: ids },
        },
      });
      const saldoAtual = await ContaBancaria.sum("saldo_atual", {
        where: { id: conta_id, organizacao_id: req.organizacao_id },
      });
      saldoAnterior = Number(saldoAtual || 0) - Number(fora || 0);
    }

    // Exportação para Excel (.xlsx) com formatação — ?formato=xlsx
    if (String(req.query.formato || "").toLowerCase() === "xlsx") {
      const moeda = String(req.query.moeda || "KZ").toUpperCase();
      const buffer = await gerarExcel({ movimentos, conta_id, saldoAnterior, moeda });
      const dataExport = new Date().toISOString().split("T")[0];
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="extrato_tesouraria_${dataExport}.xlsx"`);
      return res.send(Buffer.from(buffer));
    }

    const estilos = { entrada: "Entrada", saida: "Saída", transferencia: "Transferência" };

    const linhas = [];
    // Cabecalho principal igual ao formato bancário/extracto.
    const cabecalho = [
      "Data",
      "Hora",
      "Tipo",
      "Categoria",
      "Descrição",
      "Valor Entrada",
      "Valor Saída",
      "Saldo Acumulado",
      "Método",
      "Conta Origem",
      "Conta Destino",
      "Estado",
      "Referência",
      "Cliente",
      "Observações",
    ].join(";");

    // Para extracto por conta, começamos com o saldo anterior.
    linhas.push(cabecalho);

    let saldo = saldoAnterior;
    for (const m of movimentos) {
      const tipoLabel = estilos[m.tipo] || m.tipo;
      const isEntrada = m.tipo === "entrada";
      const isTransferencia = m.tipo === "transferencia";
      // Transferência: não afecta o saldo global (sai da origem, entra no destino).
      // Saída: reduz o saldo. Entrada: aumenta o saldo.
      const delta = isEntrada ? Number(m.valor) : isTransferencia ? 0 : -Number(m.valor);
      saldo = Number((saldo + delta).toFixed(2));
      const origem = m.conta ? `${m.conta.banco_nome || ""}${m.conta.numero_conta ? ` (${m.conta.numero_conta})` : ""}`.trim() : "";
      const destino = m.contaDestino ? `${m.contaDestino.banco_nome || ""}${m.contaDestino.numero_conta ? ` (${m.contaDestino.numero_conta})` : ""}`.trim() : "";
      const cliente = m.cliente ? (m.cliente.empresa || m.cliente.nome || "") : "";
      linhas.push([
        fmtData(m.data_movimento),
        fmtHora(m.hora_movimento),
        tipoLabel,
        capitalizar(m.categoria || ""),
        String(m.descricao || "").replace(/"/g, '""'),
        isEntrada ? fmtValor(m.valor) : "",
        isEntrada ? "" : fmtValor(m.valor),
        fmtValor(saldo),
        capitalizar(m.metodo_pagamento || ""),
        origem,
        destino,
        capitalizar(m.estado || ""),
        String(m.referencia || "").replace(/"/g, '""'),
        String(cliente).replace(/"/g, '""'),
        String(m.observacoes || "").replace(/"/g, '""'),
      ].map((c) => `"${c}"`).join(";"));
    }

    if (movimentos.length === 0) {
      linhas.push(['"", "", "", "", "", "", "", "", "", "", "", "", "", "", ""'].join(";"));
    }

    // Resumo / rodapé.
    const totalEntradas = movimentos.filter((m) => m.tipo === "entrada").reduce((s, m) => s + Number(m.valor || 0), 0);
    const totalSaidas = movimentos.filter((m) => m.tipo === "saida" || m.tipo === "transferencia").reduce((s, m) => s + Number(m.valor || 0), 0);
    linhas.push("");
    linhas.push(`"TOTAL ENTRADAS";"${fmtValor(totalEntradas)}"`);
    linhas.push(`"TOTAL SAÍDAS";"${fmtValor(totalSaidas)}"`);
    linhas.push(`"SALDO DO PERÍODO";"${fmtValor(Number((totalEntradas - totalSaidas).toFixed(2)))}"`);
    linhas.push(`"EXPORTADO EM";"${new Date().toLocaleString("pt-AO")}"`);

    const csv = "\uFEFF" + linhas.join("\r\n");

    const dataExport = new Date().toISOString().split("T")[0];
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="extrato_tesouraria_${dataExport}.csv"`);
    return res.send(csv);
  } catch (e) {
    console.error("Erro ao exportar tesouraria:", e);
    return res.status(500).json({ erro: "Erro ao exportar dados" });
  }
};
