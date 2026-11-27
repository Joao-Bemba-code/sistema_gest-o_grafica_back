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
  // Todas as migrações (SQL + alterações das models) num único ficheiro,
  // executadas no arranque, antes de aceitar pedidos.
  const { executarMigracoes } = require("./migration");
  await executarMigracoes(sequelize);

  const { inicializarSincronizacao } = require("./services/sincronizacao");
  await inicializarSincronizacao();
  const { iniciarPollingAGT } = require("./services/agtPolling");
  iniciarPollingAGT();
  app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
  });
})().catch((e) => {
  console.error("Erro ao arrancar o servidor:", e);
});
