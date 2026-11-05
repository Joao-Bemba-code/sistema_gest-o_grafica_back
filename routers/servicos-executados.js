const router = require("express").Router();
const Controller = require("../controllers/ServicoExecucaoController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

// Serviços executados pela equipa: vive no módulo Recursos Humanos
// (permissões de "utilizadores"), separado do catálogo de serviços.
router.use(auth);

router.get("/", requirePermissao("utilizadores", "ver"), Controller.listar);
router.get("/:id", requirePermissao("utilizadores", "ver"), Controller.buscarPorId);
router.post("/", requirePermissao("utilizadores", "criar"), Controller.criar);
router.put("/:id", requirePermissao("utilizadores", "editar"), Controller.atualizar);
router.delete("/:id", requirePermissao("utilizadores", "eliminar"), Controller.remover);

module.exports = router;
