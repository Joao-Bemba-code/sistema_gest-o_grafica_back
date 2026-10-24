const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Rateio de uma despesa (movimento de tesouraria do tipo saída) por uma ou
// mais ordens de produção. Permite saber quanto custou cada OP sem duplicar
// a despesa: o dinheiro continua a sair uma única vez na tesouraria e aqui
// fica apenas a repartição.
const RateioCusto = sequelize.define("rateio_custo", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  movimento_id: { type: DataTypes.INTEGER, allowNull: false },
  ordem_producao_id: { type: DataTypes.INTEGER, allowNull: false },
  percentagem: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  valor: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
  observacoes: { type: DataTypes.STRING(300) },
  criado_por: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  tableName: "rateio_custos",
  defaultScope: { where: { deleted: false } },
});

module.exports = RateioCusto;
