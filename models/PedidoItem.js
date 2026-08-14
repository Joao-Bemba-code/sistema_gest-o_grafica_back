const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const PedidoItem = sequelize.define("pedido_item", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  pedido_id: { type: DataTypes.INTEGER, allowNull: false },
  material_id: { type: DataTypes.INTEGER },
  material_codigo: { type: DataTypes.STRING(50) },
  material_nome: { type: DataTypes.STRING(200), allowNull: false },
  unidade: { type: DataTypes.STRING(20), defaultValue: "un" },
  quantidade: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
  preco_unit: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  quantidade_recebida: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0 },
});

module.exports = PedidoItem;
