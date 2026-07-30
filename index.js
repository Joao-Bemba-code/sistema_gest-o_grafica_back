const express = require("express");
const cors = require("cors");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();

const { sequelize } = require("./models");
const sanitize = require("./protect/sanitize");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(sanitize);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/", (req, res) => {
  res.status(200).json({ msg: "API v1.1 do Sistema de Gestão para Gráficas (SIGRAF)" });
});

app.use("/api/auth", require("./routers/auth"));
app.use("/api/clientes", require("./routers/clientes"));
app.use("/api/materiais", require("./routers/materiais"));
app.use("/api/orcamentos", require("./routers/orcamentos"));
app.use("/api/producao", require("./routers/producao"));
app.use("/api/faturacao", require("./routers/faturacao"));
app.use("/api/categorias", require("./routers/categorias"));
app.use("/api/configuracoes", require("./routers/configuracoes"));
app.use("/api/fornecedores", require("./routers/fornecedores"));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno no servidor" });
});

const PORTA = process.env.port || 8000;

sequelize.sync({ alter: true }).then(() => {
  app.listen(PORTA, () => {
    console.log(`Servidor rodando na porta ${PORTA}`);
  });
}).catch((e) => {
  console.error("Erro ao conectar ao banco:", e);
});
