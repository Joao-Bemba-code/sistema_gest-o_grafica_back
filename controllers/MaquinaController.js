const { Maquina } = require("../models");

exports.listar = async (req, res) => {
  try {
    const maquinas = await Maquina.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome_comum", "ASC"]],
    });
    return res.json(maquinas);
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
