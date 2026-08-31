const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Registo de tentativas de login (sucesso/falha) para auditoria de acessos.
const LoginLog = sequelize.define("login_log", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: true },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  email: { type: DataTypes.STRING(100), allowNull: false },
  sucesso: { type: DataTypes.BOOLEAN, defaultValue: false },
  ip: { type: DataTypes.STRING(60) },
  user_agent: { type: DataTypes.STRING(500) },
});

module.exports = LoginLog;
