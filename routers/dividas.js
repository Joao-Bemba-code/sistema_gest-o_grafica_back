const router = require("express").Router();
const Controller = require("../controllers/DividaController");
const auth = require("../protect/auth");
const requirePermissao = require("../protect/perm");

router.use(auth);

// Rotas fixas ANTES do GET /:id para "resumo" não ser capturado como id
router.get("/resumo", requirePermissao("dividas", "ver"), Controller.resumo);
router.get("/", requirePermissao("dividas", "ver"), Controller.listar);
router.get("/:id", requirePermissao("dividas", "ver"), Controller.buscar);
router.post("/", requirePermissao("dividas", "criar"), Controller.criar);
router.put("/:id", requirePermissao("dividas", "editar"), Controller.atualizar);
router.put("/:id/pagar", requirePermissao("dividas", "editar"), Controller.pagar);
router.delete("/:id", requirePermissao("dividas", "eliminar"), Controller.remover);

module.exports = router;