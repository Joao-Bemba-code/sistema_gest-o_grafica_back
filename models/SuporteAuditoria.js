const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Registo imutável das acções efectuadas no painel de suporte
// (quem fez, o quê, quando e a partir de que IP).
const SuporteAuditoria = sequelize.define("suporte_auditoria", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  suporte_usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  acao: { type: DataTypes.STRING(50), allowNull: false },
  alvo_tipo: { type: DataTypes.STRING(30), allowNull: true },
  alvo_id: { type: DataTypes.INTEGER, allowNull: true },
  detalhe: { type: DataTypes.TEXT("long"), allowNull: true },
  ip: { type: DataTypes.STRING(60), allowNull: true },
});

module.exports = SuporteAuditoria;
