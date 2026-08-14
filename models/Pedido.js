const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const Pedido = sequelize.define("pedido", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(20), allowNull: false },
  fornecedor_id: { type: DataTypes.INTEGER },
  fornecedor_nome: { type: DataTypes.STRING(200), allowNull: false },
  estado: { type: DataTypes.STRING(20), defaultValue: "enviado" },
  observacoes: { type: DataTypes.TEXT },
  solicitado_por: { type: DataTypes.STRING(200) },
  data_pedido: { type: DataTypes.DATE },
  data_recebimento: { type: DataTypes.DATE },
  total: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  usuario_id: { type: DataTypes.INTEGER },
});

module.exports = Pedido;
