const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Seguranca = sequelize.define("seguranca", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  tfa_ativo: { type: DataTypes.BOOLEAN, defaultValue: false },
  forcar_senha: { type: DataTypes.BOOLEAN, defaultValue: true },
  bloqueio_bruta: { type: DataTypes.BOOLEAN, defaultValue: true },
  sessao_inativa: { type: DataTypes.BOOLEAN, defaultValue: false },
});

module.exports = Seguranca;
