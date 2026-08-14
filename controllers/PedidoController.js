const { sequelize, Pedido, PedidoItem, Material, MovimentoEstoque, Sequencia, Cliente, ConfiguracaoEmail, Organizacao } = require("../models");
const { Transaction } = require("sequelize");
const { enviarEmail } = require("../services/email");

function formatarKz(v) {
  return `Kz ${Number(v || 0).toLocaleString("pt-AO", { maximumFractionDigits: 2 })}`;
}

function linhaHtml(p) {
  const itens = (p.pedido_items || [])
    .map(
      (i) =>
        `<tr>
          <td style="padding:6px 8px;border:1px solid #ddd;">${i.material_codigo || "—"}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;">${i.material_nome || "—"}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:center;">${i.unidade || "un"}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${Number(i.quantidade) || 0}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${formatarKz(i.preco_unit)}</td>
          <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;">${formatarKz(i.total)}</td>
        </tr>`
    )
    .join("");
  const total = (p.pedido_items || []).reduce((s, i) => s + (Number(i.total) || 0), 0);
  const data = p.data_pedido ? new Date(p.data_pedido).toLocaleDateString("pt-PT") : "—";
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#212529;">
      <h2 style="color:#0f766e;">Pedido de Compra ${p.numero}</h2>
      <p>Fornecedor: <strong>${p.fornecedor_nome || "—"}</strong></p>
      <p>Data do pedido: ${data}${p.solicitado_por ? ` • Solicitado por: ${p.solicitado_por}` : ""}</p>
      <table style="border-collapse:collapse;width:100%;font-size:13px;margin-top:10px;">
        <thead>
          <tr style="background:#0f766e;color:#fff;">
            <th style="padding:6px 8px;border:1px solid #ddd;">Código</th>
            <th style="padding:6px 8px;border:1px solid #ddd;">Material</th>
            <th style="padding:6px 8px;border:1px solid #ddd;">Unid.</th>
            <th style="padding:6px 8px;border:1px solid #ddd;">Qtd</th>
            <th style="padding:6px 8px;border:1px solid #ddd;">Preço Unit.</th>
            <th style="padding:6px 8px;border:1px solid #ddd;">Total</th>
          </tr>
        </thead>
        <tbody>${itens}</tbody>
        <tfoot>
          <tr>
            <td colspan="5" style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;">Total</td>
            <td style="padding:6px 8px;border:1px solid #ddd;text-align:right;font-weight:bold;">${formatarKz(total)}</td>
          </tr>
        </tfoot>
      </table>
      ${p.observacoes ? `<p style="margin-top:12px;">Observações: <em>${p.observacoes}</em></p>` : ""}
      <p style="margin-top:20px;color:#6c757d;font-size:12px;">Documento gerado pelo SIGRAF — anexo em PDF.</p>
    </div>`;
}

async function resolverEmailFornecedor(pedido, organizacao_id) {
  if (pedido.fornecedor_id) {
    const cli = await Cliente.findOne({
      where: { id: pedido.fornecedor_id, organizacao_id },
      raw: true,
    });
    if (cli && cli.email) return cli.email;
  }
  if (pedido.fornecedor_nome) {
    const cli = await Cliente.findOne({
      where: {
        organizacao_id,
        tipo: "fornecedor",
        nome: String(pedido.fornecedor_nome).trim(),
      },
      raw: true,
    });
    if (cli && cli.email) return cli.email;
  }
  return null;
}

const ESTADOS = ["enviado", "recebido", "cancelado"];

function parseNum(v) {
  if (v === undefined || v === null || v === "") return 0;
  const s = String(v).replace(/[^\d,.\-]/g, "").replace(",", ".");
  return parseFloat(s) || 0;
}

function normalizarItens(itens, materiaisPorId) {
  return (itens || [])
    .map((i) => {
      const mat = materiaisPorId[String(i.material_id)] || {};
      const quantidade = parseNum(i.quantidade);
      const precoUnit = parseNum(i.preco_unit != null ? i.preco_unit : i.preco);
      return {
        material_id: mat.id || i.material_id || null,
        material_codigo: mat.codigo || i.material_codigo || "",
        material_nome: mat.nome || String(i.material_nome || "").trim(),
        unidade: mat.unidade || i.unidade || "un",
        quantidade,
        preco_unit: precoUnit,
        total: Number((quantidade * precoUnit).toFixed(2)),
      };
    })
    .filter((i) => i.material_nome && i.quantidade > 0);
}

function serializar(p) {
  const itens = (p.pedido_items || []).map((i) => ({
    id: i.id,
    material_id: i.material_id,
    codigo: i.material_codigo,
    nome: i.material_nome,
    unidade: i.unidade,
    quantidade: Number(i.quantidade) || 0,
    preco_unit: Number(i.preco_unit) || 0,
    total: Number(i.total) || 0,
    quantidade_recebida: Number(i.quantidade_recebida) || 0,
  }));
  return {
    id: p.id,
    numero: p.numero,
    fornecedor_id: p.fornecedor_id,
    fornecedor_nome: p.fornecedor_nome,
    email: p.email || "",
    estado: p.estado,
    observacoes: p.observacoes,
    solicitado_por: p.solicitado_por,
    data_pedido: p.data_pedido || p.createdAt,
    data_recebimento: p.data_recebimento,
    total: Number(p.total) || 0,
    itens,
    pendente: itens.some((i) => i.quantidade_recebida < i.quantidade),
  };
}

async function proximoNumero(organizacao_id) {
  return sequelize.transaction(async (t) => {
    const lock = sequelize.getDialect() === "mysql" ? Transaction.LOCK.UPDATE : undefined;
    let seq = await Sequencia.findOne({ where: { organizacao_id }, transaction: t, lock });
    if (!seq) {
      seq = await Sequencia.create({ organizacao_id, numero: 1 }, { transaction: t });
      return "PED-0001";
    }
    const novo = Number(seq.numero || 0) + 1;
    await seq.update({ numero: novo }, { transaction: t });
    return `PED-${String(novo).padStart(4, "0")}`;
  });
}

async function carregarMateriaisPorId(ids) {
  const unicos = [...new Set(ids.filter(Boolean).map(String))];
  if (!unicos.length) return {};
  const materiais = await Material.findAll({ where: { id: unicos } });
  const mapa = {};
  materiais.forEach((m) => {
    mapa[String(m.id)] = m;
  });
  return mapa;
}

exports.listar = async (req, res) => {
  try {
    const { estado } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (estado) where.estado = estado;
    const pedidos = await Pedido.findAll({
      where,
      include: [{ model: PedidoItem }],
      order: [["createdAt", "DESC"]],
    });
    return res.json(pedidos.map(serializar));
  } catch (e) {
    console.error("Erro ao listar pedidos:", e);
    return res.status(500).json({ erro: "Erro ao listar pedidos" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    return res.json(serializar(pedido));
  } catch (e) {
    console.error("Erro ao buscar pedido:", e);
    return res.status(500).json({ erro: "Erro ao buscar pedido" });
  }
};

exports.criar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { fornecedor_id, fornecedor_nome, email, itens, observacoes, solicitado_por, data_pedido } = req.body;
    if (!fornecedor_nome || !String(fornecedor_nome).trim()) {
      return res.status(422).json({ erro: "Informe o fornecedor do pedido" });
    }
    const materiaisPorId = await carregarMateriaisPorId((itens || []).map((i) => i.material_id));
    const normalizados = normalizarItens(itens, materiaisPorId);
    if (!normalizados.length) {
      return res.status(422).json({ erro: "Adicione pelo menos um material com quantidade" });
    }
    const numero = await proximoNumero(req.organizacao_id);
    const total = Number(normalizados.reduce((s, i) => s + i.total, 0).toFixed(2));
    const pedido = await Pedido.create(
      {
        numero,
        organizacao_id: req.organizacao_id,
        fornecedor_id: fornecedor_id || null,
        fornecedor_nome: String(fornecedor_nome).trim(),
        email: String(email || "").trim() || null,
        estado: "enviado",
        observacoes: observacoes || null,
        solicitado_por: solicitado_por || null,
        data_pedido: data_pedido || new Date(),
        total,
        usuario_id: req.usuario.id,
      },
      { transaction: t }
    );
    await PedidoItem.bulkCreate(
      normalizados.map((i) => ({ ...i, pedido_id: pedido.id })),
      { transaction: t }
    );
    await t.commit();
    const completo = await Pedido.findByPk(pedido.id, { include: [{ model: PedidoItem }] });
    return res.status(201).json(serializar(completo));
  } catch (e) {
    await t.rollback();
    console.error("Erro ao criar pedido:", e);
    return res.status(500).json({ erro: "Erro ao criar pedido" });
  }
};

exports.enviarEmail = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });

    const para = pedido.email || (await resolverEmailFornecedor(pedido, req.organizacao_id));
    if (!para) {
      return res.status(422).json({ erro: "Fornecedor sem email registado — preencha o email no cadastro do fornecedor" });
    }

    const [config, org] = await Promise.all([
      ConfiguracaoEmail.findOne({ where: { organizacao_id: req.organizacao_id } }),
      Organizacao.findByPk(req.organizacao_id),
    ]);

    const { anexo_base64, anexo_nome } = req.body || {};
    const nomeAnexo = anexo_nome || `Pedido_${(pedido.numero || "").replace(/[^\w-]+/g, "_")}.pdf`;

    const resultado = await enviarEmail({
      config,
      para,
      assunto: `Pedido de Compra ${pedido.numero} — ${pedido.fornecedor_nome || "Fornecedor"}`,
      html: linhaHtml(pedido),
      anexoBase64: anexo_base64,
      anexoNome: nomeAnexo,
    });

    if (!resultado.ok) {
      return res.status(400).json({ erro: resultado.erro });
    }
    return res.json({ mensagem: `Pedido ${pedido.numero} enviado por email para ${para}` });
  } catch (e) {
    console.error("Erro ao enviar email do pedido:", e);
    return res.status(500).json({ erro: "Erro ao enviar o email do pedido. Verifique as configurações de SMTP." });
  }
};

exports.cancelar = async (req, res) => {
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem }],
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.estado === "recebido") {
      return res.status(422).json({ erro: "Não é possível cancelar um pedido já recebido" });
    }
    await pedido.update({ estado: "cancelado" });
    return res.json(serializar(pedido));
  } catch (e) {
    console.error("Erro ao cancelar pedido:", e);
    return res.status(500).json({ erro: "Erro ao cancelar pedido" });
  }
};

exports.receber = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const pedido = await Pedido.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [{ model: PedidoItem }],
      transaction: t,
    });
    if (!pedido) return res.status(404).json({ erro: "Pedido não encontrado" });
    if (pedido.estado === "cancelado") {
      return res.status(422).json({ erro: "Não é possível receber um pedido cancelado" });
    }
    const recebimentos = Array.isArray(req.body?.itens) ? req.body.itens : [];
    if (!recebimentos.length) {
      return res.status(422).json({ erro: "Informe os itens a receber" });
    }
    const itens = pedido.pedido_items || [];
    let recebeuAlgo = false;
    let completo = true;
    for (const r of recebimentos) {
      const item = itens.find((i) => i.id === Number(r.id));
      if (!item) continue;
      const novo = parseNum(r.quantidade);
      if (!novo || novo <= 0) continue;
      const jaRecebido = parseFloat(item.quantidade_recebida) || 0;
      const limite = parseFloat(item.quantidade) || 0;
      const aceite = Math.min(novo, Math.max(0, limite - jaRecebido));
      if (aceite <= 0) continue;
      const material = await Material.findOne({
        where: { id: item.material_id, organizacao_id: req.organizacao_id },
        transaction: t,
      });
      if (material) {
        await material.update({ quantidade: parseFloat(material.quantidade) + aceite }, { transaction: t });
      }
      await MovimentoEstoque.create(
        {
          organizacao_id: req.organizacao_id,
          material_id: item.material_id,
          tipo: "entrada",
          quantidade: aceite,
          referencia_tipo: "pedido",
          referencia_id: pedido.id,
          lote: r.lote || null,
          motivo: `Recebimento do pedido ${pedido.numero}`,
          observacoes: null,
          fornecedor_nome: pedido.fornecedor_nome,
          solicitado_por: pedido.solicitado_por,
          usuario_id: req.usuario.id,
        },
        { transaction: t }
      );
      await item.update({ quantidade_recebida: Number((jaRecebido + aceite).toFixed(2)) }, { transaction: t });
      recebeuAlgo = true;
    }
    if (!recebeuAlgo) {
      return res.status(422).json({ erro: "Nenhuma quantidade válida para receber" });
    }
    completo = itens.every((i) => (parseFloat(i.quantidade_recebida) || 0) >= (parseFloat(i.quantidade) || 0));
    if (completo) {
      await pedido.update({ estado: "recebido", data_recebimento: new Date() }, { transaction: t });
    }
    await t.commit();
    const atualizado = await Pedido.findByPk(pedido.id, { include: [{ model: PedidoItem }] });
    return res.json(serializar(atualizado));
  } catch (e) {
    await t.rollback();
    console.error("Erro ao receber pedido:", e);
    return res.status(500).json({ erro: "Erro ao receber pedido" });
  }
};
