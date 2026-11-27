const { DataTypes } = require("sequelize");
const sequelize = require("../config");

const AcaoSemanal = sequelize.define("acao_semanal", {
  id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
  organizacao_id: { type: DataTypes.INTEGER, allowNull: false },
  ata_id: { type: DataTypes.INTEGER, allowNull: false },
  descricao: { type: DataTypes.STRING(400), allowNull: false },
  responsavel_id: { type: DataTypes.INTEGER },
  responsavel_nome: { type: DataTypes.STRING(150), allowNull: false },
  prazo: { type: DataTypes.DATEONLY },
  estado: { type: DataTypes.ENUM("em_curso", "concluida", "pendente", "sem_prazo"), allowNull: false, defaultValue: "pendente" },
  criado_por: { type: DataTypes.INTEGER, allowNull: false },
  atualizado_por: { type: DataTypes.INTEGER },
});

module.exports = AcaoSemanal;
