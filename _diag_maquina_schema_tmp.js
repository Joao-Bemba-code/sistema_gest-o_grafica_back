const mysql = require("mysql2/promise");

async function main() {
  const c = await mysql.createConnection({
    host: "gateway01.eu-central-1.prod.aws.tidbcloud.com",
    port: 4000,
    user: "3vW9ZQzp2KZ6jsD.root",
    password: "qFd0dFBMUM637kZq",
    database: "sgg",
    ssl: { rejectUnauthorized: false },
  });

  const [cols] = await c.query(
    "SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='maquina' ORDER BY ORDINAL_POSITION"
  );
  console.log("=== schema maquina ===");
  cols.forEach((c) => console.log(`  ${c.COLUMN_NAME}: ${c.COLUMN_TYPE} nullable=${c.IS_NULLABLE} default=${c.COLUMN_DEFAULT}`));

  // also check if there's a categoria_id FK constraint
  const [fk] = await c.query(
    "SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='maquina' AND REFERENCED_TABLE_NAME IS NOT NULL"
  );
  console.log("=== FKs ===");
  console.log(JSON.stringify(fk, null, 2));

  await c.end();
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});