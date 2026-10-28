const { DataTypes } = require("sequelize");
const sequelize = require("../config");

// Configuração AGT de cada empresa: credenciais de contribuinte (senha e
// chave privada do contribuinte) ficam cifradas. Os campos da certificação
// do software (SAVES) são globais e vivem no .env.
const AgtConfiguracao = sequelize.define("agt_configuracao", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  ativo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  ambiente: { type: DataTypes.STRING(20), allowNull: false, defaultValue: "homologacao" },
  username: { type: DataTypes.STRING(120), allowNull: true },
  senha_cifrada: { type: DataTypes.TEXT, allowNull: true },
  nif: { type: DataTypes.STRING(30), allowNull: true },
  establishment: { type: DataTypes.STRING(200), allowNull: true, defaultValue: "SEDE" },
  eac_code: { type: DataTypes.STRING(30), allowNull: true },
  taxpayer_key_cifrada: { type: DataTypes.TEXT, allowNull: true },
  iva_default: { type: DataTypes.FLOAT, allowNull: true, defaultValue: 14 },
});

module.exports = AgtConfiguracao;
