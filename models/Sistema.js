const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Sistema = sequelize.define("sistema", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  idioma: { type: DataTypes.STRING(20), defaultValue: "Português" },
  formato_data: { type: DataTypes.STRING(20), defaultValue: "DD/MM/AAAA" },
  moeda: { type: DataTypes.STRING(20), defaultValue: "Kwanza (AOA)" },
  fuso_horario: { type: DataTypes.STRING(30), defaultValue: "Africa/Luanda (GMT+1)" },
  dias_aviso_ferias: { type: DataTypes.INTEGER, defaultValue: 30 },
  limite_ficheiros: { type: DataTypes.INTEGER, defaultValue: 10 },
});

module.exports = Sistema;
