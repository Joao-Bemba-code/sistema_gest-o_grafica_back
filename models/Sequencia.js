const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Sequencia = sequelize.define("sequencia", {
  organizacao_id: { type: DataTypes.INTEGER, primaryKey: true },
  numero: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  timestamps: false,
});

module.exports = Sequencia;
