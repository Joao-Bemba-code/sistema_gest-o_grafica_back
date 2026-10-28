const router = require("express").Router();
const AuthController = require("../controllers/AuthController");
const auth = require("../protect/auth");
const loginLimit = require("../protect/loginLimit");
const { limitar } = require("../protect/rateLimit");

router.post("/login", loginLimit.bloquear, AuthController.login);

// Registo público: limitado por IP para travar criação massiva de empresas.
router.post(
  "/registrar",
  limitar({ prefixo: "registrar", limite: 5, janelaMs: 60 * 60 * 1000 }),
  AuthController.registrar
);

router.get("/perfil", auth, AuthController.perfil);
router.post("/logout", AuthController.logout);

module.exports = router;
