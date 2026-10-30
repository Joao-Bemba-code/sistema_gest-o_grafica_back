const path = require("path");
const { Sequelize } = require("sequelize");
require("dotenv").config();

const define = {
  freezeTableName: true,
  timestamps: true,
};
const dialect = (process.env.Lang || "mysql").toLowerCase();

// Em produção não se arranca com credenciais por omissão (root/1234) nem sem
// segredo JWT: seria uma porta aberta silenciosa.
if (process.env.NODE_ENV === "production") {
  const obrigatorias = ["SECRET", "Database_Name", "Database_User", "Database_Pass"];
  const faltam = obrigatorias.filter((nome) => !process.env[nome]);
  if (faltam.length) {
    throw new Error(
      `Configuração em falta no ambiente de produção: ${faltam.join(", ")}`
    );
  }
}

// Um token de suporte nunca pode ser confundido com um token da aplicação.
// Se os dois segredos forem iguais, um token de suporte passaria a ser válido
// no SIGRAF (e vice-versa), por isso o arranque falha de forma explícita.
if (
  process.env.SECRET &&
  process.env.SECRET_SUPORTE &&
  process.env.SECRET === process.env.SECRET_SUPORTE
) {
  throw new Error("SECRET e SECRET_SUPORTE não podem ser iguais: use segredos distintos.");
}

// Segredos curtos são fáceis de adivinhar/forçar offline.
for (const nome of ["SECRET", "SECRET_SUPORTE"]) {
  const valor = process.env[nome];
  if (valor && valor.length < 32) {
    console.warn(`[segurança] ${nome} tem menos de 32 caracteres; use um valor aleatório mais longo.`);
  }
}

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
        process.env.Ssl === "false"
          ? {}
          : {
              ssl: {
                require: true,
                // Valida o certificado do servidor por omissão (M3 do relatório).
                // Só desligar com DB_TLS_INSECURE=true, p. ex. servidor próprio
                // com certificado auto-assinado.
                rejectUnauthorized: process.env.DB_TLS_INSECURE !== "true",
              },
            },
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
