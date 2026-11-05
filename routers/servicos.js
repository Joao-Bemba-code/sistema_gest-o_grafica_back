const router = require("express").Router();
const ServicoController = require("../controllers/ServicoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

// O catálogo também alimenta o registo de serviços do módulo Recursos
// Humanos, por isso quem gere pessoas precisa de o ler.
const SERVICOS_LENDER = requirePermissao.requireQualquerPermissao([
  ["categorias", "ver"],
  ["utilizadores", "ver"],
]);

router.get("/", SERVICOS_LENDER, ServicoController.listar);
router.post("/", requirePermissao("categorias", "criar"), ServicoController.criar);
router.put("/:id", requirePermissao("categorias", "editar"), ServicoController.atualizar);
router.delete("/:id", requirePermissao("categorias", "eliminar"), ServicoController.remover);

module.exports = router;
