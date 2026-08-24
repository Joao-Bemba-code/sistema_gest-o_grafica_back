/* ============================================================
   Uso interno do exportar_sqlite.js: recebe um JSON com todas as
   tabelas e carrega na base SQLite apontada por Sqlite_File.
   Corre sempre com Lang=sqlite (imposto pelo processo pai).
   ============================================================ */
require("dotenv").config();
const fs = require("fs");
const sequelize = require("./config");

const ORDEM = [
  "Organizacao", "Usuario", "Sistema", "Seguranca", "Sequencia",
  "Categoria", "Fornecedor", "Cliente", "Material", "MovimentoEstoque",
  "Orcamento", "OrcamentoItem", "OrcamentoMaterial", "OrdemProducao",
  "PreImpressao", "Impressao", "Acabamento", "Qualidade", "ReservaEstoque",
  "Faturacao", "Pedido", "PedidoItem",
];

function nomeTabela(modelo) {
  const tn = modelo.getTableName();
  return typeof tn === "string" ? tn : tn.tableName;
}

function tipoSqlite(tipoMysql) {
  const t = String(tipoMysql || "").toLowerCase();
  if (/int|bool/.test(t)) return "INTEGER";
  if (/decimal|numeric|float|double|real/.test(t)) return "REAL";
  if (/datetime|timestamp|date|time/.test(t)) return "DATETIME";
  return "TEXT";
}

async function main() {
  const ficheiro = process.argv[2];
  if (!ficheiro || !fs.existsSync(ficheiro)) {
    console.error("[ERRO] JSON de exportacao nao encontrado.");
    process.exit(1);
  }
  if ((process.env.Lang || "").toLowerCase() !== "sqlite") {
    console.error("[ERRO] Este script so pode correr em modo sqlite.");
    process.exit(1);
  }

  const exportacao = JSON.parse(fs.readFileSync(ficheiro, "utf8"));
  const dados = exportacao.tabelas || {};
  const colunasExportadas = exportacao.colunas || {};
  const modelos = require("./models");

  console.log("A criar estrutura das tabelas...");
  await sequelize.sync();

  for (const nome of ORDEM) {
    const tabela = nomeTabela(modelos[nome]);
    const linhas = dados[tabela] || [];
    if (!linhas.length) continue;

    const [existentes] = await sequelize.query(`PRAGMA table_info("${tabela}")`);
    const nomesExistentes = new Set(existentes.map((c) => c.name));
    for (const col of colunasExportadas[tabela] || []) {
      if (col && col.nome && !nomesExistentes.has(col.nome)) {
        try {
          await sequelize.query(`ALTER TABLE "${tabela}" ADD COLUMN "${col.nome}" ${tipoSqlite(col.tipo)}`);
          nomesExistentes.add(col.nome);
        } catch {}
      }
    }

    const colunas = Object.keys(linhas[0]).filter((c) => nomesExistentes.has(c) || c === "id");
    const sql = `INSERT INTO "${tabela}" (${colunas.map((c) => `"${c}"`).join(", ")}) VALUES (${colunas.map(() => "?").join(", ")})`;
    let inseridas = 0;
    for (const linha of linhas) {
      try {
        await sequelize.query(sql, { replacements: colunas.map((c) => linha[c]) });
        inseridas++;
      } catch (e) {
        console.error(`  [AVISO] ${tabela}: linha ignorada (${e.message})`);
      }
    }
    if (inseridas && linhas[0].id !== undefined) {
      try {
        await sequelize.query(
          `UPDATE sqlite_sequence SET seq=(SELECT MAX(id) FROM "${tabela}") WHERE name='${tabela}'`
        );
      } catch {}
    }
    console.log(`  ${tabela}: ${inseridas} inseridas`);
  }
  await sequelize.close();
}

main().catch((e) => {
  console.error("[ERRO]", e.message || e);
  process.exit(1);
});
