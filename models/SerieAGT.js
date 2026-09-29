const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const SerieAGT = sequelize.define("serie_agt", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  seriesCode: { type: DataTypes.STRING(60), allowNull: false },
  documentType: { type: DataTypes.STRING(2), allowNull: false },
  seriesYear: { type: DataTypes.INTEGER, allowNull: false },
  establishmentNumber: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "SEDE" },
  contingencyIndicator: { type: DataTypes.STRING(1), allowNull: false, defaultValue: "N" },
  firstDocumentNo: { type: DataTypes.STRING(60), allowNull: false },
  lastDocumentNo: { type: DataTypes.STRING(60), allowNull: false },
  nextDocumentNo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.STRING(1), allowNull: false, defaultValue: "A" },
});

module.exports = SerieAGT;