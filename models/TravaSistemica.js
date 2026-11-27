const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const TravaSistemica = sequelize.define("trava_sistemica", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo: { type: DataTypes.STRING(30), allowNull: false },
  entidade: { type: DataTypes.STRING(200), allowNull: false },
  referencia: { type: DataTypes.STRING(100), allowNull: false },
  motivo: { type: DataTypes.STRING(400), allowNull: false },
  exposicao: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  estado: { type: DataTypes.ENUM("bloqueado", "retido_os", "alerta_sla", "regularizado"), allowNull: false, defaultValue: "bloqueado" },
  tipo_regularizacao: { type: DataTypes.STRING(200) },
  valor_liquidado: { type: DataTypes.DECIMAL(14, 2), defaultValue: 0 },
  justificativa: { type: DataTypes.TEXT },
  observacao_acompanhamento: { type: DataTypes.TEXT },
  comprovativo_id: { type: DataTypes.INTEGER },
  criado_por: { type: DataTypes.INTEGER, allowNull: false },
  regularizado_por: { type: DataTypes.INTEGER },
  data_regularizacao: { type: DataTypes.DATE },
  pin_validado_em: { type: DataTypes.DATE },
}, {
  indexes: [
    { unique: true, fields: ["organizacao_id", "codigo"], name: "trava_sistemica_codigo_uk" },
  ],
});

module.exports = TravaSistemica;
