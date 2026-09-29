require("dotenv").config();

const { criarApp } = require("./app");
const { sequelize } = require("./models");

const app = criarApp();

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno no servidor" });
});

const PORTA = process.env.port || 8000;

(async () => {
  const usaMysql = (process.env.Lang || "mysql").toLowerCase() !== "sqlite";
  if (usaMysql) {
    try {
      const { prepararSchemaAntesSync } = require("./migrarMysql");
      await prepararSchemaAntesSync(sequelize);
    } catch (e) {
      console.error("Erro na preparação pré-sync:", e.message);
    }
  }

  await sequelize.sync({ alter: true });

  if (usaMysql) {
    const { aplicarMigracoesMysql } = require("./migrarMysql");
    await aplicarMigracoesMysql(sequelize);
  }
  const { inicializarSincronizacao } = require("./services/sincronizacao");
  await inicializarSincronizacao();
  const { iniciarPollingAGT } = require("./services/agtPolling");
  iniciarPollingAGT();
  app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
  });
})().catch((e) => {
  console.error("Erro ao conectar ao banco:", e);
});
