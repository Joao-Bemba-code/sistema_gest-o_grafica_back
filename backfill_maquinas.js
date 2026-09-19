require("dotenv").config();
const { Maquina, Material, Categoria, sequelize } = require("./models");
const { Op } = require("sequelize");

const normalizarNome = (v) => String(v || "").trim().toLowerCase();

const espDe = (m) => (m && typeof m === "object" ? m : {});
const data = new Date().toISOString();

async function backfill() {
  const materiais = await Material.findAll({
    include: [
      {
        model: Categoria,
        as: "categoria",
        required: true,
        where: { [Op.or]: [{ tipo: "maquina" }, { familia: "equipamentos" }] },
      },
    ],
  });

  let criadas = 0;
  let ignoradas = 0;

  for (const m of materiais) {
    if (m.deleted) continue;
    const esp = espDe(m.especificacoes);
    const cat = m.categoria || {};
    const jaExiste = await Maquina.findOne({
      where: {
        organizacao_id: m.organizacao_id,
        [Op.or]: [
          { codigo: m.codigo || null },
          { nome_comum: normalizarNome(m.nome) },
        ]
        .filter((x) => Object.values(x)[0]),
      },
    });
    if (jaExiste) { ignoradas++; continue; }
    await Maquina.create({
      organizacao_id: m.organizacao_id,
      categoria_id: m.categoria_id || null,
      codigo: m.codigo || "",
      nome_comum: m.nome,
      nome_tecnico: m.nome_tecnico || "",
      descricao: m.descricao || "",
      subfamilia: esp.subfamilia || cat.subfamilia || "",
      fornecedor: m.fornecedor || "",
      unidade: m.unidade || "un",
      marca: esp.marca || "",
      modelo: esp.modelo || "",
      numero_serie: esp.numero_serie || "",
      numero_patrimonial: esp.numero_patrimonial || "",
      fabricante: esp.fabricante || "",
      estado: "operacional",
      materiais_consumiveis: [],
      manutencoes: [],
      historico_estados: [{ estado: "operacional", data, motivo: "Registo inicial (migrado do estorque)" }],
      estoque_min: Number(m.estoque_min) || 0,
      estoque_max: Number(m.estoque_max) || 0,
      custo_unit: Number(m.custo_unit) || 0,
      margem: Number(m.margem || m.lucro) || 0,
      localizacao: m.localizacao || "",
    });
    criadas++;
    console.log("criada ->", m.nome, `(material ${m.id})`);
  }

  console.log(`\nResumo: ${criadas} maquinas criadas, ${ignoradas} ja existiam.`);
  process.exit(0);
}

backfill().catch((e) => { console.error("FALHOU", e); process.exit(1); });
setTimeout(() => { console.error("TIMEOUT"); process.exit(2); }, 20000);