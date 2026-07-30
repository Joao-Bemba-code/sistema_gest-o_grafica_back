const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.Database_Name || "sgg",
  process.env.Database_User || "root",
  process.env.Database_Pass || "1234",
  {
    host: process.env.Host || "localhost",
    dialect: process.env.Lang || "mysql",
    logging: false,
    define: {
      freezeTableName: true,
      timestamps: true,
    },
  }
);

module.exports = sequelize;
