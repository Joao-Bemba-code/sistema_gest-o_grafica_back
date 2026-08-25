async function aplicarMigracoesMysql(sequelize) {
  const adicionar = async (tabela, coluna, definicao) => {
    const existentes = await sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabela}'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (!existentes.some((c) => c.COLUMN_NAME === coluna)) {
      await sequelize.query(
        `ALTER TABLE \`${tabela}\` ADD COLUMN \`${coluna}\` ${definicao}`
      );
      console.log(`MIGRAÇÃO: ${tabela}.${coluna} adicionada`);
    }
  };

  await adicionar("categoria", "familia", "VARCHAR(100) NULL");
  await adicionar("categoria", "subfamilia", "VARCHAR(100) NULL");
  await adicionar("categoria", "tipo", "VARCHAR(100) NULL");
  await adicionar("categoria", "campos_especificacao", "JSON NULL");
  await adicionar("material", "especificacoes", "JSON NULL");
  await adicionar("material", "localizacao", "VARCHAR(100) NULL");
  await adicionar("material", "lucro", "DECIMAL(5,2) NULL DEFAULT 0");
  await adicionar("orcamento", "desconto", "DECIMAL(12,2) NULL DEFAULT 0");
  await adicionar("orcamento", "especificacao_json", "JSON NULL");
  await adicionar("orcamento_item", "composto", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("orcamento_item", "margem", "DECIMAL(12,2) NOT NULL DEFAULT 0");

  // Tombstones (soft-delete) para a sincronização de eliminações entre
  // computadores: as tabelas reais sincronizáveis ganham deleted/deletedAt.
  const tabelasTomb = [
    "cliente",
    "fornecedor",
    "categoria",
    "material",
    "movimento_estoque",
    "orcamento",
    "orcamento_item",
    "orcamento_material",
    "orcamento_servico",
    "ordem_producao",
    "pre_impressao",
    "impressao",
    "acabamento",
    "qualidade",
    "reserva_estoque",
    "faturacao",
    "pedido",
    "pedido_item",
  ];
  for (const t of tabelasTomb) {
    await adicionar(t, "deleted", "TINYINT(1) NOT NULL DEFAULT 0");
    await adicionar(t, "deletedAt", "DATETIME NULL");
  }

  const refs = await sequelize.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'movimento_estoque' AND COLUMN_NAME = 'referencia_tipo'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  if (refs.length && !refs[0].COLUMN_TYPE.includes("pedido")) {
    await sequelize.query(
      `ALTER TABLE \`movimento_estoque\` MODIFY \`referencia_tipo\`
       ENUM('manual','op','ajuste','nf_e','reserva','devolucao','pedido') NOT NULL DEFAULT 'manual'`
    );
    console.log("MIGRAÇÃO: movimento_estoque.referencia_tipo inclui 'pedido'");
  }

  await adicionar("orcamento_servico", "servico_id", "INT NULL");

  const catFamRef = await sequelize.query(
    `SELECT COLUMN_TYPE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'familia'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  if (catFamRef.length && !catFamRef[0].COLUMN_TYPE.includes("impressao")) {
    await sequelize.query(
      `UPDATE categoria SET familia = 'papeis' WHERE familia IS NULL OR familia = ''`
    );
    try {
      await sequelize.query(`SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'`);
      await sequelize.query(
        `ALTER TABLE \`categoria\` MODIFY \`familia\`
         ENUM('papeis','tintas','chapas','produto_quimico','equipamentos','ferramentas','suporte_especial','material_acabamento','consumiveis','impressao','acabamento','pre_impressao','design','montagem','logistica','consultoria','manutencao','servicos_gerais') NOT NULL DEFAULT 'papeis'`
      );
      console.log("MIGRAÇÃO: categoria.familia inclui famílias de serviços");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: categoria.familia actualizado (warnings ignorados)");
      } else {
        throw e;
      }
    }
  }
}

module.exports = { aplicarMigracoesMysql };
