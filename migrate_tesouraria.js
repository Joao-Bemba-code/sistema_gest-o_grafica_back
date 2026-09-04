const { sequelize } = require("./models");

async function migrar() {
  try {
    console.log("A sincronizar tabelas...");
    await sequelize.sync({ alter: true });
    console.log("Tabelas sincronizadas com sucesso!");
    process.exit(0);
  } catch (e) {
    console.error("Erro na migração:", e);
    process.exit(1);
  }
}

migrar();
