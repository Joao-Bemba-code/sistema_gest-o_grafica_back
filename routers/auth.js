const router = require("express").Router();
const AuthController = require("../controllers/AuthController");
const auth = require("../protect/auth");
const loginLimit = require("../protect/loginLimit");

router.post("/login", loginLimit.bloquear, AuthController.login);
router.post("/registrar", AuthController.registrar);
router.get("/perfil", auth, AuthController.perfil);

module.exports = router;
