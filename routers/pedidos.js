const router = require("express").Router();
const PedidoController = require("../controllers/PedidoController");
const auth = require("../protect/auth");
const { requireQualquerPermissao } = require("../protect/perm");

router.use(auth);

// Encomendas a fornecedores servem o módulo de Estoque e o módulo de Compras.
const PEDIDOS_VER = [["estoque", "ver"], ["compras", "ver"]];
const PEDIDOS_CRIAR = [["estoque", "criar"], ["compras", "criar"]];
const PEDIDOS_EDITAR = [["estoque", "editar"], ["compras", "editar"]];

router.get("/", requireQualquerPermissao(PEDIDOS_VER), PedidoController.listar);
router.post("/", requireQualquerPermissao(PEDIDOS_CRIAR), PedidoController.criar);
router.get("/:id", requireQualquerPermissao(PEDIDOS_VER), PedidoController.buscarPorId);
router.post("/:id/cancelar", requireQualquerPermissao(PEDIDOS_EDITAR), PedidoController.cancelar);
router.post("/:id/aprovar", requireQualquerPermissao([["compras", "aprovar"], ["estoque", "aprovar"]]), PedidoController.aprovar);
router.post("/:id/rejeitar", requireQualquerPermissao([["compras", "aprovar"], ["estoque", "aprovar"]]), PedidoController.rejeitar);
router.post("/:id/enviar", requireQualquerPermissao(PEDIDOS_EDITAR), PedidoController.enviar);
router.post("/:id/receber", requireQualquerPermissao(PEDIDOS_EDITAR), PedidoController.receber);

module.exports = router;
