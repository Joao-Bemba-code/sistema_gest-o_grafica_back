const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Servico = sequelize.define("servico", {
  id:              { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id:  { type: DataTypes.INTEGER, allowNull: false },
  nome:            { type: DataTypes.STRING(150), allowNull: false },
  descricao:       { type: DataTypes.TEXT, allowNull: true },
  categoria_id:    { type: DataTypes.INTEGER, allowNull: true },
  valor_hora:      { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  duracao_horas:   { type: DataTypes.DECIMAL(12, 2), defaultValue: 8 },
  mob_padrao:      { type: DataTypes.INTEGER, defaultValue: 1 },
  unidade:         { type: DataTypes.STRING(20), defaultValue: "serviço" },
  ativo:           { type: DataTypes.BOOLEAN, defaultValue: true },
  deleted:         { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt:       { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Servico;
