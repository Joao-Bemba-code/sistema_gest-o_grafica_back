const bcrypt = require("bcryptjs");
const { sequelize, Organizacao, Usuario, Categoria } = require("./models");

async function seed() {
  try {
    await sequelize.sync({ alter: true });

    const [org] = await Organizacao.findOrCreate({
      where: { email: "geral@cenffor.co.ao" },
      defaults: {
        nome: "Academia Kamatambu",
        sigla: "Kamatambu",
        nif: "5417279310",
        email: "geral@cenffor.co.ao",
        telefone: "+244 923 456 789",
        endereco: "Luanda, Angola",
        website: "https://front-academia-kamatambu.vercel.app/",
      },
    });

    const hash = await bcrypt.hash("admin123", 10);

    const [user] = await Usuario.findOrCreate({
      where: { email: "admin@cenffor.co.ao" },
      defaults: {
        organizacao_id: org.id,
        nome: "Administrador do Sistema",
        email: "admin@cenffor.co.ao",
        senha: hash,
        funcao: "Administrador Geral",
      },
    });

    const categoriasPadrao = ["Papel", "Tintas", "Lonas", "Vinil", "Cola", "Chapas"];
    await Promise.all(
      categoriasPadrao.map((nome) =>
        Categoria.findOrCreate({
          where: { organizacao_id: org.id, nome },
          defaults: { organizacao_id: org.id, nome, tipo: "material" },
        })
      )
    );

    const gruposPadrao = [
      { nome: "Papéis e Mídias", grupo: "papel", tipo: "material" },
      { nome: "Insumos e Consumíveis", grupo: "insumo", tipo: "material" },
      { nome: "Acabamento e Logística", grupo: "acabamento", tipo: "material" },
      { nome: "Produtos Prontos", grupo: "produto", tipo: "produto" },
    ];
    await Promise.all(
      gruposPadrao.map((c) =>
        Categoria.findOrCreate({
          where: { organizacao_id: org.id, nome: c.nome },
          defaults: { organizacao_id: org.id, nome: c.nome, tipo: c.tipo, grupo: c.grupo },
        })
      )
    );

    console.log("✅ Seed concluído!");
    console.log("📧 Email: admin@cenffor.co.ao");
    console.log("🔑 Senha: admin123");
    console.log("🏢 Organização:", org.nome);

    await sequelize.close();
  } catch (e) {
    console.error("❌ Erro no seed:", e);
    await sequelize.close();
  }
}

seed();
