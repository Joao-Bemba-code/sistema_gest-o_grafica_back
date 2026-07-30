require("dotenv").config();
const { sequelize } = require("./models/index.js");

(async () => {
  try {
    await sequelize.query("ALTER TABLE faturacao MODIFY COLUMN tipo ENUM('fatura','recibo','proforma','nota_credito','factura_recibo') NOT NULL DEFAULT 'fatura'");
    console.log("ENUM faturacao.tipo atualizado com factura_recibo");
    await sequelize.query("ALTER TABLE ordem_producao ADD COLUMN requisicao_estado ENUM('pendente','libertada') NOT NULL DEFAULT 'pendente' AFTER estado");
    console.log("coluna ordem_producao.requisicao_estado adicionada");
    const cols = await sequelize.query("SHOW COLUMNS FROM ordem_producao LIKE 'requisicao_estado'", { type: sequelize.QueryTypes.SELECT });
    console.log("coluna requisicao_estado presente:", cols.length > 0);
  } catch (e) {
    console.error("ERRO:", e.message);
  } finally {
    await sequelize.close();
  }
})();
