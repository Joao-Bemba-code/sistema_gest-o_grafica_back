const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Cliente = sequelize.define("cliente", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(30) },
  tipo: { type: DataTypes.ENUM("cliente", "fornecedor"), defaultValue: "cliente" },
  nome: { type: DataTypes.STRING(200), allowNull: false },
  empresa: { type: DataTypes.STRING(200) },
  nif: { type: DataTypes.STRING(20) },
  telefone: { type: DataTypes.STRING(20) },
  whatsapp: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(100) },
  endereco: { type: DataTypes.TEXT },
  data_cadastro: { type: DataTypes.DATEONLY },
  observacoes: { type: DataTypes.TEXT },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Cliente;
