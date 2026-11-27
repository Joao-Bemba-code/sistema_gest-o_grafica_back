const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const MetaUnidade = sequelize.define("meta_unidade", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  unidade: { type: DataTypes.STRING(10), allowNull: false },
  mes: { type: DataTypes.DATEONLY, allowNull: false },
  meta_mensal: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [
    { unique: true, fields: ["organizacao_id", "unidade", "mes"], name: "meta_unidade_uk" },
  ],
});

module.exports = MetaUnidade;
