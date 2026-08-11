const path = require("path");
const { Sequelize } = require("sequelize");
require("dotenv").config();

const define = {
  freezeTableName: true,
  timestamps: true,
};
const dialect = (process.env.Lang || "mysql").toLowerCase();

let sequelize;
if (dialect === "sqlite") {
  sequelize = new Sequelize({
    dialect: "sqlite",
    storage: process.env.Sqlite_File || path.join(__dirname, "..", "sgg.sqlite"),
    logging: false,
    define,
  });
} else {
  sequelize = new Sequelize(
    process.env.Database_Name || "sgg",
    process.env.Database_User || "root",
    process.env.Database_Pass || "1234",
    {
      host: process.env.Host || "localhost",
      port: parseInt(process.env.Database_Port, 10) || 3306,
      dialect: "mysql",
      logging: false,
      define,
      dialectOptions:
        process.env.Ssl === "false" ? {} : { ssl: { require: true, rejectUnauthorized: false } },
    }
  );
}

if (dialect === "sqlite") {
  sequelize.afterConnect((connection) => {
    if (connection && typeof connection.run === "function") {
      connection.run("PRAGMA busy_timeout = 5000");
    }
  });
}

module.exports = sequelize;
