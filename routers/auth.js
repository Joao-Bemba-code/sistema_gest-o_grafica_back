const router = require("express").Router();
const AuthController = require("../controllers/AuthController");
const auth = require("../protect/auth");

router.post("/login", AuthController.login);
router.post("/registrar", AuthController.registrar);
router.get("/perfil", auth, AuthController.perfil);

module.exports = router;
