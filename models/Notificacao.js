const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Notificacao = sequelize.define("notificacao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: {
    type: DataTypes.ENUM("estoque", "producao", "comercial", "sistema"),
    allowNull: false,
    defaultValue: "sistema",
  },
  nivel: {
    type: DataTypes.ENUM("info", "success", "warning", "error"),
    allowNull: false,
    defaultValue: "info",
  },
  icone: { type: DataTypes.STRING(50), defaultValue: "notifications" },
  titulo: { type: DataTypes.STRING(255), allowNull: false },
  descricao: { type: DataTypes.TEXT },
  link: { type: DataTypes.STRING(255) },
  lida: { type: DataTypes.BOOLEAN, defaultValue: false },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
  tableName: "notificacao",
});

module.exports = Notificacao;
