require("dotenv").config();

const mysql = require("mysql2/promise");

// ============================================================
// Migrações SQL (antes em migrations/*.sql), incorporadas aqui para
// que todo o esquema seja aplicado a partir de um único ficheiro.
// ============================================================
const MIGRACOES_SQL = [
    ["20260904_01_criar_contas_bancarias.sql", "-- ============================================================\n-- Migração: Criar tabela de Contas Bancárias\n-- Data: 2026-09-04\n-- ============================================================\n\nCREATE TABLE IF NOT EXISTS `contas_bancarias` (\n  `id` INT NOT NULL AUTO_INCREMENT,\n  `organizacao_id` INT NOT NULL,\n  `banco_nome` VARCHAR(150) NOT NULL,\n  `banco_codigo` VARCHAR(20) DEFAULT NULL,\n  `agencia` VARCHAR(50) DEFAULT NULL,\n  `numero_conta` VARCHAR(50) DEFAULT NULL,\n  `iban` VARCHAR(50) DEFAULT NULL,\n  `moeda` VARCHAR(10) DEFAULT 'AOA',\n  `tipo_conta` ENUM('corrente','poupanca','caixa','investimento') DEFAULT 'corrente',\n  `saldo_inicial` DECIMAL(12,2) DEFAULT 0.00,\n  `saldo_atual` DECIMAL(12,2) DEFAULT 0.00,\n  `titular` VARCHAR(200) DEFAULT NULL,\n  `observacoes` TEXT DEFAULT NULL,\n  `favorita` TINYINT(1) DEFAULT 0,\n  `ativo` TINYINT(1) DEFAULT 1,\n  `deleted` TINYINT(1) DEFAULT 0,\n  `deletedAt` DATETIME DEFAULT NULL,\n  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  INDEX `idx_conta_bancaria_organizacao` (`organizacao_id`),\n  INDEX `idx_conta_bancaria_deleted` (`deleted`)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n"],
  ["20260904_02_criar_tesouraria_movimentos.sql", "-- ============================================================\n-- Migração: Criar tabela de Movimentos de Tesouraria\n-- Data: 2026-09-04\n-- ============================================================\n\nCREATE TABLE IF NOT EXISTS `tesouraria_movimentos` (\n  `id` INT NOT NULL AUTO_INCREMENT,\n  `organizacao_id` INT NOT NULL,\n  `conta_bancaria_id` INT DEFAULT NULL,\n  `tipo` ENUM('entrada','saida','transferencia') NOT NULL,\n  `categoria` ENUM(\n    'venda','servico','devolucao',\n    'compra','despesa','salario','imposto','aluguel','utilidades',\n    'transferencia_interna','deposito','levantamento'\n  ) DEFAULT 'venda',\n  `descricao` VARCHAR(300) NOT NULL,\n  `valor` DECIMAL(12,2) NOT NULL,\n  `data_movimento` DATE DEFAULT (CURRENT_DATE),\n  `hora_movimento` TIME DEFAULT NULL,\n  `referencia` VARCHAR(100) DEFAULT NULL,\n  `referencia_tipo` ENUM('fatura','orcamento','recibo','ordem_saida','deposito','outro') DEFAULT NULL,\n  `referencia_id` INT DEFAULT NULL,\n  `cliente_id` INT DEFAULT NULL,\n  `fatura_id` INT DEFAULT NULL,\n  `conta_destino_id` INT DEFAULT NULL,\n  `metodo_pagamento` ENUM('dinheiro','transferencia','deposito','ordem_saida','multicaixa','referencia','cheque') DEFAULT NULL,\n  `comprovativo` VARCHAR(500) DEFAULT NULL,\n  `estado` ENUM('pendente','confirmado','cancelado') DEFAULT 'confirmado',\n  `aprovado_por` INT DEFAULT NULL,\n  `observacoes` TEXT DEFAULT NULL,\n  `usuario_id` INT NOT NULL,\n  `deleted` TINYINT(1) DEFAULT 0,\n  `deletedAt` DATETIME DEFAULT NULL,\n  `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,\n  `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,\n  PRIMARY KEY (`id`),\n  INDEX `idx_tesouraria_organizacao` (`organizacao_id`),\n  INDEX `idx_tesouraria_conta` (`conta_bancaria_id`),\n  INDEX `idx_tesouraria_tipo` (`tipo`),\n  INDEX `idx_tesouraria_data` (`data_movimento`),\n  INDEX `idx_tesouraria_estado` (`estado`),\n  INDEX `idx_tesouraria_deleted` (`deleted`),\n  CONSTRAINT `fk_tesouraria_conta` FOREIGN KEY (`conta_bancaria_id`) REFERENCES `contas_bancarias` (`id`) ON DELETE SET NULL\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n"],
  ["20260904_03_adicionar_conta_bancaria_faturacao.sql", "-- ============================================================\n-- Migração: Adicionar conta_bancaria_id à tabela faturacao\n-- Data: 2026-09-04\n-- ============================================================\n\n-- Verificar se a coluna já existe antes de adicionar\nSET @exists = (\n  SELECT COUNT(*)\n  FROM INFORMATION_SCHEMA.COLUMNS\n  WHERE TABLE_SCHEMA = DATABASE()\n    AND TABLE_NAME = 'faturacao'\n    AND COLUMN_NAME = 'conta_bancaria_id'\n);\n\nSET @sql = IF(@exists = 0,\n  'ALTER TABLE `faturacao` ADD COLUMN `conta_bancaria_id` INT DEFAULT NULL AFTER `metodo_pagamento`',\n  'SELECT \"Coluna conta_bancaria_id já existe na tabela faturacao\"'\n);\n\nPREPARE stmt FROM @sql;\nEXECUTE stmt;\nDEALLOCATE PREPARE stmt;\n\n-- Adicionar índice se não existir\nSET @idxExists = (\n  SELECT COUNT(*)\n  FROM INFORMATION_SCHEMA.STATISTICS\n  WHERE TABLE_SCHEMA = DATABASE()\n    AND TABLE_NAME = 'faturacao'\n    AND INDEX_NAME = 'idx_faturacao_conta_bancaria'\n);\n\nSET @idxSql = IF(@idxExists = 0,\n  'ALTER TABLE `faturacao` ADD INDEX `idx_faturacao_conta_bancaria` (`conta_bancaria_id`)',\n  'SELECT \"Índice já existe\"'\n);\n\nPREPARE stmt2 FROM @idxSql;\nEXECUTE stmt2;\nDEALLOCATE PREPARE stmt2;\n"],
];

// ============================================================
// Migrações JS: colunas/valores acrescentados às models ao longo
// do tempo, correções de ENUM e limpeza de dados antigos.
// ============================================================
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

  // Pessoa de contacto do cliente (responsável directo pelos assuntos).
  await adicionar("cliente", "pessoa_contacto", "VARCHAR(150) NULL");
  await adicionar("cliente", "pessoa_funcao", "VARCHAR(100) NULL");
  await adicionar("cliente", "pessoa_telefone", "VARCHAR(30) NULL");
  await adicionar("cliente", "pessoa_email", "VARCHAR(150) NULL");

  // Ficha de registro de clientes (COM-CLI-01): identidade & unidade de negócio.
  await adicionar("cliente", "tipo_cliente", "VARCHAR(50) NULL");
  await adicionar("cliente", "nome_comercial", "VARCHAR(200) NULL");
  await adicionar("cliente", "segmento", "VARCHAR(100) NULL");
  await adicionar("cliente", "unidade_negocio", "VARCHAR(100) NULL");
  await adicionar("cliente", "unidades_secundarias", "JSON NULL");
  // Contactos principais & endereço.
  await adicionar("cliente", "pais", "VARCHAR(100) NULL");
  await adicionar("cliente", "provincia", "VARCHAR(100) NULL");
  await adicionar("cliente", "municipio", "VARCHAR(100) NULL");
  await adicionar("cliente", "bairro", "VARCHAR(100) NULL");
  await adicionar("cliente", "rua", "VARCHAR(200) NULL");
  await adicionar("cliente", "numero_porta", "VARCHAR(20) NULL");
  // Classificação comercial.
  await adicionar("cliente", "categoria", "VARCHAR(100) NULL");
  await adicionar("cliente", "setor_atividade", "VARCHAR(100) NULL");
  await adicionar("cliente", "fonte_origem", "VARCHAR(100) NULL");
  await adicionar("cliente", "referencia_interna", "VARCHAR(200) NULL");
  // Responsável comercial interno pelo cliente (ficha COM-CLI-01).
  await adicionar("cliente", "responsavel_comercial", "VARCHAR(150) NULL");

  // Histórico de mudanças de estado das máquinas (JSON: [{estado,data,motivo}])
  await adicionar("maquina", "historico_estados", "JSON NULL");

  // Classificação patrimonial dos bens: família, subfamília, grupo e tipo.
  await adicionar("bem", "familia", "VARCHAR(100) NULL");
  await adicionar("bem", "subfamilia", "VARCHAR(100) NULL");
  await adicionar("bem", "grupo", "VARCHAR(100) NULL");
  await adicionar("bem", "tipo", "VARCHAR(100) NULL");

  // Estado do bem: acrescenta 'avariado' ao ENUM.
  const bemEstRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'bem' AND COLUMN_NAME = 'estado'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (bemEstRef.length && !bemEstRef[0].COLUMN_TYPE.includes("avariado")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query(
        "ALTER TABLE `bem` MODIFY `estado` ENUM('ativo','manutencao','abate','avariado') DEFAULT 'ativo'"
      );
      console.log("MIGRAÇÃO: bem.estado inclui 'avariado'");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: bem.estado actualizado");
      } else throw e;
    }
  }

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

  // PIN eletrónico das decisões da Visão Geral (hash bcrypt, nunca texto puro).
  await adicionar("usuario", "pin_hash", "VARCHAR(255) NULL");
  await adicionar("usuario", "pin_atualizado_em", "DATETIME NULL");

  // Revogação de sessões: token_version é incrementado quando a senha, o email
  // ou as permissões mudam.
  await adicionar("usuario", "token_version", "INT NOT NULL DEFAULT 0");

  // O painel de suporte também revoga sessões ao alterar credenciais.
  await adicionar("suporte_usuario", "token_version", "INT NOT NULL DEFAULT 0");

  // NÃO promover automaticamente utilizadores sem perfil a administrador:
  // era uma escalada de privilégios silenciosa. Apenas avisamos para revisão.
  const semPerfil = await sequelize.query(
    `SELECT COUNT(*) AS total FROM usuario WHERE perfil IS NULL OR perfil = ''`,
    { type: sequelize.QueryTypes.SELECT }
  );
  const totalSemPerfil = Number(semPerfil?.[0]?.total || 0);
  if (totalSemPerfil > 0) {
    console.warn(
      `[segurança] ${totalSemPerfil} utilizador(es) sem perfil definido. ` +
        "Atribua um perfil explicitamente; até lá aplica-se o perfil 'producao'."
    );
  }

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
  if (refs.length && !refs[0].COLUMN_TYPE.includes("requisicao_material")) {
    await sequelize.query(
      `ALTER TABLE \`movimento_estoque\` MODIFY \`referencia_tipo\`
       ENUM('manual','op','ajuste','nf_e','reserva','devolucao','pedido','requisicao_material') NOT NULL DEFAULT 'manual'`
    );
    console.log("MIGRAÇÃO: movimento_estoque.referencia_tipo inclui 'requisicao_material'");
  }

  // Requisição de material acabado / consumo interno não tem cliente.
  // A coluna passou a aceitar NULL.
  const reqCliRef = await sequelize.query(
    `SELECT IS_NULLABLE FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'requisicao_material' AND COLUMN_NAME = 'cliente_id'`,
    { type: sequelize.QueryTypes.SELECT }
  );
  if (reqCliRef.length && reqCliRef[0].IS_NULLABLE === "NO") {
    await sequelize.query(
      "ALTER TABLE `requisicao_material` MODIFY `cliente_id` INT NULL"
    );
    console.log("MIGRAÇÃO: requisicao_material.cliente_id aceita NULL");
  }

  // A requisição pode estar ligada a uma OP ou ser avulsa (sem OP). Registos
  // antigos ficam sem OP (NULL) até serem associados manualmente.
  await adicionar("requisicao_material", "ordem_producao_id", "INT NULL");

  // Dois tipos de requisição: 'ordem_producao' e 'sem_ordem'. Classifica o
  // histórico pela presença da OP para não alterar o comportamento antigo.
  await adicionar("requisicao_material", "tipo", "VARCHAR(20) NOT NULL DEFAULT 'ordem_producao'");
  await sequelize.query(
    "UPDATE `requisicao_material` SET `tipo` = 'sem_ordem' WHERE `ordem_producao_id` IS NULL"
  );
  await sequelize.query(
    "UPDATE `requisicao_material` SET `tipo` = 'ordem_producao' WHERE `ordem_producao_id` IS NOT NULL AND (`tipo` IS NULL OR `tipo` = '')"
  );
  console.log("MIGRAÇÃO: requisicao_material.tipo classificado (com OP / sem OP)");

  // Aprovação passa a registar quem preparou, quem entregou e a data/hora da saída.
  await adicionar("requisicao_material", "preparado_por", "VARCHAR(200) NULL");
  await adicionar("requisicao_material", "entregue_por", "VARCHAR(200) NULL");
  await adicionar("requisicao_material", "recebido_por", "VARCHAR(200) NULL");
  await adicionar("requisicao_material", "entregue_em", "DATETIME NULL");

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

  // Limite global de dívida por cliente. 0 (por omissão) = sem bloqueio.
  await adicionar("sistema", "limite_divida_cliente", "DECIMAL(14,2) NOT NULL DEFAULT 0");
  // Prazo global, juro por atraso e desconto por pagamento antecipado.
  await adicionar("sistema", "prazo_divida_dias", "INT NOT NULL DEFAULT 30");
  await adicionar("sistema", "juro_divida_percentual", "DECIMAL(5,2) NOT NULL DEFAULT 0");
  await adicionar("sistema", "desconto_divida_percentual", "DECIMAL(5,2) NOT NULL DEFAULT 0");
  await adicionar("sistema", "desconto_prazo_dias", "INT NOT NULL DEFAULT 0");

  // Compras: crédito do fornecedor e pagamento registado na própria encomenda.
  await adicionar("pedido", "forma_pagamento", "VARCHAR(20) NOT NULL DEFAULT 'a_vista'");
  await adicionar("pedido", "data_vencimento", "DATE NULL");
  await adicionar("pedido", "valor_pago", "DECIMAL(14,2) NOT NULL DEFAULT 0");
  await adicionar("pedido", "data_pagamento", "DATE NULL");
  await adicionar("pedido", "metodo_pagamento", "VARCHAR(50) NULL");
  await adicionar("pedido", "conta_bancaria_id", "INT NULL");

  // Campo Família do Novo Recurso passou a ser editável (permite criar novas
  // famílias em texto livre). Deixa de ser ENUM de valores fixos para aceitar
  // qualquer família nova escrita pelo utilizador em produção. Nunca re-criar
  // o ENUM: isso bloqueia criar categorias com famílias novas (erro
  // "Data truncated for column 'familia'").
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

  // Fatura nasce "em_analise" no Comercial e é validada na Tesouraria:
  // registo de quem aprovou/validou e datas correspondentes.
  await adicionar("faturacao", "aprovado_por", "VARCHAR(200) NULL");
  await adicionar("faturacao", "data_aprovacao", "DATETIME NULL");
  await adicionar("faturacao", "validado_por", "VARCHAR(200) NULL");
  await adicionar("faturacao", "data_validacao", "DATETIME NULL");

  // ENUM do estado da fatura passa a incluir 'em_analise'.
  const fatEstRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'faturacao' AND COLUMN_NAME = 'estado'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (fatEstRef.length && fatEstRef[0].COLUMN_TYPE.includes("ENUM") && !fatEstRef[0].COLUMN_TYPE.includes("em_analise")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query(
        "ALTER TABLE `faturacao` MODIFY `estado` ENUM('em_analise','emitida','paga','parcial','vencida','cancelada') NOT NULL DEFAULT 'em_analise'"
      );
      console.log("MIGRAÇÃO: faturacao.estado inclui 'em_analise'");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: faturacao.estado actualizado");
      } else throw e;
    }
  }

  // Orçamento: desconto e aumento aplicados em percentagem.
  await adicionar("orcamento", "desconto_percentual", "DECIMAL(5,2) NULL DEFAULT 0");
  await adicionar("orcamento", "aumento_percentual", "DECIMAL(5,2) NULL DEFAULT 0");

  // 2FA TOTP das contas do painel de suporte (segredo cifrado na aplicação).
  await adicionar("suporte_usuario", "totp_secret", "TEXT NULL");
  await adicionar("suporte_usuario", "totp_confirmado", "TINYINT(1) NOT NULL DEFAULT 0");

  // A categoria da tesouraria passou a ser texto livre. Converte ENUM para VARCHAR.
  const tesCategoriaRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tesouraria_movimento' AND COLUMN_NAME = 'categoria'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (tesCategoriaRef.length && tesCategoriaRef[0].COLUMN_TYPE.includes("ENUM")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query("ALTER TABLE `tesouraria_movimento` MODIFY `categoria` VARCHAR(100) NULL");
      console.log("MIGRAÇÃO: tesouraria_movimento.categoria alterada de ENUM para VARCHAR(100)");
    } catch (e) {
      console.error("MIGRAÇÃO: erro ao alterar tesouraria_movimento.categoria", e.message);
    }
  }

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
  await addContaColumnIfMissing("tesouraria_movimento", "metodo_pagamento", "VARCHAR(50) NULL");
  const tesCr = await sequelize.query(
    "SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('conta_bancaria','tesouraria_movimento')",
    { type: sequelize.QueryTypes.SELECT }
  );
  console.log(
    `MIGRAÇÃO: tabelas tesouraria presentes: ${tesCr[0]?.c ?? 0}/2` +
      (tesCr[0]?.c === 2 ? " (prontas)" : " (criadas automaticamente pelo sync)")
  );

  // Códigos de artigos de stock passam todos a K + iniciais da categoria (KPO-0001).
  // Idempotente: só muda códigos fora da regra; conformes ficam intactos.
  try {
    const { recodificarMateriaisK } = require("./services/codigoArtigo");
    await recodificarMateriaisK(sequelize);
  } catch (e) {
    console.log(`MIGRAÇÃO: recodificação de artigos — ${e.message}`);
  }

  // Anulação em vez de eliminação (Comercial): clientes, propostas e
  // orçamentos nunca são apagados — ficam anulados com motivo obrigatório.
  await adicionar("cliente", "anulado", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("cliente", "motivo_anulacao", "TEXT NULL");
  await adicionar("cliente", "anulado_por", "VARCHAR(200) NULL");
  await adicionar("cliente", "data_anulacao", "DATETIME NULL");
  await adicionar("proposta", "anulado", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("proposta", "motivo_anulacao", "TEXT NULL");
  await adicionar("proposta", "anulado_por", "VARCHAR(200) NULL");
  await adicionar("proposta", "data_anulacao", "DATETIME NULL");

  // Proposta comercial (COM-PRO-01): emissão, validade, condições e responsável.
  await adicionar("proposta", "data_emissao", "DATE NULL");
  await adicionar("proposta", "validade_data", "DATE NULL");
  await adicionar("proposta", "valor", "DECIMAL(14,2) NOT NULL DEFAULT 0");
  await adicionar("proposta", "condicoes_pagamento", "VARCHAR(200) NULL");
  await adicionar("proposta", "prazo_entrega", "VARCHAR(100) NULL");
  await adicionar("proposta", "responsavel_comercial", "VARCHAR(150) NULL");

  // Proposta comercial expandida (COM-PRO-02): identificação, especificação,
  // condições de entrega e documentos & acessos.
  await adicionar("proposta", "versao", "VARCHAR(20) NULL");
  await adicionar("proposta", "tipo", "VARCHAR(100) NULL");
  await adicionar("proposta", "origem", "VARCHAR(100) NULL");
  await adicionar("proposta", "familia", "VARCHAR(100) NULL");
  await adicionar("proposta", "produto", "VARCHAR(150) NULL");
  await adicionar("proposta", "formato", "VARCHAR(100) NULL");
  await adicionar("proposta", "quantidade", "VARCHAR(100) NULL");
  await adicionar("proposta", "suporte", "VARCHAR(100) NULL");
  await adicionar("proposta", "cores", "VARCHAR(100) NULL");
  await adicionar("proposta", "acabamento", "VARCHAR(150) NULL");
  await adicionar("proposta", "produtos", "JSON NULL");
  await adicionar("proposta", "local_entrega", "VARCHAR(200) NULL");
  await adicionar("proposta", "condicoes_entrega", "VARCHAR(200) NULL");
  await adicionar("proposta", "observacoes", "TEXT NULL");
  await adicionar("proposta", "estado_documental", "VARCHAR(50) NULL");
  await adicionar("proposta", "modelo_documental", "VARCHAR(100) NULL");
  await adicionar("orcamento", "anulado", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("orcamento", "motivo_anulacao", "TEXT NULL");
  await adicionar("orcamento", "anulado_por", "VARCHAR(200) NULL");
  await adicionar("orcamento", "data_anulacao", "DATETIME NULL");
  // Entrega manual de encomendas que não passam por produção.
  await adicionar("orcamento", "entrega_ok", "TINYINT(1) NOT NULL DEFAULT 0");
  await adicionar("orcamento", "data_entrega", "DATE NULL");

  // Estado 'anulado' no ENUM dos orçamentos.
  const orcEstRef = await sequelize.query(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orcamento' AND COLUMN_NAME = 'estado'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (orcEstRef.length && orcEstRef[0].COLUMN_TYPE.includes("ENUM") && !orcEstRef[0].COLUMN_TYPE.includes("anulado")) {
    try {
      await sequelize.query("SET SESSION sql_mode = 'NO_ENGINE_SUBSTITUTION'");
      await sequelize.query(
        "ALTER TABLE `orcamento` MODIFY `estado` ENUM('pendente','aprovado','cancelado','rejeitado','anulado') NOT NULL DEFAULT 'pendente'"
      );
      console.log("MIGRAÇÃO: orcamento.estado inclui 'anulado'");
    } catch (e) {
      if (e.code === "WARN_DATA_TRUNCATED" || e.parent?.code === "WARN_DATA_TRUNCATED") {
        console.log("MIGRAÇÃO: orcamento.estado actualizado");
      } else throw e;
    }
  }

  // Todos os códigos/referências passam a começar com K (inclui registos antigos).
  // Idempotente: códigos já conformes nunca são alterados.
  try {
    const { recodificarCodigosK } = require("./services/recodificarCodigosK");
    await recodificarCodigosK(sequelize);
  } catch (e) {
    console.log(`MIGRAÇÃO: recodificação K dos códigos — ${e.message}`);
  }
}


// Correções de esquema que PRECISAM de correr ANTES do sync({ alter: true }).
// O sync cria as chaves estrangeiras a partir dos modelos; se a tabela antiga
// ainda tiver cliente_id NOT NULL, o MySQL recusa a FK com ON DELETE SET NULL
// (errno 150) e o arranque trava antes de as migrações normais poderem correr.
// Idempotente: em instalação nova o sync cria a tabela já com a coluna NULL.
async function prepararSchemaAntesSync(sequelize) {
  const tabelas = await sequelize.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'requisicao_material'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (!tabelas.length) return; // instalação nova: nada a corrigir

  const col = await sequelize.query(
    "SELECT IS_NULLABLE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'requisicao_material' AND COLUMN_NAME = 'cliente_id'",
    { type: sequelize.QueryTypes.SELECT }
  );
  if (col.length && col[0].IS_NULLABLE === "NO") {
    await sequelize.query(
      "ALTER TABLE `requisicao_material` MODIFY `cliente_id` INT NULL"
    );
    console.log("PRÉ-SYNC: requisicao_material.cliente_id passou a aceitar NULL");
  }
}

// Antes do sync({alter:true}): trata referências a registos pais apagados.
// O alter tenta criar as chaves estrangeiras dos modelos e falha (errno 1452)
// se alguma linha ainda apontar para um registo que já não existe — comum
// depois de sincronizações entre computadores ou restauro de cópias.
// Colunas que aceitam NULL: a referência é anulada (nada se apaga).
// Colunas NOT NULL: apagam-se as linhas órfãs, tal como a FK ON DELETE
// CASCADE faria quando o registo pai foi apagado.
async function limparOrfaosFk(sequelize) {
  for (const nome of Object.keys(sequelize.models)) {
    const modelo = sequelize.models[nome];
    for (const assoc of Object.values(modelo.associations || {})) {
      if (assoc.associationType !== "BelongsTo") continue;
      const tabela = assoc.source.tableName;
      const coluna = assoc.foreignKey;
      const pai = assoc.target.tableName;
      const col = await sequelize
        .query(
          `SELECT IS_NULLABLE FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '${tabela}'
             AND COLUMN_NAME = '${coluna}'`,
          { type: sequelize.QueryTypes.SELECT }
        )
        .catch(() => []);
      if (!col.length) continue;
      try {
        if (col[0].IS_NULLABLE === "YES") {
          const [res] = await sequelize.query(
            `UPDATE \`${tabela}\` SET \`${coluna}\` = NULL
             WHERE \`${coluna}\` IS NOT NULL
               AND \`${coluna}\` NOT IN (SELECT id FROM \`${pai}\`)`
          );
          if (res && res.affectedRows > 0) {
            console.log(`Limpeza: ${tabela}.${coluna} órfãos anulados (${res.affectedRows})`);
          }
        } else {
          const [res] = await sequelize.query(
            `DELETE FROM \`${tabela}\`
             WHERE \`${coluna}\` IS NOT NULL
               AND \`${coluna}\` NOT IN (SELECT id FROM \`${pai}\`)`
          );
          if (res && res.affectedRows > 0) {
            console.log(`Limpeza: ${tabela} órfãos removidos (${res.affectedRows})`);
          }
        }
      } catch (e) {
        console.log(`Limpeza ${tabela}.${coluna} ignorada:`, e.message);
      }
    }
  }
}

// Aplica os ficheiros SQL em uma única ligação: usam variáveis de sessão
// (@sql) e PREPARE/EXECUTE, que se perderiam entre queries do pool.
async function aplicarMigracoesSql(sequelize) {
  if (sequelize.getDialect() !== "mysql") return;

  const cfg = sequelize.config;
  const conexao = await mysql.createConnection({
    host: cfg.host,
    port: cfg.port,
    user: cfg.username,
    password: cfg.password,
    database: cfg.database,
    multipleStatements: true,
    ...(cfg.dialectOptions || {}),
  });

  try {
    for (const [nome, sql] of MIGRACOES_SQL) {
      console.log(`MIGRAÇÃO SQL: ${nome}`);
      try {
        await conexao.query(sql);
        console.log("  OK");
      } catch (e) {
        if (/already exists|duplicate (column|key|entry)/i.test(e.message || "")) {
          console.log("  Já aplicada, ignorando.");
        } else {
          throw e;
        }
      }
    }
  } finally {
    await conexao.end();
  }
}

/**
 * Ponto único de entrada das migrações. Chamado pelo index.js no arranque,
 * antes de o servidor aceitar pedidos. Idempotente: pode correr sempre.
 */
async function executarMigracoes(sequelize) {
  const usaMysql = sequelize.getDialect() === "mysql";

  if (usaMysql) {
    try {
      await prepararSchemaAntesSync(sequelize);
      // Limpar órfãos antes do sync para evitar falha na criação de FKs.
      await sequelize.query(
        `DELETE FROM orcamento_material
         WHERE orcamento_item_id IS NOT NULL
           AND orcamento_item_id NOT IN (SELECT id FROM orcamento_item)`
      );
      await sequelize.query(
        `DELETE FROM orcamento_servico
         WHERE orcamento_id IS NOT NULL
           AND orcamento_id NOT IN (SELECT id FROM orcamento)`
      ).catch(() => {});
      await limparOrfaosFk(sequelize);
    } catch (e) {
      console.error("Erro na preparação pré-sync:", e.message);
    }
  }

  // alter: true em cada arranque pode alterar/apagar colunas em produção.
  // Fica ligado apenas em desenvolvimento, salvo DB_SYNC_ALTER=true.
  const syncAlter =
    process.env.DB_SYNC_ALTER === "true" ||
    (process.env.DB_SYNC_ALTER !== "false" && process.env.NODE_ENV !== "production");
  try {
    await sequelize.sync(syncAlter ? { alter: true } : {});
    console.log(`Base de dados sincronizada (alter=${syncAlter})`);
  } catch (e) {
    console.error("Erro no sync da base de dados:", e.message);
    await sequelize.sync();
  }

  if (usaMysql) {
    await aplicarMigracoesSql(sequelize);
    await aplicarMigracoesMysql(sequelize);
  }

  console.log("MIGRAÇÕES: concluídas.");
}

module.exports = { executarMigracoes };

if (require.main === module) {
  const { sequelize } = require("./models");
  executarMigracoes(sequelize)
    .then(async () => {
      console.log("=== Migrações concluídas com sucesso ===");
      await sequelize.close();
    })
    .catch((e) => {
      console.error("ERRO NAS MIGRAÇÕES:", e);
      process.exit(1);
    });
}
