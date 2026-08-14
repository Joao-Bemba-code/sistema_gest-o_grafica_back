const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const ConfiguracaoEmail = sequelize.define("configuracao_email", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ativo: { type: DataTypes.BOOLEAN, defaultValue: false },
  smtp_host: { type: DataTypes.STRING(200) },
  smtp_port: { type: DataTypes.INTEGER, defaultValue: 587 },
  smtp_user: { type: DataTypes.STRING(200) },
  smtp_senha: { type: DataTypes.STRING(300) },
  email_remetente: { type: DataTypes.STRING(200) },
  email_nome: { type: DataTypes.STRING(200) },
});

module.exports = ConfiguracaoEmail;
