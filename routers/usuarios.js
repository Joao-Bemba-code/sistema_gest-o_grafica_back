const router = require("express").Router();
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");
const UsuarioController = require("../controllers/UsuarioController");

router.use(auth);

router.get("/perfis", UsuarioController.listarPerfis);
router.get("/:id/acessos", requirePermissao("utilizadores", "ver"), UsuarioController.listarAcessos);
router.get("/", requirePermissao("utilizadores", "ver"), UsuarioController.listar);
router.post("/", requirePermissao("utilizadores", "criar"), UsuarioController.criar);
router.put("/:id", requirePermissao("utilizadores", "editar"), UsuarioController.atualizar);

module.exports = router;