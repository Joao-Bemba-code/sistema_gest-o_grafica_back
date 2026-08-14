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
  Pedido,
  PedidoItem,
} = require("../models");

router.use(auth);

function novo(r) {
  const t = Date.parse(r && r.updatedAt);
  return isNaN(t) ? 0 : t;
}

function limparDados(r) {
  const dados = { ...r };
  delete dados.id;
  delete dados.organizacao_id;
  delete dados.createdAt;
  delete dados.updatedAt;
  return dados;
}

function criarValores(r, extras) {
  return {
    ...limparDados(r),
    ...(extras || {}),
    id: r.id,
    ...(r.createdAt ? { createdAt: r.createdAt } : {}),
    ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
  };
}

async function mesclarOrg(Model, registos, orgId) {
  for (const r of registos || []) {
    if (!r || r.id == null) continue;
    const existe = await Model.findOne({ where: { id: r.id, organizacao_id: orgId } });
    if (!existe) {
      await Model.create(criarValores(r, { organizacao_id: orgId }));
    } else if (novo(r) > novo(existe)) {
      await existe.update({
        ...limparDados(r),
        organizacao_id: orgId,
        ...(r.updatedAt ? { updatedAt: r.updatedAt } : {}),
      });
    }
  }
}

async function substituirFilhos(Model, fk, fkVal, registos, extras) {
  const existentes = await Model.findAll({ where: { [fk]: fkVal }, attributes: ["id"] });
  const ids = existentes.map((x) => x.id);
  if (ids.length) await Model.destroy({ where: { id: ids } });
  for (const r of registos || []) {
    if (!r || r.id == null) continue;
    await Model.create(criarValores(r, { ...(extras || {}), [fk]: fkVal }));
  }
}

async function sincronizarSequencia(registos, orgId) {
  const r = (registos || [])[0];
  if (!r) return;
  const [seq] = await Sequencia.findOrCreate({
    where: { organizacao_id: orgId },
    defaults: { numero: 0 },
  });
  const novoNum = Math.max(Number(seq.numero) || 0, Number(r.numero) || 0);
  if (novoNum > Number(seq.numero) || 0) await seq.update({ numero: novoNum });
}

router.post("/", async (req, res) => {
  const orgId = req.organizacao_id;
  const b = req.body || {};
  try {
    await mesclarOrg(Categoria, b.categorias, orgId);
    await mesclarOrg(Fornecedor, b.fornecedores, orgId);
    await mesclarOrg(Cliente, b.clientes, orgId);
    await mesclarOrg(Material, b.materiais, orgId);
    await mesclarOrg(MovimentoEstoque, b.movimentos, orgId);

    for (const o of b.orcamentos || []) {
      if (o.id == null) continue;
      const itens = (b.orcamento_itens || []).filter(
        (i) => Number(i.orcamento_id) === Number(o.id)
      );
      const remoto = await Orcamento.findOne({ where: { id: o.id, organizacao_id: orgId } });
      const autorizado = !remoto || novo(o) > novo(remoto);
      if (!remoto) {
        await Orcamento.create(criarValores(o, { organizacao_id: orgId }));
      } else if (autorizado) {
        await remoto.update({
          ...limparDados(o),
          organizacao_id: orgId,
          ...(o.updatedAt ? { updatedAt: o.updatedAt } : {}),
        });
      }
      if (autorizado) {
        await substituirFilhos(OrcamentoItem, "orcamento_id", o.id, itens);
        for (const item of itens) {
          if (item.id == null) continue;
          const materiais = (b.orcamento_materiais || []).filter(
            (m) => Number(m.orcamento_item_id) === Number(item.id)
          );
          await substituirFilhos(OrcamentoMaterial, "orcamento_item_id", item.id, materiais);
        }
      }
    }

    for (const od of b.ordens || []) {
      if (od.id == null) continue;
      const filhosOrdem = [
        [PreImpressao, "pre_impressaos"],
        [Impressao, "impressaos"],
        [Acabamento, "acabamentos"],
        [Qualidade, "qualidades"],
      ];
      const remoto = await OrdemProducao.findOne({ where: { id: od.id, organizacao_id: orgId } });
      const autorizado = !remoto || novo(od) > novo(remoto);
      if (!remoto) {
        await OrdemProducao.create(criarValores(od, { organizacao_id: orgId }));
      } else if (autorizado) {
        await remoto.update({
          ...limparDados(od),
          organizacao_id: orgId,
          ...(od.updatedAt ? { updatedAt: od.updatedAt } : {}),
        });
      }
      if (autorizado) {
        for (const [Model, campo] of filhosOrdem) {
          const registos = (b[campo] || []).filter(
            (x) => Number(x.ordem_producao_id) === Number(od.id)
          );
          await substituirFilhos(Model, "ordem_producao_id", od.id, registos, {
            organizacao_id: orgId,
          });
        }
      }
    }

    await mesclarOrg(ReservaEstoque, b.reservas, orgId);
    await mesclarOrg(Faturacao, b.faturacaoes, orgId);

    for (const p of b.pedidos || []) {
      if (p.id == null) continue;
      const itens = (b.pedido_itens || []).filter(
        (i) => Number(i.pedido_id) === Number(p.id)
      );
      const remoto = await Pedido.findOne({ where: { id: p.id, organizacao_id: orgId } });
      const autorizado = !remoto || novo(p) > novo(remoto);
      if (!remoto) {
        await Pedido.create(criarValores(p, { organizacao_id: orgId }));
      } else if (autorizado) {
        await remoto.update({
          ...limparDados(p),
          organizacao_id: orgId,
          ...(p.updatedAt ? { updatedAt: p.updatedAt } : {}),
        });
      }
      if (autorizado) {
        await substituirFilhos(PedidoItem, "pedido_id", p.id, itens);
      }
    }

    await sincronizarSequencia(b.sequencias, orgId);

    return res.json({ ok: true, mensagem: "Sincronização concluída" });
  } catch (e) {
    console.error("Erro na sincronização:", e);
    return res.status(500).json({ erro: "Erro na sincronização: " + (e.message || e) });
  }
});

router.get("/", async (req, res) => {
  const orgId = req.organizacao_id;
  const t = (m) => m.findAll({ raw: true, where: { organizacao_id: orgId } });
  try {
    const [
      categorias,
      fornecedores,
      clientes,
      materiais,
      movimentos,
      orcamentos,
      ordens,
      reservas,
      faturacaoes,
      pedidos,
      sequencias,
    ] = await Promise.all([
      t(Categoria),
      t(Fornecedor),
      t(Cliente),
      t(Material),
      t(MovimentoEstoque),
      t(Orcamento),
      t(OrdemProducao),
      t(ReservaEstoque),
      t(Faturacao),
      t(Pedido),
      t(Sequencia),
    ]);

    const orcamIds = orcamentos.map((o) => o.id);
    const orcamento_itens = orcamIds.length
      ? await OrcamentoItem.findAll({ raw: true, where: { orcamento_id: orcamIds } })
      : [];
    const itemIds = orcamento_itens.map((i) => i.id);
    const orcamento_materiais = itemIds.length
      ? await OrcamentoMaterial.findAll({ raw: true, where: { orcamento_item_id: itemIds } })
      : [];

    const ordemIds = ordens.map((o) => o.id);
    const pre_impressaos = ordemIds.length
      ? await PreImpressao.findAll({ raw: true, where: { ordem_producao_id: ordemIds } })
      : [];
    const impressaos = ordemIds.length
      ? await Impressao.findAll({ raw: true, where: { ordem_producao_id: ordemIds } })
      : [];
    const acabamentos = ordemIds.length
      ? await Acabamento.findAll({ raw: true, where: { ordem_producao_id: ordemIds } })
      : [];
    const qualidades = ordemIds.length
      ? await Qualidade.findAll({ raw: true, where: { ordem_producao_id: ordemIds } })
      : [];

    const pedidoIds = pedidos.map((p) => p.id);
    const pedido_itens = pedidoIds.length
      ? await PedidoItem.findAll({ raw: true, where: { pedido_id: pedidoIds } })
      : [];

    return res.json({
      categorias,
      fornecedores,
      clientes,
      materiais,
      movimentos,
      orcamentos,
      orcamento_itens,
      orcamento_materiais,
      ordens,
      pre_impressaos,
      impressaos,
      acabamentos,
      qualidades,
      reservas,
      faturacaoes,
      pedidos,
      pedido_itens,
      sequencias,
    });
  } catch (e) {
    console.error("Erro ao obter dados para sincronização:", e);
    return res.status(500).json({ erro: "Erro na sincronização: " + (e.message || e) });
  }
});

module.exports = router;
