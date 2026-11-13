const { sequelize, Material, MovimentoEstoque, Categoria, ReservaEstoque, OrdemProducao, TesourariaMovimento, RequisicaoMaterial, Cliente } = require("../models");
const estoqueService = require("../services/estoque");
const { prefixoK, nomeCategoriaDosDados } = require("../services/codigoArtigo");

// Código automático: K + iniciais da categoria + sequência (ex.: KPO-0001).
async function gerarCodigo(organizacaoId, nomeCategoria) {
  const prefixo = prefixoK(nomeCategoria);
  const materiais = await Material.findAll({
    where: { organizacao_id: organizacaoId, deleted: false },
    attributes: ["codigo"],
  });
  let maxNum = 0;
  for (const m of materiais) {
    if (m.codigo && m.codigo.startsWith(prefixo + "-")) {
      const num = parseInt(m.codigo.split("-")[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return `${prefixo}-${String(maxNum + 1).padStart(4, "0")}`;
}

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
  "lucro",
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
  if (dados.mover_estoque !== undefined) dados.mover_estoque = !!dados.mover_estoque;
  if (dados.ativo !== undefined) dados.ativo = !!dados.ativo;
  if (dados.composicao !== undefined) {
    dados.composicao = Array.isArray(dados.composicao) ? dados.composicao : [];
  }
  return dados;
}

function serializar(material) {
  const obj = material.toJSON ? material.toJSON() : material;
  const quantidade = parseFloat(obj.quantidade) || 0;
  const reservado = parseFloat(obj.estoque_reservado) || 0;
  const disponivel = quantidade - reservado;
  const ponto = parseFloat(obj.ponto_ressuprimento || obj.estoque_min) || 0;
  const mover = obj.mover_estoque !== false;
  let status = "ok";
  if (!mover) status = "imobilizado";
  else if (disponivel <= 0) status = "esgotado";
  else if (disponivel <= ponto * 0.5) status = "critico";
  else if (disponivel <= ponto) status = "repor";
  const preco_venda = (parseFloat(obj.custo_unit) || 0) * (1 + (parseFloat(obj.lucro) || 0) / 100);
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
      include: [{ model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "familia", "subfamilia", "tipo", "campos_especificacao"] }],
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
        { model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "familia", "subfamilia", "tipo", "campos_especificacao"] },
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
    let nomeCategoria = nomeCategoriaDosDados(dados);
    if (dados.categoria_id) {
      const cat = await Categoria.findOne({ where: { id: dados.categoria_id } });
      if (cat && cat.nome) nomeCategoria = cat.nome;
    }
    dados.codigo = await gerarCodigo(req.organizacao_id, nomeCategoria);
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
    // O código é gerado automaticamente na criação e não volta a mudar;
    // artigos antigos sem código recebem um (ex.: KPO-0001) ao serem editados.
    delete dados.codigo;
    if (!material.codigo) {
      let nomeCategoria = nomeCategoriaDosDados(dados);
      const catId = dados.categoria_id || material.categoria_id;
      if (catId) {
        const cat = await Categoria.findOne({ where: { id: catId } });
        if (cat && cat.nome) nomeCategoria = cat.nome;
      }
      dados.codigo = await gerarCodigo(req.organizacao_id, nomeCategoria);
    }
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
    const { material_id, material_destino_id, tipo, quantidade, motivo, lote, data_fabricacao, validade, referencia_tipo, referencia_id, observacoes, solicitado_por, permitido_por } = req.body;
    let { cliente_nome, fornecedor_nome } = req.body;
    if (!material_id || !tipo || !quantidade) {
      await t.rollback();
      return res.status(422).json({ erro: "Material, tipo e quantidade são obrigatórios" });
    }
    const material = await Material.findOne({
      where: { id: material_id, organizacao_id: req.organizacao_id },
      include: [{ model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "tipo"] }],
      transaction: t,
    });
    if (!material) {
      await t.rollback();
      return res.status(404).json({ erro: "Material não encontrado" });
    }
    // Materiais da categoria "consumo interno" não têm preço de venda nem
    // cliente/fornecedor associado: a entrada/saída continua a ser permitida
    // usando "Consumo interno" como contraparte do movimento.
    const nomeCategoria = String((material.categoria && material.categoria.nome) || "").toLowerCase();
    const tipoCategoria = String((material.categoria && material.categoria.tipo) || "").toLowerCase();
    const consumoInterno = nomeCategoria.includes("consumo interno") || tipoCategoria.includes("consumo interno");
    if (consumoInterno) {
      cliente_nome = cliente_nome || "Consumo interno";
      fornecedor_nome = fornecedor_nome || "Consumo interno";
    }
    if (tipo === "saida" && !cliente_nome && !String(motivo || "").toLowerCase().includes("transfer")) {
      await t.rollback();
      return res.status(422).json({ erro: "Informe o cliente para registar a saída" });
    }
    if (tipo === "entrada" && !fornecedor_nome) {
      await t.rollback();
      return res.status(422).json({ erro: "Informe o fornecedor para registar a entrada" });
    }
    if (tipo === "transferencia" && !material_destino_id) {
      await t.rollback();
      return res.status(422).json({ erro: "Informe o material de destino para a transferência" });
    }
    const qtd = parseFloat(quantidade);
    if (qtd <= 0) {
      await t.rollback();
      return res.status(422).json({ erro: "Quantidade deve ser maior que zero" });
    }

    if (tipo === "entrada") {
      await material.update({ quantidade: parseFloat(material.quantidade) + qtd }, { transaction: t });
    } else if (tipo === "transferencia") {
      const disponivel = parseFloat(material.quantidade) - parseFloat(material.estoque_reservado);
      if (disponivel < qtd) {
        await t.rollback();
        return res.status(422).json({ erro: `Quantidade insuficiente em estoque (disponível ${disponivel} ${material.unidade})` });
      }
      await material.update({ quantidade: parseFloat(material.quantidade) - qtd }, { transaction: t });
      const destino = await Material.findOne({
        where: { id: material_destino_id, organizacao_id: req.organizacao_id },
        transaction: t,
      });
      if (!destino) {
        await t.rollback();
        return res.status(404).json({ erro: "Material de destino não encontrado" });
      }
      await destino.update({ quantidade: parseFloat(destino.quantidade) + qtd }, { transaction: t });
    } else {
      const disponivel = parseFloat(material.quantidade) - parseFloat(material.estoque_reservado);
      if (disponivel < qtd) {
        await t.rollback();
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
        material_destino_id: material_destino_id || null,
        observacoes: observacoes || null,
        cliente_nome: cliente_nome || null,
        fornecedor_nome: fornecedor_nome || null,
        solicitado_por: solicitado_por || null,
        permitido_por: permitido_por || null,
        usuario_id: req.usuario.id,
      },
      { transaction: t }
    );
    // Consumo interno é despesa da empresa: a baixa gera uma saída na
    // tesouraria pelo custo do material, para contar nas despesas e nos
    // relatórios. Não há dinheiro a sair de nenhuma conta bancária, por isso o
    // movimento fica sem conta associada e com a referência do movimento de stock.
    const baixaInterna =
      tipo === "saida" &&
      (consumoInterno ||
        String(motivo || "").startsWith("Requisição interna:") ||
        String(cliente_nome || "").trim() === "Consumo interno");
    if (baixaInterna) {
      const valor = Number((parseFloat(material.custo_unit || 0) * qtd).toFixed(2));
      // Sem custo unitário não há despesa a registar: evita linhas de 0 Kz.
      if (valor > 0) {
        const sector = String(motivo || "").replace(/^Requisição interna:\s*/, "").trim();
        const agora = new Date();
        await TesourariaMovimento.create(
          {
            organizacao_id: req.organizacao_id,
            usuario_id: req.usuario.id,
            tipo: "saida",
            categoria: "despesa",
            descricao: `Consumo interno — ${material.nome} (${qtd} ${material.unidade || "un"})${
              sector && sector !== "Consumo interno" ? ` · ${sector}` : ""
            }`.slice(0, 300),
            valor,
            data_movimento: agora.toISOString().split("T")[0],
            hora_movimento: agora.toTimeString().split(" ")[0],
            referencia_tipo: "outro",
            referencia_id: movimento.id,
            observacoes: `Baixa de stock interna (movimento #${movimento.id})`,
          },
          { transaction: t }
        );
      }
    }
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
    if (!Array.isArray(itens) || !itens.length) {
      await t.rollback();
      return res.status(422).json({ erro: "itens são obrigatórios" });
    }
    const reservas = await estoqueService.reservarMateriais({
      organizacaoId: req.organizacao_id,
      ordemProducaoId: ordem_producao_id || null,
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
    if (!ordem_producao_id) {
      await t.rollback();
      return res.status(422).json({ erro: "ordem_producao_id é obrigatório" });
    }
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
    if (!reserva) {
      await t.rollback();
      return res.status(404).json({ erro: "Reserva não encontrada" });
    }
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
      include: [{ model: Material, required: false, include: [{ model: Categoria, as: "categoria", required: false, attributes: ["id", "nome", "familia", "tipo"] }] }],
      order: [["createdAt", "DESC"]],
    });

    // O movimento guarda o nome do cliente no momento da saída. Em requisições
    // antigas esse nome ficou com a etiqueta de consumo interno, mesmo quando a
    // requisição tem cliente: a relação da requisição é a fonte de verdade.
    const idsRequisicao = [...new Set(
      movimentos
        .filter((m) => m.referencia_tipo === "requisicao_material" && m.referencia_id)
        .map((m) => Number(m.referencia_id))
    )];
    const requisicoesPorId = new Map();
    if (idsRequisicao.length) {
      const requisicoes = await RequisicaoMaterial.findAll({
        where: { id: idsRequisicao, organizacao_id: req.organizacao_id },
        include: [{ model: Cliente, as: "cliente", required: false, attributes: ["id", "nome"] }],
      });
      requisicoes.forEach((r) => requisicoesPorId.set(Number(r.id), r));
    }

    return res.json(movimentos.map((m) => {
      const json = m.toJSON ? m.toJSON() : m;
      const requisicao = json.referencia_tipo === "requisicao_material"
        ? requisicoesPorId.get(Number(json.referencia_id))
        : null;
      if (requisicao) {
        const guardado = String(requisicao.cliente_nome || "").trim();
        const nome = requisicao.cliente?.nome || (guardado && guardado !== "Consumo interno / produção" ? guardado : "");
        if (nome) json.cliente_nome = nome;
      }
      return json;
    }));
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
