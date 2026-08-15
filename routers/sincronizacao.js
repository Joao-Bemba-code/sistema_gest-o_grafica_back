const router = require("express").Router();
const auth = require("../protect/auth");
const { upsert, alteracoes } = require("../services/sincronizacao");

router.use(auth);

// Recebe registos locais (is_dirty = 1) e faz upsert no MySQL com
// Last-Write-Wins: so atualiza se o updated_at recebido for mais recente.
router.post("/upsert", async (req, res) => {
  try {
    const { tabela, registos } = req.body || {};
    if (!tabela) return res.status(422).json({ erro: "Tabela obrigatória" });
    const n = await upsert(tabela, req.organizacao_id, registos);
    return res.json({ ok: true, processados: n });
  } catch (e) {
    console.error("Erro no upsert:", e);
    return res.status(500).json({ erro: "Erro na sincronização: " + (e.message || e) });
  }
});

// Devolve tudo o que mudou no MySQL depois de um timestamp (last_sync_time).
router.get("/alteracoes", async (req, res) => {
  try {
    const { tabela, since } = req.query;
    if (!tabela) return res.status(422).json({ erro: "Tabela obrigatória" });
    const registos = await alteracoes(tabela, req.organizacao_id, since || "1970-01-01T00:00:00.000Z");
    return res.json({ registos });
  } catch (e) {
    console.error("Erro ao obter alterações:", e);
    return res.status(500).json({ erro: "Erro ao obter alterações: " + (e.message || e) });
  }
});

module.exports = router;
