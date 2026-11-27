const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const ReuniaoSemanal = sequelize.define("reuniao_semanal", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(30), allowNull: false },
  data_reuniao: { type: DataTypes.DATEONLY, allowNull: false },
  pauta: { type: DataTypes.STRING(300), allowNull: false },
  leads: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  visitas: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  estado: { type: DataTypes.ENUM("aberta", "fechada"), allowNull: false, defaultValue: "aberta" },
  usuario_id: { type: DataTypes.INTEGER, allowNull: false },
}, {
  indexes: [
    { unique: true, fields: ["organizacao_id", "codigo"], name: "reuniao_semanal_codigo_uk" },
  ],
});

module.exports = ReuniaoSemanal;
