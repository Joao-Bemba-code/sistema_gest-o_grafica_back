const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const RequisicaoMaterial = sequelize.define("requisicao_material", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  numero: { type: DataTypes.STRING(20), allowNull: false },
  // A requisição nasce sempre de uma ordem de produção. Fica nulo apenas em
  // registos antigos, anteriores a esta regra.
  ordem_producao_id: { type: DataTypes.INTEGER, allowNull: true },
  // Nulo quando é consumo interno / material acabado (não há cliente).
  cliente_id: { type: DataTypes.INTEGER, allowNull: true },
  cliente_nome: { type: DataTypes.STRING(200), allowNull: false },
  // pendente -> aprovada | rejeitada ; aprovada -> consumida
  estado: {
    type: DataTypes.ENUM("pendente", "aprovada", "rejeitada", "cancelada", "consumida"),
    defaultValue: "pendente",
  },
  observacoes: { type: DataTypes.TEXT },
  solicitado_por: { type: DataTypes.STRING(200) },
  aprovado_por: { type: DataTypes.STRING(200) },
  // Preenchidos pelo Estoque ao aprovar: quem preparou a recolha, quem a
  // entregou, quem a recebeu e quando é que o material saiu fisicamente
  // (data e hora). Registos antigos ficam com estes campos vazios — só a
  // aprovação nova é que passa a exigir a informação.
  preparado_por: { type: DataTypes.STRING(200) },
  entregue_por: { type: DataTypes.STRING(200) },
  recebido_por: { type: DataTypes.STRING(200) },
  entregue_em: { type: DataTypes.DATE },
  data_requisicao: { type: DataTypes.DATE },
  data_aprovacao: { type: DataTypes.DATE },
  motivo_rejeicao: { type: DataTypes.STRING(400) },
  total_itens: { type: DataTypes.INTEGER, defaultValue: 0 },
  usuario_id: { type: DataTypes.INTEGER },
  deleted: { type: DataTypes.BOOLEAN, defaultValue: false },
  deletedAt: { type: DataTypes.DATE, allowNull: true },
}, {
  defaultScope: { where: { deleted: false } },
});

module.exports = RequisicaoMaterial;
