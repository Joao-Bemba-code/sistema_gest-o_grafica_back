const { Divida, Cliente, Faturacao, ContaBancaria, TesourariaMovimento, Usuario } = require("../models");
const { Op } = require("sequelize");

const ESTADOS = ["pendente", "parcial", "paga", "vencida", "cancelada"];
const METODOS = ["dinheiro", "transferencia", "deposito", "ordem_saida", "multicaixa", "referencia", "cheque", "tpa"];

const INCLUDES = [
  { model: Cliente, as: "cliente", attributes: ["id", "nome", "empresa", "telefone"], required: false },
  { model: Faturacao, as: "fatura", attributes: ["id", "numero", "total"], required: false },
  { model: ContaBancaria, as: "conta", attributes: ["id", "banco_nome", "numero_conta", "tipo_conta"], required: false },
  { model: Usuario, as: "usuario", attributes: ["id", "nome"], required: false },
];

function hojeISO() {
  return dataLocal(new Date());
}

// `toISOString()` converte para UTC e em Angola (UTC+1) uma data à meia-noite
// local recua um dia. As datas de vencimento têm de ser formatadas pelos
// componentes locais, senão as parcelas vencem no dia anterior ao pedido.
function dataLocal(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Taxa simples (1/mês) usada só para sugerir o plano de parcelas quando o
// utilizador indica "N parcelas" em vez de escrever cada uma.
function sugerirParcelas(valorTotal, numero, primeiraVencimento, intervaloDias = 30) {
  const n = Math.max(1, Math.floor(Number(numero) || 1));
  const total = Number(valorTotal || 0);
  const centavos = Math.round(total * 100);
  const base = Math.floor(centavos / n);
  const resto = centavos - base * n;
  const inicio = primeiraVencimento ? new Date(`${primeiraVencimento}T00:00:00`) : new Date();
  const parcelas = [];
  for (let i = 0; i < n; i++) {
    const v = new Date(inicio.getTime());
    v.setDate(v.getDate() + i * intervaloDias);
    parcelas.push({
      n: i + 1,
      valor: Number(((base + (i < resto ? 1 : 0)) / 100).toFixed(2)),
      vencimento: dataLocal(v),
      data_pagamento: null,
      valor_pago: 0,
      conta_bancaria_id: null,
      movimento_id: null,
    });
  }
  return parcelas;
}

// Normaliza o array de parcelas recebido do frontend. Aceita tanto o array
// completo como o atalho { numero, intervalo_dias, vencimento }.
function normalizarParcelas(body, valorTotal) {
  if (Array.isArray(body.parcelas)) {
    return body.parcelas
      .map((p, i) => ({
        n: Number(p.n) || i + 1,
        valor: Number(p.valor) || 0,
        vencimento: p.vencimento || null,
        data_pagamento: p.data_pagamento || null,
        valor_pago: Number(p.valor_pago) || 0,
        conta_bancaria_id: p.conta_bancaria_id || null,
        movimento_id: p.movimento_id || null,
      }))
      .filter((p) => p.valor > 0);
  }
  if (body.parcelas && Number(body.parcelas.numero) > 0) {
    return sugerirParcelas(valorTotal, body.parcelas.numero, body.parcelas.vencimento, body.parcelas.intervalo_dias);
  }
  return [];
}

// Estado deduzido do que já foi pago e da data de vencimento.
function calcularEstado(valor, valorPago, parcelas, vencimento, estadoAtual) {
  if (estadoAtual === "cancelada") return "cancelada";
  const total = Number(valor || 0);
  const pago = Number(valorPago || 0);
  if (pago >= total - 0.005 && total > 0) return "paga";
  if (pago > 0) return "parcial";
  // Uma dívida com parcelas não fica "vencida" por causa de uma parcela antiga:
  // o que está em atraso é a parcela, não a dívida inteira.
  if (vencimento && vencimento < hojeISO()) return "vencida";
  return "pendente";
}

function saldoDe(divida) {
  return Number(Number(divida.valor || 0) - Number(divida.valor_pago || 0));
}

exports.listar = async (req, res) => {
  try {
    const { estado, cliente_id, categoria, data_inicio, data_fim, apenas_saldo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    if (cliente_id) where.cliente_id = cliente_id;
    if (categoria) where.categoria = categoria;
    if (data_inicio || data_fim) {
      where.data_vencimento = {};
      if (data_inicio) where.data_vencimento[Op.gte] = data_inicio;
      if (data_fim) where.data_vencimento[Op.lte] = data_fim;
    }

    let divide = Divida.findAll({
      where,
      include: INCLUDES,
      order: [["data_vencimento", "ASC"], ["data_emissao", "DESC"], ["createdAt", "DESC"]],
    });

    if (apenas_saldo !== undefined && String(apenas_saldo) === "true") {
      divide = divide.then((lista) => lista.filter((d) => saldoDe(d) > 0.005));
    }

    const dividas = await divide;
    return res.json(dividas);
  } catch (e) {
    console.error("Erro ao listar dívidas:", e);
    return res.status(500).json({ erro: "Erro ao listar dívidas" });
  }
};

exports.buscar = async (req, res) => {
  try {
    const divida = await Divida.findByPk(req.params.id, {
      where: { organizacao_id: req.organizacao_id },
      include: INCLUDES,
    });
    if (!divida) return res.status(404).json({ erro: "Dívida não encontrada" });
    return res.json(divida);
  } catch (e) {
    console.error("Erro ao buscar dívida:", e);
    return res.status(500).json({ erro: "Erro ao buscar dívida" });
  }
};

exports.criar = async (req, res) => {
  try {
    const {
      cliente_id, fatura_id, descricao, categoria, valor, data_emissao,
      data_vencimento, conta_bancaria_id, metodo_pagamento, observacoes,
    } = req.body;

    if (!descricao || !String(descricao).trim()) {
      return res.status(400).json({ erro: "Descrição é obrigatória" });
    }
    const valorNum = Number(valor);
    if (!valorNum || valorNum <= 0) {
      return res.status(400).json({ erro: "O valor deve ser maior que zero" });
    }

    const parcelas = normalizarParcelas(req.body, valorNum);
    // Se as parcelas não cobrem o valor total, a diferença fica como dívida
    // de valor único para não se perder dinheiro no plano de pagamentos.
    const somaParcelas = parcelas.reduce((s, p) => s + p.valor, 0);
    if (parcelas.length && Math.abs(somaParcelas - valorNum) > 0.005) {
      return res.status(400).json({ erro: "A soma das parcelas não é igual ao valor da dívida" });
    }

    const valorPagoInicial = parcelas.reduce((s, p) => s + (p.valor_pago || 0), 0);

    const divida = await Divida.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      cliente_id: cliente_id || null,
      fatura_id: fatura_id || null,
      descricao: String(descricao).trim(),
      categoria: String(categoria || "adiantamento").trim().slice(0, 100),
      valor: valorNum,
      valor_pago: valorPagoInicial,
      data_emissao: data_emissao || hojeISO(),
      data_vencimento: data_vencimento || null,
      parcelas,
      conta_bancaria_id: conta_bancaria_id || null,
      metodo_pagamento: METODOS.includes(metodo_pagamento) ? metodo_pagamento : null,
      observacoes: observacoes || null,
      // Uma dívida registada com vencimento já passado nasce "vencida", senão
      // só apareceria como tal depois de alguém a editar.
      estado: calcularEstado(valorNum, valorPagoInicial, parcelas, data_vencimento || null, null),
    });

    await divida.reload({ include: INCLUDES });
    return res.status(201).json(divida);
  } catch (e) {
    console.error("Erro ao criar dívida:", e?.message || e);
    if (e?.original) console.error("DB Error:", e.original.code, e.original.sqlMessage);
    return res.status(500).json({ erro: "Erro ao criar dívida" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const divida = await Divida.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!divida) return res.status(404).json({ erro: "Dívida não encontrada" });

    // Uma dívida já liquidada tem valor_pago = valor: mexer no valor ou nas
    // parcelas criaria um saldo negativo impossível de pagar.
    if (saldoDe(divida) <= 0.005 && divida.estado === "paga") {
      if (req.body.valor !== undefined && Number(req.body.valor) !== Number(divida.valor)) {
        return res.status(400).json({ erro: "Não pode alterar o valor de uma dívida já paga" });
      }
      if (req.body.parcelas !== undefined) {
        return res.status(400).json({ erro: "Não pode alterar as parcelas de uma dívida já paga" });
      }
    }

    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.usuario_id;
    delete dados.parcelas_numero;
    delete dados.parcelas_intervalo_dias;

    if (dados.valor !== undefined) {
      const v = Number(dados.valor);
      if (!v || v <= 0) return res.status(400).json({ erro: "O valor deve ser maior que zero" });
      if (v < Number(divida.valor_pago || 0) - 0.005) {
        return res.status(400).json({ erro: "O valor não pode ser menor que o que já foi pago" });
      }
      dados.valor = v;
    }
    if (dados.descricao !== undefined) {
      if (!String(dados.descricao).trim()) return res.status(400).json({ erro: "Descrição é obrigatória" });
      dados.descricao = String(dados.descricao).trim();
    }
    if (dados.categoria !== undefined) {
      dados.categoria = String(dados.categoria || "adiantamento").trim().slice(0, 100);
    }
    if (dados.metodo_pagamento !== undefined && !METODOS.includes(dados.metodo_pagamento)) {
      dados.metodo_pagamento = null;
    }
    if (dados.estado !== undefined && !ESTADOS.includes(dados.estado)) {
      return res.status(400).json({ erro: "Estado inválido" });
    }
    if (dados.parcelas !== undefined) {
      const novas = normalizarParcelas(req.body, Number(dados.valor ?? divida.valor));
      const soma = novas.reduce((s, p) => s + p.valor, 0);
      const total = Number(dados.valor ?? divida.valor);
      if (novas.length && Math.abs(soma - total) > 0.005) {
        return res.status(400).json({ erro: "A soma das parcelas não é igual ao valor da dívida" });
      }
      dados.parcelas = novas;
    }

    await divida.update(dados);

    const pago = Number(divida.valor_pago || 0);
    const estado = calcularEstado(divida.valor, pago, divida.parcelas, divida.data_vencimento, divida.estado);
    if (estado !== divida.estado) await divida.update({ estado });

    await divida.reload({ include: INCLUDES });
    return res.json(divida);
  } catch (e) {
    console.error("Erro ao atualizar dívida:", e);
    return res.status(500).json({ erro: "Erro ao atualizar dívida" });
  }
};

exports.remover = async (req, res) => {
  try {
    const divida = await Divida.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!divida) return res.status(404).json({ erro: "Dívida não encontrada" });
    // Cancelar é diferente de apagar: só uma dívida sem qualquer pagamento
    // recebido pode ser removida de vez, para não desfazer a tesouraria.
    if (Number(divida.valor_pago || 0) > 0) {
      await divida.update({ estado: "cancelada" });
      return res.json({ mensagem: "Dívida cancelada (já tinha pagamentos registados)", estado: "cancelada" });
    }
    await divida.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Dívida removida com sucesso" });
  } catch (e) {
    console.error("Erro ao remover dívida:", e);
    return res.status(500).json({ erro: "Erro ao remover dívida" });
  }
};

// Baixa (total ou parcial) de uma dívida ou de uma parcela. Cria o movimento
// de tesouraria correspondente e move o saldo da conta, para o dinheiro
// registado uma única vez e num único sítio.
exports.pagar = async (req, res) => {
  try {
    const divida = await Divida.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!divida) return res.status(404).json({ erro: "Dívida não encontrada" });
    if (divida.estado === "cancelada") {
      return res.status(400).json({ erro: "Não é possível pagar uma dívida cancelada" });
    }

    const saldo = saldoDe(divida);
    const parcelaN = req.body.parcela_n ? Number(req.body.parcela_n) : null;
    const parcelas = Array.isArray(divida.parcelas) ? divida.parcelas.map((p) => ({ ...p })) : [];

    let parcela = null;
    if (parcelaN !== null) {
      parcela = parcelas.find((p) => Number(p.n) === parcelaN);
      if (!parcela) return res.status(404).json({ erro: "Parcela não encontrada" });
    }

    const alvo = parcela ? Number(parcela.valor) - Number(parcela.valor_pago || 0) : saldo;
    if (alvo <= 0.005) return res.status(400).json({ erro: "Essa parcela já está totalmente paga" });

    const valorNum = Number(req.body.valor ?? alvo);
    if (!valorNum || valorNum <= 0) return res.status(400).json({ erro: "O valor do pagamento deve ser maior que zero" });
    if (valorNum > alvo + 0.005) {
      return res.status(400).json({ erro: `O pagamento não pode ultrapassar ${alvo.toFixed(2)}` });
    }

    const contaId = req.body.conta_bancaria_id || divida.conta_bancaria_id || parcela?.conta_bancaria_id || null;
    const metodo = METODOS.includes(req.body.metodo_pagamento) ? req.body.metodo_pagamento : divida.metodo_pagamento || "transferencia";
    const dataPagamento = req.body.data_pagamento || hojeISO();
    const nParcela = parcelaN === null ? null : parcelaN;

    const movimento = await TesourariaMovimento.create({
      organizacao_id: req.organizacao_id,
      usuario_id: req.usuario.id,
      tipo: "entrada",
      categoria: "venda",
      descricao: `Baixa de dívida: ${divida.descricao}${nParcela ? ` (parcela ${nParcela})` : ""}`,
      valor: valorNum,
      data_movimento: dataPagamento,
      hora_movimento: new Date().toTimeString().split(" ")[0],
      referencia: String(divida.id),
      referencia_tipo: "outro",
      cliente_id: divida.cliente_id || null,
      conta_bancaria_id: contaId,
      metodo_pagamento: metodo,
      estado: "confirmado",
      observacoes: `Baixa da dívida #${divida.id}${nParcela ? ` — parcela ${nParcela}` : ""}${req.body.observacoes ? ` — ${req.body.observacoes}` : ""}`,
    });

    if (contaId) {
      const conta = await ContaBancaria.findOne({
        where: { id: contaId, organizacao_id: req.organizacao_id },
      });
      if (conta) {
        const novoSaldo = Number(conta.saldo_atual || 0) + valorNum;
        await conta.update({ saldo_atual: Number(novoSaldo.toFixed(2)) });
      }
    }

    if (parcela) {
      parcela.valor_pago = Number(Number(parcela.valor_pago || 0) + valorNum);
      parcela.data_pagamento = dataPagamento;
      parcela.conta_bancaria_id = contaId;
      parcela.movimento_id = movimento.id;
    }

    const valorPago = Number(Number(divida.valor_pago || 0) + valorNum);
    const vencimento = parcela ? parcela.vencimento : divida.data_vencimento;
    const estado = calcularEstado(divida.valor, valorPago, parcelas, vencimento, divida.estado);

    await divida.update({ valor_pago: valorPago, parcelas, estado, conta_bancaria_id: contaId || null });

    await divida.reload({ include: INCLUDES });
    return res.json({ divida, movimento, saldo: Number(saldoDe(divida).toFixed(2)) });
  } catch (e) {
    console.error("Erro ao pagar dívida:", e?.message || e);
    if (e?.original) console.error("DB Error:", e.original.code, e.original.sqlMessage);
    return res.status(500).json({ erro: "Erro ao registar o pagamento da dívida" });
  }
};

// Totais em dívida, faixas de atraso (aging) e ranking por cliente.
exports.resumo = async (req, res) => {
  try {
    const org = req.organizacao_id;
    const hoje = hojeISO();

    const dividas = await Divida.findAll({
      where: { organizacao_id: org, estado: { [Op.ne]: "cancelada" } },
      include: [{ model: Cliente, as: "cliente", attributes: ["id", "nome", "empresa"], required: false }],
      order: [["data_vencimento", "ASC"]],
    });

    const faixas = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0, sem_vencimento: 0 };
    const porCliente = new Map();
    let total = 0;
    let vencido = 0;
    let vencemHoje = 0;
    let proximos7 = 0;
    let pagas = 0;

    const limite7 = new Date();
    limite7.setDate(limite7.getDate() + 7);
    const limite7ISO = limite7.toISOString().split("T")[0];

    for (const d of dividas) {
      const s = saldoDe(d);
      const pago = Number(d.valor_pago || 0);
      if (pago > 0 && s <= 0.005) pagas += 1;

      total += s;
      if (d.cliente) {
        // Agrupar pelo NOME do cliente (e não pelo id): o mesmo cliente
        // registado duas vezes não pode aparecer duas vezes no ranking.
        const nomeCliente = (d.cliente.nome || "").trim() || (d.cliente.empresa || "").trim() || "Sem cliente";
        const chave = `n:${nomeCliente.toLowerCase()}`;
        const actual = porCliente.get(chave) || {
          cliente_id: d.cliente.id,
          nome: d.cliente.nome || d.cliente.empresa || "Sem cliente",
          saldo: 0,
          vencida: 0,
          qtd: 0,
        };
        actual.saldo += s;
        actual.qtd += 1;
        if (d.data_vencimento && d.data_vencimento < hoje) actual.vencida += s;
        porCliente.set(chave, actual);
      }

      if (s <= 0.005) continue;
      if (!d.data_vencimento) {
        faixas.sem_vencimento += s;
        continue;
      }
      if (d.data_vencimento <= hoje) {
        vencido += s;
        const dias = Math.floor((Date.parse(`${hoje}T00:00:00`) - Date.parse(`${d.data_vencimento}T00:00:00`)) / 86400000);
        if (dias <= 30) faixas["0-30"] += s;
        else if (dias <= 60) faixas["31-60"] += s;
        else if (dias <= 90) faixas["61-90"] += s;
        else faixas["90+"] += s;
      }
      if (d.data_vencimento === hoje) vencemHoje += s;
      if (d.data_vencimento >= hoje && d.data_vencimento <= limite7ISO) proximos7 += s;
    }

    return res.json({
      total: Number(total.toFixed(2)),
      vencido: Number(vencido.toFixed(2)),
      vencemHoje: Number(vencemHoje.toFixed(2)),
      proximos7: Number(proximos7.toFixed(2)),
      qtdDividas: dividas.filter((d) => saldoDe(d) > 0.005).length,
      qtdPagas: pagas,
      faixas: Object.fromEntries(Object.entries(faixas).map(([k, v]) => [k, Number(v.toFixed(2))])),
      topDevedores: [...porCliente.values()]
        .filter((c) => c.saldo > 0.005)
        .sort((a, b) => b.saldo - a.saldo)
        .slice(0, 10)
        .map((c) => ({ ...c, saldo: Number(c.saldo.toFixed(2)), vencida: Number(c.vencida.toFixed(2)) })),
    });
  } catch (e) {
    console.error("Erro ao gerar resumo de dívidas:", e);
    return res.status(500).json({ erro: "Erro ao gerar resumo de dívidas" });
  }
};