const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Contas do painel de suporte técnico. Separadas dos utilizadores das
// organizações: nunca aparecem no SIGRAF nem partilham sessão.
const SuporteUsuario = sequelize.define("suporte_usuario", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  nome: { type: DataTypes.STRING(150), allowNull: false },
  email: { type: DataTypes.STRING(100), allowNull: false, unique: { name: "suporte_usuario_email_uk" } },
  senha: { type: DataTypes.STRING(255), allowNull: false },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: true },
});

module.exports = SuporteUsuario;
