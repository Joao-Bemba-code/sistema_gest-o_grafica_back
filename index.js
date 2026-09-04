require("dotenv").config();

const { criarApp } = require("./app");
const { sequelize } = require("./models");

const app = criarApp();

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno no servidor" });
});

const PORTA = process.env.port || 8000;

sequelize
  .sync({ alter: true })
  .then(async () => {
    if ((process.env.Lang || "mysql").toLowerCase() !== "sqlite") {
      const { aplicarMigracoesMysql } = require("./migrarMysql");
      await aplicarMigracoesMysql(sequelize);
    }
    const { inicializarSincronizacao } = require("./services/sincronizacao");
    await inicializarSincronizacao();
    app.listen(PORTA, () => {
      console.log(`Servidor rodando na porta ${PORTA}`);
    });
  })
  .catch((e) => {
    console.error("Erro ao conectar ao banco:", e);
  });
