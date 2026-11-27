const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const FechoDiario = sequelize.define("fecho_diario", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  data_referencia: { type: DataTypes.DATEONLY, allowNull: false },
  unidade: { type: DataTypes.STRING(10), allowNull: false },
  receita_faturada: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  entrada_caixa_banco: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  ocorrencias: { type: DataTypes.TEXT },
  conciliado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [
    { unique: true, fields: ["organizacao_id", "data_referencia", "unidade"], name: "fecho_diario_uk" },
  ],
});

module.exports = FechoDiario;
