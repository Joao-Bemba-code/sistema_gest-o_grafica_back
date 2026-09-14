const { sequelize, Categoria } = require("../models");

async function garantirFamiliaVarchar() {
  await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
  await sequelize.query("ALTER TABLE `categoria` MODIFY `familia` VARCHAR(50) NOT NULL DEFAULT 'papeis'");
  console.log("MIGRAÇÃO: categoria.familia convertido para VARCHAR(50)");
}

function truncadoFamilia(e) {
  const msg = String(e?.parent?.message || e?.original?.message || e?.message || "");
  return msg.toLowerCase().includes("familia") && msg.toLowerCase().includes("truncat");
}

// Normaliza o grupo (tipo) para variantes escritas serem tratadas como iguais.
// Ex.: "Maquinaria", "Maquina", "máquina" e "maquina" colapsam num só grupo.
const TIPOS_CANONICOS = new Map([
  ["materia_prima", "materia_prima"], ["matéria-prima", "materia_prima"], ["materia-prima", "materia_prima"], ["matéria prima", "materia_prima"], ["materia prima", "materia_prima"],
  ["artigo", "artigo"], ["artigo / produto", "artigo"], ["artigo/produto", "artigo"],
  ["produto_acabado", "produto_acabado"], ["produto acabado", "produto_acabado"],
  ["servico", "servico"], ["serviço", "servico"], ["servicos", "servico"], ["serviços", "servico"],
  ["maquina", "maquina"], ["máquina", "maquina"], ["maquinaria", "maquina"],
  ["funcionario", "funcionario"], ["colaborador", "colaborador"],
  ["consumiveis", "consumiveis"], ["equipamentos", "equipamentos"], ["ferramentas", "ferramentas"],
]);

function normalizarTipo(v) {
  const t = String(v || "").trim().toLowerCase().replace(/\s+/g, " ");
  return TIPOS_CANONICOS.get(t) || t;
}

exports.listar = async (req, res) => {
  try {
    const categorias = await Categoria.findAll({
      where: { organizacao_id: req.organizacao_id },
      order: [["nome", "ASC"]],
    });
    return res.json(categorias);
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao listar categorias" });
  }
};

// Uma família pode ter várias categorias: o que distingue é o GRUPO (tipo)
// e/ou a SUBFAMÍLIA. Só bloqueamos quando os três coincidem.
async function categoriaDuplicada(organizacaoId, { familia, subfamilia, tipo }, ignorarId = null) {
  const normalizar = (s) => String(s || "").trim().toLowerCase();
  const alvo = { familia: normalizar(familia), subfamilia: normalizar(subfamilia), tipo: normalizarTipo(tipo) };
  const categorias = await Categoria.findAll({
    where: { organizacao_id: organizacaoId, deleted: false },
  });
  return categorias.some((c) => {
    if (String(c.id) === String(ignorarId)) return false;
    return normalizar(c.familia) === alvo.familia
      && normalizar(c.subfamilia) === alvo.subfamilia
      && normalizarTipo(c.tipo) === alvo.tipo;
  });
}

// A família é agora a identificação principal; o campo técnico "nome"
// é preenchido automaticamente para compatibilidade com o resto do sistema.
function comNomePadrao(dados) {
  const nome = String(dados.nome || "").trim() || String(dados.familia || "").trim() || "sem-familia";
  return { ...dados, nome, deleted: dados.deleted ?? false };
}

exports.criar = async (req, res) => {
  let dados;
  try {
    dados = { ...req.body, organizacao_id: req.organizacao_id };
    delete dados.grupo;
    const dup = await categoriaDuplicada(req.organizacao_id, dados);
    if (dup) {
      return res.status(409).json({ erro: "Já existe uma categoria com a mesma Família, Subfamília e Grupo. Pode criar outra na mesma família — basta alterar o Grupo ou a Subfamília." });
    }
    const categoria = await Categoria.create(comNomePadrao(dados));
    return res.status(201).json(categoria);
  } catch (e) {
    if (truncadoFamilia(e)) {
      try {
        await garantirFamiliaVarchar();
        const categoria = await Categoria.create(comNomePadrao(dados));
        return res.status(201).json(categoria);
      } catch (e2) {
        console.error("Erro ao criar categoria (após corrigir familia):", e2);
      }
    }
    console.error("Erro ao criar categoria:", e);
    return res.status(500).json({ erro: "Erro ao criar categoria" });
  }
};

exports.remover = async (req, res) => {
  try {
    const categoria = await Categoria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!categoria) return res.status(404).json({ erro: "Categoria não encontrada" });
    await categoria.update({ deleted: 1, deletedAt: new Date() });
    return res.json({ mensagem: "Categoria removida com sucesso" });
  } catch (e) {
    return res.status(500).json({ erro: "Erro ao remover categoria" });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const categoria = await Categoria.findOne({
      where: { id: req.params.id, organizacao_id: req.organizacao_id },
    });
    if (!categoria) return res.status(404).json({ erro: "Categoria não encontrada" });
    const dados = { ...req.body };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.grupo;
    if (dados.campos_especificacao !== undefined && !Array.isArray(dados.campos_especificacao)) {
      return res.status(422).json({ erro: "campos_especificacao deve ser uma lista" });
    }
    if (dados.nome !== undefined && !String(dados.nome).trim() && dados.familia !== undefined) {
      delete dados.nome;
    }
    const alvo = {
      familia: dados.familia ?? categoria.familia,
      subfamilia: dados.subfamilia ?? categoria.subfamilia,
      tipo: dados.tipo ?? categoria.tipo,
    };
    if (await categoriaDuplicada(req.organizacao_id, alvo, categoria.id)) {
      return res.status(409).json({ erro: "Já existe outra categoria com a mesma Família, Subfamília e Grupo. Mude o Grupo ou a Subfamília." });
    }
    try {
      await categoria.update(comNomePadrao(dados));
      return res.json(categoria);
    } catch (e) {
      if (!truncadoFamilia(e)) throw e;
      await garantirFamiliaVarchar();
      await categoria.update(comNomePadrao(dados));
      return res.json(categoria);
    }
  } catch (e) {
    console.error("Erro ao atualizar categoria:", e);
    return res.status(500).json({ erro: "Erro ao atualizar categoria" });
  }
};
