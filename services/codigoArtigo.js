// Regras partilhadas do código automático de artigos de stock:
// K + iniciais da categoria + sequência de 4 dígitos (ex.: "Papel Offset" -> KPO-0001).

const PARAVRAS_IGNORADAS = new Set(["e", "de", "da", "do", "das", "dos", "para"]);

function iniciaisDaCategoria(categoria) {
  const palavras = String(categoria || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[\s/]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const relevantes = palavras.filter((p) => !PARAVRAS_IGNORADAS.has(p.toLowerCase()));
  const base = (relevantes.length ? relevantes : palavras)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
  return base || "GEN";
}

function prefixoK(categoria) {
  return `K${iniciaisDaCategoria(categoria)}`;
}

// O frontend envia o nome da categoria dentro de especificacoes.categoria.
function nomeCategoriaDosDados(dados) {
  let espec = dados && dados.especificacoes;
  if (typeof espec === "string") {
    try { espec = JSON.parse(espec); } catch (e) { espec = {}; }
  }
  return String((espec && espec.categoria) || "").trim();
}

// Migração idempotente: dá o formato K+iniciais a todos os materiais que
// ainda não o têm (códigos antigos tipo PAP-0001, ou vazios). Códigos já
// conformes nunca são alterados. Corre no arranque do backend e no migrate.
async function recodificarMateriaisK(sequelize, opcoes = {}) {
  const dryRun = !!opcoes.dryRun;
  const { Material, Categoria } = require("../models");
  const materiais = await Material.findAll({
    where: { deleted: false },
    include: [{ model: Categoria, as: "categoria", required: false, attributes: ["id", "nome"] }],
    order: [["id", "ASC"]],
  });

  // 1. Agrupar por organização + prefixo da categoria.
  const grupos = new Map();
  for (const m of materiais) {
    const nomeCat = (m.categoria && m.categoria.nome) || nomeCategoriaDosDados(m) || "GEN";
    const chave = `${m.organizacao_id}|${prefixoK(nomeCat)}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(m);
  }

  // 2. Em cada grupo: máximos atuais dos códigos conformes; depois atribuir
  //    os próximos números aos materiais fora da regra, por ordem de id.
  let alterados = 0;
  const plano = [];
  for (const [chave, itens] of grupos) {
    const [orgStr, prefixo] = chave.split("|");
    const organizacaoId = parseInt(orgStr, 10);
    let maxNum = 0;
    for (const m of itens) {
      const codigo = String(m.codigo || "");
      if (codigo.startsWith(`${prefixo}-`)) {
        const num = parseInt(codigo.split("-")[1], 10);
        if (!Number.isNaN(num) && num > maxNum) maxNum = num;
      }
    }
    for (const m of itens) {
      const codigo = String(m.codigo || "");
      const conforme = new RegExp(`^${prefixo}-\\d{4,}$`).test(codigo);
      if (conforme) continue;
      maxNum += 1;
      const novo = `${prefixo}-${String(maxNum).padStart(4, "0")}`;
      plano.push({ id: m.id, organizacao_id: organizacaoId, old: m.codigo || "(sem código)", novo, nome: m.nome });
      if (!dryRun) {
        await Material.update(
          { codigo: novo },
          { where: { id: m.id, organizacao_id: organizacaoId, deleted: false } }
        );
      }
      alterados += 1;
    }
  }

  if (!dryRun && alterados) console.log(`MIGRAÇÃO: ${alterados} artigo(s) de stock recodificados para K+iniciais da categoria`);
  return { alterados, plano };
}

module.exports = { iniciaisDaCategoria, prefixoK, nomeCategoriaDosDados, recodificarMateriaisK };
