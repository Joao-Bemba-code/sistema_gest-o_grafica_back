/* ============================================================
   Exporta TODOS os dados da base atual (MySQL/MariaDB) para um
   ficheiro SQLite unico. Serve de backup simples e portatil.

   Uso:  node exportar_sqlite.js  [destino.sqlite]
   ============================================================ */
require("dotenv").config();

const { exportarSqlite } = require("./services/sqliteExport");

async function main() {
  const r = await exportarSqlite(process.argv[2], { log: console.log, herdarStdio: true });
  console.log(`\n[OK] Base SQLite criada: ${r.destino} (${r.kb} KB)`);
  console.log("\nPara o sistema passar a usar esta base, no .env do backend:");
  console.log("  Lang=sqlite");
  console.log(`  Sqlite_File=${r.destino}`);
}

main().catch((e) => {
  console.error("[ERRO]", e.message || e);
  process.exit(1);
});
