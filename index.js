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
      // Limpar registos órfãos antes do sync para evitar falha na criação de FKs
      try {
        await sequelize.query(
          `DELETE FROM orcamento_material
           WHERE orcamento_item_id IS NOT NULL
             AND orcamento_item_id NOT IN (SELECT id FROM orcamento_item)`
        );
        console.log("Limpeza: orcamento_material órfãos removidos");
      } catch (e) {
        console.log("Limpeza de órfãos ignorada:", e.message);
      }
      try {
        await sequelize.query(
          `DELETE FROM orcamento_servico
           WHERE orcamento_id IS NOT NULL
             AND orcamento_id NOT IN (SELECT id FROM orcamento)`
        );
      } catch {}
    } catch (e) {
      console.error("Erro na preparação pré-sync:", e.message);
    }
  }

  // `alter: true` em cada arranque pode alterar ou apagar colunas em produção.
  // Fica ligado apenas em desenvolvimento; em produção usa-se sync() normal e
  // as migrações explícitas de migrarMysql.js. Pode ser forçado com
  // DB_SYNC_ALTER=true (apenas para uma migração pontual e controlada).
  const syncAlter =
    process.env.DB_SYNC_ALTER === "true" ||
    (process.env.DB_SYNC_ALTER !== "false" && process.env.NODE_ENV !== "production");
  try {
    await sequelize.sync(syncAlter ? { alter: true } : {});
    console.log(`Base de dados sincronizada (alter=${syncAlter})`);
  } catch (e) {
    console.error("Erro no sync da base de dados:", e.message);
    // Tentar novamente sem alterar em caso de conflito de FK
    await sequelize.sync();
  }

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
