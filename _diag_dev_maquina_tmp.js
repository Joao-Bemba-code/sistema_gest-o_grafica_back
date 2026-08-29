require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const c = await mysql.createConnection({
    host: process.env.Database_Host || "localhost",
    port: Number(process.env.Database_Port) || 3306,
    user: process.env.Database_User,
    password: process.env.Database_Pass,
    database: process.env.Database_Name,
    ssl: { rejectUnauthorized: false },
  });

  const [cols] = await c.query(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='maquina' ORDER BY ORDINAL_POSITION"
  );
  console.log("=== schema maquina (DEV) ===");
  cols.forEach((c) => console.log(`  ${c.COLUMN_NAME}: ${c.COLUMN_TYPE} nullable=${c.IS_NULLABLE} default=${c.COLUMN_DEFAULT}`));

  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});