const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Organizacao = sequelize.define("organizacao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  sigla: { type: DataTypes.STRING(50) },
  nif: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(100) },
  telefone: { type: DataTypes.STRING(20) },
  endereco: { type: DataTypes.TEXT },
  website: { type: DataTypes.STRING(500) },
  template_contrato: { type: DataTypes.TEXT },
  logo_url: { type: DataTypes.STRING(500) },
  banco_nome: { type: DataTypes.STRING(150) },
  banco_iban: { type: DataTypes.STRING(50) },
  banco_conta: { type: DataTypes.STRING(50) },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Organizacao;
