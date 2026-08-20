require("dotenv").config();
const s = require("./config/index.js");
const { aplicarMigracoesMysql } = require("./migrarMysql");

(async () => {
  try {
    const [tabs] = await s.query("SHOW TABLES");
    const nomes = tabs.map((t) => Object.values(t)[0]);
    const alvo = ["cliente","fornecedor","categoria","material","movimento_estoque","orcamento","orcamento_item","orcamento_material","ordem_producao","pre_impressao","impressao","acabamento","qualidade","reserva_estoque","faturacao","pedido","pedido_item"];
    for (const t of alvo) {
      if (!nomes.includes(t)) console.log("FALTA TABELA:", t);
    }
    console.log("tabelas alvo presentes:", alvo.filter((t) => nomes.includes(t)).length, "/", alvo.length);
    await aplicarMigracoesMysql(s);
    const [cols] = await s.query(
      "SELECT TABLE_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND COLUMN_NAME = 'deleted' ORDER BY TABLE_NAME"
    );
    console.log("tabelas com coluna deleted:", cols.map((c) => c.TABLE_NAME).join(", "));
    console.log("MIGRACAO OK");
  } catch (e) {
    console.log("ERRO NA MIGRACAO:", e.message);
    if (e.sql) console.log("SQL:", e.sql);
    process.exitCode = 1;
  } finally {
    await s.close();
  }
})();
