require("dotenv").config();
const { sequelize } = require("./models/index.js");

// Aplica a migração de categoria.familia (ENUM -> VARCHAR(50)) directamente na
// DB ligada pelo .env (produção/nuvem ou local). Assim não depende do reinício
// do servidor: corre este script e a coluna fica pronta para aceitar novas famílias.
(async () => {
  try {
    const antes = await sequelize.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'familia'",
      { type: sequelize.QueryTypes.SELECT }
    );

    if (!antes.length) {
      console.log("coluna categoria.familia não encontrada");
      return;
    }

    const tipo = antes[0].COLUMN_TYPE;
    console.log("ANTES: categoria.familia =", tipo);

    if (!tipo.includes("ENUM")) {
      console.log("Já está como VARCHAR — nada a fazer.");
      return;
    }

    await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
    await sequelize.query("ALTER TABLE `categoria` MODIFY `familia` VARCHAR(50) NOT NULL DEFAULT 'papeis'");

    const depois = await sequelize.query(
      "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'familia'",
      { type: sequelize.QueryTypes.SELECT }
    );
    console.log("DEPOIS: categoria.familia =", depois[0].COLUMN_TYPE);
    console.log("Migração aplicada com sucesso. Criar categorias com novas famílias já deverá funcionar.");
  } catch (e) {
    console.error("ERRO ao aplicar migração:", e.message);
  } finally {
    await sequelize.close();
  }
})();
