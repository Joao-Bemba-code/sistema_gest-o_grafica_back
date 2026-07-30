const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Usuario = sequelize.define("usuario", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  nome: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: { name: "usuario_email_uk" } },
  senha: { type: DataTypes.STRING(255), allowNull: false },
  funcao: { type: DataTypes.STRING(50), defaultValue: "operador" },
  avatar_url: { type: DataTypes.STRING(500) },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = Usuario;
