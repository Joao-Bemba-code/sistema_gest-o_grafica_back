const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Ficheiros anexados a movimentos de tesouraria (recibos de pagamento, comprovativos).
// O conteúdo é guardado na base de dados (conteudo) para sobreviver a redeploys —
// o disco do Render é efémero. A coluna caminho ficou apenas por compatibilidade
// com registos antigos.
const TesourariaAnexo = sequelize.define("tesouraria_anexo", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  movimento_id: { type: DataTypes.INTEGER, allowNull: false },
  nome_original: { type: DataTypes.STRING(255), allowNull: false },
  caminho: { type: DataTypes.STRING(500), allowNull: true },
  mime: { type: DataTypes.STRING(100), allowNull: false },
  tamanho: { type: DataTypes.INTEGER, defaultValue: 0 },
  conteudo: { type: DataTypes.BLOB("long"), allowNull: true },
});

module.exports = TesourariaAnexo;
