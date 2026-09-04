const router = require("express").Router();
const Controller = require("../controllers/TesourariaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

router.get("/exportar", requirePermissao("tesouraria", "ver"), Controller.exportar);
router.get("/resumo", requirePermissao("tesouraria", "ver"), Controller.resumo);
router.get("/", requirePermissao("tesouraria", "ver"), Controller.listar);
router.get("/:id", requirePermissao("tesouraria", "ver"), Controller.buscar);
router.post("/", requirePermissao("tesouraria", "criar"), Controller.criar);
router.put("/:id", requirePermissao("tesouraria", "editar"), Controller.atualizar);
router.delete("/:id", requirePermissao("tesouraria", "eliminar"), Controller.remover);

module.exports = router;
