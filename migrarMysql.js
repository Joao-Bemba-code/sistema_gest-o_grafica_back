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
  await adicionar("categoria", "validade_dias", "INT NULL");
  await adicionar("categoria", "data_validade", "DATE NULL");
  await adicionar("material", "especificacoes", "JSON NULL");
  await adicionar("material", "localizacao", "VARCHAR(100) NULL");
  await adicionar("material", "lucro", "DECIMAL(5,2) NULL DEFAULT 0");
  await adicionar("material", "mover_estoque", "TINYINT(1) NOT NULL DEFAULT 1");

  // Dados bancários da organização impressos nos PDFs (orçamentos e faturas).
  await adicionar("organizacao", "banco_nome", "VARCHAR(150) NULL");
  await adicionar("organizacao", "banco_iban", "VARCHAR(50) NULL");
  await adicionar("organizacao", "banco_conta", "VARCHAR(50) NULL");

  // Histórico de mudanças de estado das máquinas (JSON: [{estado,data,motivo}])
  await adicionar("maquina", "historico_estados", "JSON NULL");

  // Equipamentos por defeito não movimentam estoque (permanecem como registo/máquina).
  await sequelize.query(
    `UPDATE material m
     JOIN categoria c ON c.id = m.categoria_id
     SET m.mover_estoque = 0
     WHERE c.familia = 'equipamentos' OR c.tipo = 'equipamentos'`
  );
  console.log("MIGRAÇÃO: equipamentos passaram a não mover estoque");
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

  // Máquina usada, erros e perdas registados no processo de acabamento.
  await adicionar("acabamento", "maquina", "VARCHAR(100) NULL");
  await adicionar("acabamento", "erros", "INT NOT NULL DEFAULT 0");
  await adicionar("acabamento", "perdas", "INT NOT NULL DEFAULT 0");
  await adicionar("acabamento", "tempo_estimado", "VARCHAR(20) NULL");
  await adicionar("impressao", "tempo_estimado", "VARCHAR(20) NULL");

  // Controlo de acesso: perfil (papel) e permissões por utilizador.
  await adicionar("usuario", "perfil", "VARCHAR(50) NULL");
  await adicionar("usuario", "permissoes", "JSON NULL");

  // Utilizadores já existentes mantêm acesso total (perfil administrador) para
  // não bloquear ninguém na primeira migração; o admin ajusta depois os perfis.
  await sequelize.query(`UPDATE usuario SET perfil = 'admin' WHERE perfil IS NULL OR perfil = ''`);
  console.log("MIGRAÇÃO: utilizadores existentes passaram a perfil 'admin'");

  // Auditoria de acessos: registo de tentativas de login (sucesso/falha) e dados
  // do dispositivo/IP de onde foi feito o acesso. A tabela é criada pela sync().
  await adicionar("login_log", "user_agent", "VARCHAR(500) NULL");

  // Histórico de processos/operações registados por ordem de produção.
  await adicionar("ordem_producao", "historico_processos", "JSON NULL");

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

  // Cobrança proporcional de folha por encaixe no orçamento (ex.: usar A7 numa A4).
  await adicionar("orcamento_material", "usar_parcial", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "formato_final", "VARCHAR(50) NULL");
  await adicionar("orcamento_material", "largura_final", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "altura_final", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "pecas_por_folha", "INT NOT NULL DEFAULT 1");
  await adicionar("orcamento_material", "preco_folha", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "formato", "VARCHAR(50) NULL");
  await adicionar("orcamento_material", "largura_mm", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "altura_mm", "DECIMAL(8,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "quantidade_folhas", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "quantidade_pecas", "DECIMAL(12,2) NOT NULL DEFAULT 0");
  await adicionar("orcamento_material", "tipo_material", "VARCHAR(20) NOT NULL DEFAULT 'material'");

  // Impressão / toner: nº de folhas a imprimir e o material de toner usado.
  await adicionar("orcamento_item", "folhas_impressao", "INT NOT NULL DEFAULT 0");
  await adicionar("orcamento_item", "toner_material_id", "INT NULL");
  await adicionar("orcamento_item", "toner_custo_unit", "DECIMAL(8,4) NOT NULL DEFAULT 0");

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

  // Campo Família do Novo Recurso passou a ser editável (permite criar novas
  // famílias em texto livre). Deixa de ser ENUM de valores fixos para aceitar
  // qualquer família nova escrita pelo utilizador em produção.
  const catFamEnum = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'familia'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (catFamEnum.length) {
    console.log("MIGRAÇÃO: categoria.familia é actualmente:", catFamEnum[0].COLUMN_TYPE);
  }
  if (catFamEnum.length && catFamEnum[0].COLUMN_TYPE.includes("ENUM")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query("ALTER TABLE `categoria` MODIFY `familia` VARCHAR(50) NOT NULL DEFAULT 'papeis'");
      console.log("MIGRAÇÃO: categoria.familia alterado de ENUM para VARCHAR(50)");
    } catch (e) {
      console.error("MIGRAÇÃO: erro ao alterar categoria.familia", e.message);
    }
  } else {
    console.log("MIGRAÇÃO: categoria.familia já é VARCHAR (nada a fazer)");
  }

  await adicionar("movimento_estoque", "material_destino_id", "INT NULL");

  const catTipoRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'categoria' AND COLUMN_NAME = 'tipo'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (catTipoRef.length && catTipoRef[0].COLUMN_TYPE.includes("ENUM")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query("ALTER TABLE `categoria` MODIFY `tipo` VARCHAR(50) NOT NULL DEFAULT 'materia_prima'");
      console.log("MIGRAÇÃO: categoria.tipo alterado de ENUM para VARCHAR(50)");
    } catch (e) {
      console.error("MIGRAÇÃO: erro ao alterar categoria.tipo", e.message);
    }
  }

  const movTipoRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'movimento_estoque' AND COLUMN_NAME = 'tipo'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (movTipoRef.length && !movTipoRef[0].COLUMN_TYPE.includes("transferencia")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query(
        "ALTER TABLE `movimento_estoque` MODIFY `tipo` ENUM('entrada','saida','transferencia','perda','desperdicio') NOT NULL DEFAULT 'entrada'"
      );
      console.log("MIGRAÇÃO: movimento_estoque.tipo inclui transferencia, perda, desperdicio");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: movimento_estoque.tipo actualizado");
      } else throw e;
    }
  }

  // Requisição de materiais em duas fases: produção submete (requisitada) e
  // a gestão/admin aprova (libertada). Adiciona o estado 'requisitada' ao ENUM.
  const reqEstRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ordem_producao' AND COLUMN_NAME = 'requisicao_estado'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (reqEstRef.length && !reqEstRef[0].COLUMN_TYPE.includes("requisitada")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query(
        "ALTER TABLE `ordem_producao` MODIFY `requisicao_estado` ENUM('pendente','requisitada','libertada') NOT NULL DEFAULT 'pendente'"
      );
      console.log("MIGRAÇÃO: ordem_producao.requisicao_estado inclui 'requisitada'");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: ordem_producao.requisicao_estado actualizado");
      } else throw e;
    }
  }

  // Dados da requisição de materiais retidos na ordem de produção.
  await adicionar("ordem_producao", "solicitado_por", "VARCHAR(200) NULL");
  await adicionar("ordem_producao", "permitido_por", "VARCHAR(200) NULL");
  await adicionar("ordem_producao", "observacoes_requisicao", "TEXT NULL");

  // ============================================================
  // TESOURARIA + CONTAS BANCÁRIAS
  // As tabelas (conta_bancaria, tesouraria_movimento) são criadas pelo
  // sequelize.sync() no arranque; aqui garantimos colunas/fks extra se faltarem.
  // ============================================================

  // Conta bancária associada à fatura (onde o pagamento foi recebido).
  await adicionar("faturacao", "conta_bancaria_id", "INT NULL");

  // Colunas de conveniência da tesouraria (evitam depender só do sync).
  const addContaColumnIfMissing = async (tab, col, def) => {
    const cols = await sequelize.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tab}' AND COLUMN_NAME = '${col}'`,
      { type: sequelize.QueryTypes.SELECT }
    );
    if (!cols.length) {
      try {
        await sequelize.query(`ALTER TABLE \`${tab}\` ADD COLUMN \`${col}\` ${def}`);
        console.log(`MIGRAÇÃO: ${tab}.${col} adicionada (tesouraria)`);
      } catch (e) {
        console.log(`MIGRAÇÃO: ${tab}.${col} — ${e.message}`);
      }
    }
  };
  await addContaColumnIfMissing("tesouraria_movimentos", "metodo_pagamento", "VARCHAR(50) NULL");
  const tesCr = await sequelize.query(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('contas_bancarias','tesouraria_movimentos')",
    { type: sequelize.QueryTypes.SELECT }
  );
  console.log(
    `MIGRAÇÃO: tabelas tesouraria presentes: ${tesCr[0]?.c ?? 0}/2` +
      (tesCr[0]?.c === 2 ? " (prontas)" : " (criadas automaticamente pelo sync)")
  );
}


module.exports = { aplicarMigracoesMysql };
