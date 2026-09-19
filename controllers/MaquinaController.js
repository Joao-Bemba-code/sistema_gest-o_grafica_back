const { Maquina, Material, Categoria } = require("../models");
const { Op } = require("sequelize");

const normalizarNome = (v) => String(v || "").trim().toLowerCase();

function maquinaDeMaterial(material) {
  const esp = material.especificacoes && typeof material.especificacoes === "object" ? material.especificacoes : {};
  const cat = material.categoria || {};
  return {
    id: `s${material.id}`,
    origem: "stock",
    material_id: material.id,
    codigo: material.codigo || "",
    nome_comum: material.nome,
    nome_tecnico: material.nome_tecnico || "",
    descricao: material.descricao || "",
    categoria_id: material.categoria_id || null,
    subfamilia: esp.subfamilia || cat.subfamilia || "",
    fornecedor: material.fornecedor || "",
    unidade: material.unidade || "un",
    marca: esp.marca || "",
    modelo: esp.modelo || "",
    numero_serie: esp.numero_serie || "",
    numero_patrimonial: esp.numero_patrimonial || "",
    fabricante: esp.fabricante || "",
    estado: "operacional",
    localizacao: material.localizacao || "",
    custo_unit: parseFloat(material.custo_unit) || 0,
    margem: parseFloat(material.margem || material.lucro) || 0,
    estoque_min: parseFloat(material.estoque_min) || 0,
    estoque_max: parseFloat(material.estoque_max) || 0,
    quantidade: parseFloat(material.quantidade) || 0,
  };
}

exports.listar = async (req, res) => {
  try {
    const [maquinas, materiais] = await Promise.all([
      Maquina.findAll({
        where: { organizacao_id: req.organizacao_id },
        order: [["nome_comum", "ASC"]],
      }),
      Material.findAll({
        where: { organizacao_id: req.organizacao_id },
        include: [
          {
            model: Categoria,
            as: "categoria",
            required: true,
            where: { [Op.or]: [{ tipo: "maquina" }, { familia: "equipamentos" }] },
          },
        ],
        order: [["nome", "ASC"]],
      }),
    ]);
    const vistos = new Set(maquinas.map((m) => normalizarNome(m.nome_comum)));
    const extra = [];
    for (const mat of materiais) {
      const nome = mat.nome;
      if (!nome) continue;
      const chave = normalizarNome(nome);
      if (vistos.has(chave)) continue;
      vistos.add(chave);
      extra.push(maquinaDeMaterial(mat));
    }
    return res.json([...maquinas, ...extra]);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar maquinas" });
  }
};

exports.buscarPorId = async (req, res) => {
  try {
    const maquina = await Maquina.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!maquina) return res.status(404).json({ erro: "Maquina nao encontrada" });
    return res.json(maquina);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao buscar maquina" });
  }
};

exports.criar = async (req, res) => {
  try {
    const dados = { ...req.body, organizacao_id: req.organizacao_id };
    const entradas = [
      { estado: dados.estado || "operacional", data: new Date().toISOString(), motivo: dados.motivo_estado || "Registo inicial" },
    ];
    dados.historico_estados = entradas;
    const maquina = await Maquina.create(dados);
    return res.status(201).json(maquina);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao criar maquina" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const maquina = await Maquina.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!maquina) return res.status(404).json({ erro: "Maquina nao encontrada" });
    const dados = { ...req.body };
    const novoEstado = dados.estado;
    const motivoEstado = dados.motivo_estado || "Mudança de estado";
    const tempoManutencao = dados.tempo_manutencao || dados.tempo_estimado || null;
    const tecnicoManutencao = dados.tecnico_manutencao || dados.tecnico || null;
    delete dados.motivo_estado;
    delete dados.tempo_manutencao;
    delete dados.tecnico_manutencao;
    if (novoEstado && novoEstado !== maquina.estado) {
      const historico = Array.isArray(maquina.historico_estados) ? [...maquina.historico_estados] : [];
      const entrada = { estado: novoEstado, data: new Date().toISOString(), motivo: motivoEstado };
      if (novoEstado === "manutencao" || novoEstado === "avariada") {
        if (tempoManutencao) entrada.tempo_estimado = tempoManutencao;
        if (tecnicoManutencao) entrada.tecnico = tecnicoManutencao;
      }
      historico.push(entrada);
      dados.historico_estados = historico;
    }
    await maquina.update(dados);
    return res.json(maquina);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao atualizar maquina" });
  }
};

exports.remover = async (req, res) => {
  try {
    const maquina = await Maquina.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!maquina) return res.status(404).json({ erro: "Maquina nao encontrada" });
    await maquina.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Maquina removida com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover maquina" });
  }
};
