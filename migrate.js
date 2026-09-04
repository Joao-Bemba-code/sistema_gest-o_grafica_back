// Migração única de produção.
// Uso: npm run migrate
// Sincroniza TODAS as tabelas com os modelos (alter) e aplica as migrações
// manuais (migrarMysql). Deve correr uma vez no deploy, não no arranque.
require("dotenv").config();

const { sequelize } = require("./models");

async function migrate() {
  console.log("=== MIGRAÇÃO DE PRODUÇÃO ===\n");

  // 1. Criar/alterar todas as tabelas para corresponderem aos modelos.
  console.log("[1/2] A sincronizar tabelas com os modelos (alter)...");
  await sequelize.sync({ alter: true });
  console.log("      OK: tabelas sincronizadas.\n");

  // 2. Aplicar migrações manuais (colunas/valores específicos por dialecto).
  if ((process.env.Lang || "mysql").toLowerCase() !== "sqlite") {
    console.log("[2/2] A aplicar migrações manuais MySQL...");
    const { aplicarMigracoesMysql } = require("./migrarMysql");
    await aplicarMigracoesMysql(sequelize);
    console.log("      OK: migrações manuais aplicadas.\n");
  }

  console.log("=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===");
  process.exit(0);
}

migrate().catch((e) => {
  console.error("ERRO NA MIGRAÇÃO:", e);
  process.exit(1);
});
