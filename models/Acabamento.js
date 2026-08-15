const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Acabamento = sequelize.define("acabamento", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ordem_producao_id: { type: DataTypes.INTEGER },
  servico: { type: DataTypes.STRING(100) },
  estado: { type: DataTypes.ENUM("pendente", "em_execucao", "concluido"), defaultValue: "pendente" },
  observacoes: { type: DataTypes.TEXT },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = Acabamento;
