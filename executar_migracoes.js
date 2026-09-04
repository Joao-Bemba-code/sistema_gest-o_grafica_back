const { sequelize } = require("./models");
const fs = require("fs");
const path = require("path");

async function migrar() {
  const migDir = path.join(__dirname, "migrations");
  const arquivos = fs.readdirSync(migDir)
    .filter(f => f.endsWith(".sql") && !f.includes("00_executar"))
    .sort();

  console.log("=== Migracao da Tesouraria ===\n");

  for (const arquivo of arquivos) {
    const sql = fs.readFileSync(path.join(migDir, arquivo), "utf8");
    console.log(`Executando: ${arquivo}`);
    try {
      await sequelize.query(sql);
      console.log(`  OK\n`);
    } catch (e) {
      if (e.message && e.message.includes("already exists")) {
        console.log(`  Ja existe, ignorando.\n`);
      } else {
        console.error(`  ERRO: ${e.message}\n`);
      }
    }
  }

  // Fallback: sync alter para garantir consistencia
  console.log("Sincronizando modelos com o banco (alter)...");
  await sequelize.sync({ alter: true });
  console.log("Sincronizacao concluida!");

  console.log("\n=== Migraconcluida com sucesso! ===");
  process.exit(0);
}

migrar().catch((e) => {
  console.error("Erro fatal na migracao:", e);
  process.exit(1);
});
