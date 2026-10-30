const router = require("express").Router();
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const {
  upsert,
  alteracoes,
  sincronizarOrganizacao,
  organizacaoAtual,
  upsertReal,
  alteracoesReal,
} = require("../services/sincronizacao");

router.use(auth);

// Módulo de permissões exigido por cada tabela sincronizável. Sem esta
// verificação qualquer utilizador autenticado (mesmo sem acesso a faturação,
// por exemplo) podia ler e escrever essas tabelas via sincronização.
const MODULO_POR_TABELA = {
  clientes: "comercial",
  cliente: "comercial",
  fornecedor: "compras",
  categoria: "categorias",
  material: "estoque",
  movimento_estoque: "estoque",
  reserva_estoque: "estoque",
  orcamento: "comercial",
  orcamento_item: "comercial",
  orcamento_material: "comercial",
  orcamento_servico: "comercial",
  ordem_producao: "producao",
  pre_impressao: "producao",
  impressao: "producao",
  acabamento: "producao",
  qualidade: "producao",
  faturacao: "faturacao",
  pedido: "compras",
  pedido_item: "compras",
};

// Middleware que resolve o módulo a partir da tabela pedida e garante a ação
// (ver/editar). A tabela vem do corpo (POST) ou da query string (GET).
function exigirPermissaoTabela(acao) {
  return (req, res, next) => {
    const tabela = String((req.body && req.body.tabela) || req.query.tabela || "").trim();
    if (!tabela) return res.status(422).json({ erro: "Tabela obrigatória" });
    const modulo = MODULO_POR_TABELA[tabela];
    if (!modulo) return res.status(422).json({ erro: "Tabela não suportada" });
    return requirePermissao(modulo, acao)(req, res, next);
  };
}

// Recebe registos locais (is_dirty = 1) e faz upsert no MySQL com
// Last-Write-Wins: so atualiza se o updated_at recebido for mais recente.
router.post("/upsert", exigirPermissaoTabela("editar"), async (req, res) => {
  try {
    const { tabela, registos } = req.body || {};
    const n = await upsert(tabela, req.organizacao_id, registos);
    return res.json({ ok: true, processados: n });
  } catch (e) {
    console.error("Erro no upsert:", e);
    return res.status(500).json({ erro: "Erro na sincronização" });
  }
});

// Devolve tudo o que mudou no MySQL depois de um timestamp (last_sync_time).
router.get("/alteracoes", exigirPermissaoTabela("ver"), async (req, res) => {
  try {
    const { tabela, since } = req.query;
    const registos = await alteracoes(tabela, req.organizacao_id, since || "1970-01-01T00:00:00.000Z");
    return res.json({ registos });
  } catch (e) {
    console.error("Erro ao obter alterações:", e);
    return res.status(500).json({ erro: "Erro ao obter alterações" });
  }
});

// Estado atual da organização (para o desktop descarregar no 1.º login).
router.get("/organizacao", requirePermissao("configuracao", "ver"), async (req, res) => {
  try {
    const org = await organizacaoAtual(req.organizacao_id);
    return res.json({ organizacao: org });
  } catch (e) {
    console.error("Erro ao obter organização:", e);
    return res.status(500).json({ erro: "Erro ao obter organização" });
  }
});

// Envia os dados da organização editados no desktop, com LWW.
router.post("/organizacao", requirePermissao("configuracao", "editar"), async (req, res) => {
  try {
    const dados = (req.body && (req.body.organizacao || req.body.dados)) || req.body;
    if (!dados || typeof dados !== "object") {
      return res.status(422).json({ erro: "Dados da organização obrigatórios" });
    }
    const r = await sincronizarOrganizacao(req.organizacao_id, dados);
    return res.json(r);
  } catch (e) {
    console.error("Erro ao sincronizar organização:", e);
    return res.status(e.status || 500).json({ erro: "Erro ao sincronizar organização" });
  }
});

// --- Tabelas reais (ID numérico + LWW) ---

// Recebe registos de uma tabela real e faz upsert no MySQL com Last-Write-Wins.
router.post("/tabela", exigirPermissaoTabela("editar"), async (req, res) => {
  try {
    const { tabela, registos } = req.body || {};
    const n = await upsertReal(tabela, req.organizacao_id, registos);
    return res.json({ ok: true, processados: n });
  } catch (e) {
    console.error("Erro no upsert de tabela real:", e);
    return res.status(500).json({ erro: "Erro na sincronização" });
  }
});

// Devolve o que mudou numa tabela real depois de um timestamp.
router.get("/tabela", exigirPermissaoTabela("ver"), async (req, res) => {
  try {
    const { tabela, since } = req.query;
    const registos = await alteracoesReal(tabela, req.organizacao_id, since || "1970-01-01T00:00:00.000Z");
    return res.json({ registos });
  } catch (e) {
    console.error("Erro ao obter alterações reais:", e);
    return res.status(500).json({ erro: "Erro ao obter alterações" });
  }
});

module.exports = router;
