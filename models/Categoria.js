const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Categoria = sequelize.define("categoria", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(100), allowNull: false },
  tipo: { type: DataTypes.ENUM("material", "servico", "produto"), defaultValue: "material" },
  grupo: {
    type: DataTypes.ENUM("papel", "insumo", "acabamento", "produto"),
    defaultValue: "papel",
  },
});

module.exports = Categoria;
