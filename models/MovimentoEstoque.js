const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const MovimentoEstoque = sequelize.define("movimento_estoque", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  material_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo: { type: DataTypes.ENUM("entrada", "saida"), allowNull: false },
  quantidade: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  referencia_tipo: {
    type: DataTypes.ENUM("manual", "op", "ajuste", "nf_e", "reserva", "devolucao", "pedido"),
    defaultValue: "manual",
  },
  referencia_id: { type: DataTypes.INTEGER },
  lote: { type: DataTypes.STRING(100) },
  data_fabricacao: { type: DataTypes.DATEONLY },
  validade: { type: DataTypes.DATEONLY },
  motivo: { type: DataTypes.STRING(255) },
  observacoes: { type: DataTypes.TEXT },
  cliente_nome: { type: DataTypes.STRING(200) },
  fornecedor_nome: { type: DataTypes.STRING(200) },
  solicitado_por: { type: DataTypes.STRING(200) },
  permitido_por: { type: DataTypes.STRING(200) },
  usuario_id: { type: DataTypes.INTEGER },
});

module.exports = MovimentoEstoque;
