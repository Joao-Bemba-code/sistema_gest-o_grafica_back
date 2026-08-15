const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const ReservaEstoque = sequelize.define("reserva_estoque", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ordem_producao_id: { type: DataTypes.INTEGER, allowNull: false },
  material_id: { type: DataTypes.INTEGER, allowNull: false },
  quantidade_reservada: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  quantidade_consumida: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  estado: {
    type: DataTypes.ENUM("ativa", "parcial", "consumida", "cancelada"),
    defaultValue: "ativa",
  },
  lote: { type: DataTypes.STRING(100) },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = ReservaEstoque;
