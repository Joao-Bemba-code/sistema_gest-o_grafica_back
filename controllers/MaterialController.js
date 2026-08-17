const { sequelize, Material, MovimentoEstoque, Categoria, ReservaEstoque, OrdemProducao } = require("../models");
const estoqueService = require("../services/estoque");

const CAMPOS_NUMERICOS = [
  "gramagem",
  "largura",
  "altura",
  "percentual_quebra",
  "quantidade",
  "estoque_reservado",
  "estoque_min",
  "estoque_max",
  "ponto_ressuprimento",
  "custo_unit",
  "margem",
];

function normalizarDados(body) {
  const dados = { ...body };
  delete dados.id;
  delete dados.organizacao_id;
  delete dados.usuario_id;
  delete dados.Categoria;
  delete dados.reserva_estoques;
  delete dados.movimento_estoques;
  if (dados.categoria_id === "" || dados.categoria_id === undefined) delete dados.categoria_id;
  if (dados.categoria) {
    dados.categoria_id = dados.categoria_id || dados.categoria;
    delete dados.categoria;
  }
  CAMPOS_NUMERICOS.forEach((campo) => {
    if (dados[campo] !== undefined) dados[campo] = parseFloat(dados[campo]) || 0;
  });
  if (dados.controla_lote !== undefined) dados.controla_lote = !!dados.controla_lote;
  if (dados.ativo !== undefined) dados.ativo = !!dados.ativo;
  return dados;
}

function serializar(material) {
  const obj = material.toJSON ? material.toJSON() : material;
  const quantidade = parseFloat(obj.quantidade) || 0;
  const reservado = parseFloat(obj.estoque_reservado) || 0;
  const disponivel = quantidade - reservado;
  const ponto = parseFloat(obj.ponto_ressuprimento || obj.estoque_min) || 0;
  let status = "ok";
  if (disponivel <= 0) status = "esgotado";
  else if (disponivel <= ponto) status = "repor";
  const preco_venda = (parseFloat(obj.custo_unit) || 0) * (1 + (parseFloat(obj.margem) || 0) / 100);
  return {
    ...obj,
    quantidade: Number(Number(quantidade).toFixed(2)),
    estoque_reservado: Number(Number(reservado).toFixed(2)),
    estoque_disponivel: Number(Number(disponivel).toFixed(2)),
    status,
    preco_venda: Number(Number(preco_venda).toFixed(2)),
  };
}

exports.listar = async (req, res) => {
  try {
    const materiais = await Material.findAll({
      where: { organizacao_id: req.organizacao_id },
      include: [{ model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "grupo", "tipo", "campos_especificacao"] }],
    });
    return res.json(materiais.map(serializar));
  } catch (e) {
    console.error("Erro ao listar materiais:", e);
    return res.status(500).json({ erro: "Erro ao listar materiais" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const material = await Material.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      include: [
        { model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "grupo", "tipo", "campos_especificacao"] },
        { model: MovimentoEstoque, required: false, limit: 50, order: [["createdAt", "DESC"]] },
        { model: ReservaEstoque, required: false, limit: 50, order: [["createdAt", "DESC"]] },
      ],
    });
    if (!material) return res.status(404).json({ erro: "Material não encontrado" });
    return res.json(serializar(material));
  } catch (e) {
    console.error("Erro ao buscar material:", e);
    return res.status(500).json({ erro: "Erro ao buscar material" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = normalizarDados(req.body);
    const material = await Material.create({ ...dados, organizacao_id: req.organizacao_id });
    return res.status(201).json(serializar(material));
  } catch (e) {
    console.error("Erro ao criar material:", e);
    return res.status(500).json({ erro: "Erro ao criar material" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const material = await Material.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!material) return res.status(404).json({ erro: "Material não encontrado" });
    const dados = normalizarDados(req.body);
    await material.update(dados);
    return res.json(serializar(material));
  } catch (e) {
    console.error("Erro ao atualizar material:", e);
    return res.status(500).json({ erro: "Erro ao atualizar material" });
  }
};

exports.remover = async (req, res) => {
  try {
    const material = await Material.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!material) return res.status(404).json({ erro: "Material não encontrado" });
    await MovimentoEstoque.update({ deleted: 1, deletedAt: new Date() }, { where: { material_id: material.id } });
    await material.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Material removido com sucesso" });
  } catch (e) {
    console.error("Erro ao remover material:", e);
    return res.status(500).json({ erro: "Erro ao remover material" });
  }
};

exports.movimentar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { material_id, tipo, quantidade, motivo, lote, data_fabricacao, validade, referencia_tipo, referencia_id, observacoes, cliente_nome, fornecedor_nome, solicitado_por, permitido_por } = req.body;
    if (!material_id || !tipo || !quantidade) {
      return res.status(422).json({ erro: "Material, tipo e quantidade são obrigatórios" });
    }
    if (tipo === "saida" && !cliente_nome) {
      return res.status(422).json({ erro: "Informe o cliente para registar a saída" });
    }
    if (tipo === "entrada" && !fornecedor_nome) {
      return res.status(422).json({ erro: "Informe o fornecedor para registar a entrada" });
    }
    const material = await Material.findOne({
      where: { id: material_id, organizacao_id: req.organizacao_id },
      transaction: t,
    });
    if (!material) return res.status(404).json({ erro: "Material não encontrado" });
    const qtd = parseFloat(quantidade);
    if (qtd <= 0) return res.status(422).json({ erro: "Quantidade deve ser maior que zero" });
    if (tipo === "entrada") {
      await material.update({ quantidade: parseFloat(material.quantidade) + qtd }, { transaction: t });
    } else {
      const disponivel = parseFloat(material.quantidade) - parseFloat(material.estoque_reservado);
      if (disponivel < qtd) {
        return res.status(422).json({ erro: `Quantidade insuficiente em estoque (disponível ${disponivel} ${material.unidade})` });
      }
      await material.update({ quantidade: parseFloat(material.quantidade) - qtd }, { transaction: t });
    }
    const movimento = await MovimentoEstoque.create(
      {
        organizacao_id: req.organizacao_id,
        material_id,
        tipo,
        quantidade: qtd,
        referencia_tipo: referencia_tipo || "manual",
        referencia_id: referencia_id || null,
        lote: lote || null,
        data_fabricacao: data_fabricacao || null,
        validade: validade || null,
        motivo: motivo || "",
        observacoes: observacoes || null,
        cliente_nome: cliente_nome || null,
        fornecedor_nome: fornecedor_nome || null,
        solicitado_por: solicitado_por || null,
        permitido_por: permitido_por || null,
        usuario_id: req.usuario.id,
      },
      { transaction: t }
    );
    await t.commit();
    return res.status(201).json({ material: serializar(material), movimento });
  } catch (e) {
    await t.rollback();
    console.error("Erro ao movimentar estoque:", e);
    return res.status(500).json({ erro: "Erro ao movimentar estoque" });
  }
};

exports.reservar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ordem_producao_id, itens } = req.body;
    if (!ordem_producao_id || !Array.isArray(itens) || !itens.length) {
      return res.status(422).json({ erro: "ordem_producao_id e itens são obrigatórios" });
    }
    const reservas = await estoqueService.reservarMateriais({
      organizacaoId: req.organizacao_id,
      ordemProducaoId: ordem_producao_id,
      itens,
      usuarioId: req.usuario.id,
      transaction: t,
    });
    await t.commit();
    return res.status(201).json(reservas);
  } catch (e) {
    await t.rollback();
    console.error("Erro ao reservar materiais:", e);
    return res.status(e.status === 422 ? 422 : 500).json({ erro: e.message || "Erro ao reservar materiais" });
  }
};

exports.baixar = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { ordem_producao_id } = req.body;
    if (!ordem_producao_id) return res.status(422).json({ erro: "ordem_producao_id é obrigatório" });
    const reservas = await estoqueService.baixarReservas({
      organizacaoId: req.organizacao_id,
      ordemProducaoId: ordem_producao_id,
      transaction: t,
    });
    await t.commit();
    return res.json({ mensagem: "Baixa de estoque realizada com sucesso", reservas });
  } catch (e) {
    await t.rollback();
    console.error("Erro ao dar baixa em estoque:", e);
    return res.status(500).json({ erro: "Erro ao dar baixa em estoque" });
  }
};

exports.cancelarReserva = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const reserva = await ReservaEstoque.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
      transaction: t,
    });
    if (!reserva) return res.status(404).json({ erro: "Reserva não encontrada" });
    const material = await Material.findOne({
      where: { id: reserva.material_id, organizacao_id: req.organizacao_id },
      transaction: t,
    });
    const restante = parseFloat(reserva.quantidade_reservada) - parseFloat(reserva.quantidade_consumida);
    if (material) {
      await material.update(
        { estoque_reservado: Math.max(0, parseFloat(material.estoque_reservado) - restante) },
        { transaction: t }
      );
    }
    await reserva.update(
      {
        quantidade_reservada: parseFloat(reserva.quantidade_consumida),
        estado: parseFloat(reserva.quantidade_consumida) > 0 ? "parcial" : "cancelada",
      },
      { transaction: t }
    );
    await t.commit();
    return res.json({ mensagem: "Reserva cancelada com sucesso", reserva });
  } catch (e) {
    await t.rollback();
    console.error("Erro ao cancelar reserva:", e);
    return res.status(500).json({ erro: "Erro ao cancelar reserva" });
  }
};

exports.listarReservas = async (req, res) => {
  try {
    const where = { organizacao_id: req.organizacao_id };
    if (req.query.estado) where.estado = req.query.estado;
    if (req.query.ordem_producao_id) where.ordem_producao_id = req.query.ordem_producao_id;
    const reservas = await ReservaEstoque.findAll({
      where,
      include: [
        { model: Material, required: false, attributes: ["id", "nome", "codigo", "unidade"] },
        { model: OrdemProducao, required: false, attributes: ["id", "numero", "estado"] },
      ],
      order: [["createdAt", "DESC"]],
    });
    return res.json(reservas);
  } catch (e) {
    console.error("Erro ao listar reservas:", e);
    return res.status(500).json({ erro: "Erro ao listar reservas" });
  }
};

exports.extrato = async (req, res) => {
  try {
    const { tipo } = req.query;
    const where = { organizacao_id: req.organizacao_id };
    if (tipo) where.tipo = tipo;
    const movimentos = await MovimentoEstoque.findAll({
      where,
      include: [{ model: Material, required: false, include: [{ model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "grupo"] }] }],
      order: [["createdAt", "DESC"]],
    });
    return res.json(movimentos);
  } catch (e) {
    console.error("Erro ao buscar extrato:", e);
    return res.status(500).json({ erro: "Erro ao buscar extrato" });
  }
};

exports.converter = async (req, res) => {
  try {
    const { largura, altura, formato, formato_alvo, quantidade } = req.body;
    let folha = null;
    if (formato) folha = estoqueService.obterFormato(String(formato).toUpperCase());
    if (!folha && largura && altura) folha = { largura: Number(largura), altura: Number(altura) };
    if (!folha) return res.status(422).json({ erro: "Informe a folha (largura/altura ou formato)" });
    const alvo = estoqueService.obterFormato(String(formato_alvo || "A4").toUpperCase());
    if (!alvo) return res.status(422).json({ erro: "Formato alvo inválido" });
    const { pecas_por_folha, orientacao } = estoqueService.converterFormato(folha.largura, folha.altura, alvo.largura, alvo.altura);
    const resposta = {
      folha,
      formato_alvo: String(formato_alvo || "A4").toUpperCase(),
      pecas_por_folha,
      orientacao,
      folhas_necessarias: 0,
    };
    if (quantidade) {
      resposta.folhas_necessarias = estoqueService.folhasNecessarias(quantidade, pecas_por_folha);
      resposta.quantidade = Number(quantidade);
    }
    return res.json(resposta);
  } catch (e) {
    console.error("Erro ao converter formatos:", e);
    return res.status(500).json({ erro: "Erro ao converter formatos" });
  }
};

exports.formatos = async (req, res) => {
  try {
    return res.json(estoqueService.listarFormatos());
  } catch (e) {
    console.error("Erro ao listar formatos:", e);
    return res.status(500).json({ erro: "Erro ao listar formatos" });
  }
};
