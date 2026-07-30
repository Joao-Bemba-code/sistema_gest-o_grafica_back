const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Fornecedor = sequelize.define("fornecedor", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  contato: { type: DataTypes.STRING(200) },
  telefone: { type: DataTypes.STRING(30) },
  email: { type: DataTypes.STRING(200) },
});

module.exports = Fornecedor;