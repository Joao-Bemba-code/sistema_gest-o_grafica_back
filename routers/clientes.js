const router = require("express").Router();
const ClienteController = require("../controllers/ClienteController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

// A página de Relatórios usa os clientes sem exigir acesso ao módulo
// Comercial: quem pode ver relatórios pode ler esta lista.
router.get("/", requirePermissao.requireQualquerPermissao([["comercial", "ver"], ["relatorios", "ver"]]), ClienteController.listar);
router.get("/:id", requirePermissao("comercial", "ver"), ClienteController.buscarPorId);
router.post("/", requirePermissao("comercial", "criar"), ClienteController.criar);
router.put("/:id", requirePermissao("comercial", "editar"), ClienteController.atualizar);
router.delete("/:id", requirePermissao("comercial", "eliminar"), ClienteController.remover);

module.exports = router;
