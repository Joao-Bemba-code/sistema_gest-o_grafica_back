const router = require("express").Router();
const CategoriaController = require("../controllers/CategoriaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

// A página de Relatórios usa as categorias sem exigir acesso ao módulo
// de Recursos: quem pode ver relatórios pode ler esta lista.
router.get("/", requirePermissao.requireQualquerPermissao([["categorias", "ver"], ["relatorios", "ver"]]), CategoriaController.listar);
router.post("/", requirePermissao("categorias", "criar"), CategoriaController.criar);
router.put("/:id", requirePermissao("categorias", "editar"), CategoriaController.atualizar);
router.delete("/:id", requirePermissao("categorias", "eliminar"), CategoriaController.remover);

module.exports = router;
