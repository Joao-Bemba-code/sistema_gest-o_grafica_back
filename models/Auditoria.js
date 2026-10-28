const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Registo imutável de acções sensíveis feitas dentro de cada empresa
// (quem fez, o quê, sobre que registo, quando e a partir de que IP).
const Auditoria = sequelize.define("auditoria", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  acao: { type: DataTypes.STRING(60), allowNull: false },
  alvo_tipo: { type: DataTypes.STRING(30), allowNull: true },
  alvo_id: { type: DataTypes.INTEGER, allowNull: true },
  detalhe: { type: DataTypes.TEXT, allowNull: true },
  ip: { type: DataTypes.STRING(60), allowNull: true },
});

module.exports = Auditoria;
