const router = require("express").Router();
const auth = require("../protect/auth");
const {
  Categoria,
  Fornecedor,
  Cliente,
  Material,
  MovimentoEstoque,
  Orcamento,
  OrcamentoItem,
  OrcamentoMaterial,
  OrdemProducao,
  PreImpressao,
  Impressao,
  Acabamento,
  Qualidade,
  ReservaEstoque,
  Faturacao,
  Sequencia,
} = require("../models");

router.use(auth);

async function upsertOrg(Model, registos, orgId) {
  let n = 0;
  for (const r of registos || []) {
    if (!r || r.id == null) continue;
    const dados = { ...r };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.createdAt;
    delete dados.updatedAt;
    const existe = await Model.findOne({ where: { id: r.id, organizacao_id: orgId } });
    if (existe) {
      await existe.update({ ...dados, organizacao_id: orgId });
    } else {
      await Model.create({ ...dados, id: r.id, organizacao_id: orgId });
    }
    n++;
  }
  return n;
}

async function substituirFilhos(Model, fk, fkVal, registos, extras) {
  const existentes = await Model.findAll({ where: { [fk]: fkVal }, attributes: ["id"] });
  const ids = existentes.map((x) => x.id);
  if (ids.length) await Model.destroy({ where: { id: ids } });
  for (const r of registos || []) {
    if (!r || r.id == null) continue;
    const dados = { ...r };
    delete dados.id;
    delete dados.organizacao_id;
    delete dados.createdAt;
    delete dados.updatedAt;
    await Model.create({ ...dados, ...(extras || {}), id: r.id, [fk]: fkVal });
  }
}

async function sincronizarSequencia(registos, orgId) {
  const r = (registos || [])[0];
  if (!r) return;
  const [seq] = await Sequencia.findOrCreate({
    where: { organizacao_id: orgId },
    defaults: { numero: 0 },
  });
  const novo = Math.max(Number(seq.numero) || 0, Number(r.numero) || 0);
  if (novo > Number(seq.numero) || 0) await seq.update({ numero: novo });
}

router.post("/", async (req, res) => {
  const orgId = req.organizacao_id;
  const b = req.body || {};
  try {
    await upsertOrg(Categoria, b.categorias, orgId);
    await upsertOrg(Fornecedor, b.fornecedores, orgId);
    await upsertOrg(Cliente, b.clientes, orgId);
    await upsertOrg(Material, b.materiais, orgId);
    await upsertOrg(MovimentoEstoque, b.movimentos, orgId);

    await upsertOrg(Orcamento, b.orcamentos, orgId);
    for (const o of b.orcamentos || []) {
      if (o.id == null) continue;
      const itens = (b.orcamento_itens || []).filter(
        (i) => Number(i.orcamento_id) === Number(o.id)
      );
      await substituirFilhos(OrcamentoItem, "orcamento_id", o.id, itens);
      for (const item of itens) {
        if (item.id == null) continue;
        const materiais = (b.orcamento_materiais || []).filter(
          (m) => Number(m.orcamento_item_id) === Number(item.id)
        );
        await substituirFilhos(OrcamentoMaterial, "orcamento_item_id", item.id, materiais);
      }
    }

    await upsertOrg(OrdemProducao, b.ordens, orgId);
    const filhosOrdem = [
      [PreImpressao, "pre_impressaos"],
      [Impressao, "impressaos"],
      [Acabamento, "acabamentos"],
      [Qualidade, "qualidades"],
    ];
    for (const od of b.ordens || []) {
      if (od.id == null) continue;
      for (const [Model, campo] of filhosOrdem) {
        const registos = (b[campo] || []).filter(
          (x) => Number(x.ordem_producao_id) === Number(od.id)
        );
        await substituirFilhos(Model, "ordem_producao_id", od.id, registos, {
          organizacao_id: orgId,
        });
      }
    }

    await upsertOrg(ReservaEstoque, b.reservas, orgId);
    await upsertOrg(Faturacao, b.faturacaoes, orgId);
    await sincronizarSequencia(b.sequencias, orgId);

    return res.json({ ok: true, mensagem: "Sincronização concluída" });
  } catch (e) {
    console.error("Erro na sincronização:", e);
    return res.status(500).json({ erro: "Erro na sincronização: " + (e.message || e) });
  }
});

module.exports = router;
