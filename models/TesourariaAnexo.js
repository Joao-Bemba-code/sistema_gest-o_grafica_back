const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Ficheiros anexados a movimentos de tesouraria (recibos de pagamento, comprovativos).
// Os ficheiros são guardados em disco (pasta uploads/tesouraria) e aqui fica apenas
// a referência (nome original, caminho, tipo e tamanho).
const TesourariaAnexo = sequelize.define("tesouraria_anexo", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  movimento_id: { type: DataTypes.INTEGER, allowNull: false },
  nome_original: { type: DataTypes.STRING(255), allowNull: false },
  caminho: { type: DataTypes.STRING(500), allowNull: false },
  mime: { type: DataTypes.STRING(100), allowNull: false },
  tamanho: { type: DataTypes.INTEGER, defaultValue: 0 },
});

module.exports = TesourariaAnexo;
