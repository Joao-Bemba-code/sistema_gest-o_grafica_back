const nodemailer = require("nodemailer");

function validarConfig(cfg) {
  if (!cfg || !cfg.ativo) return { ok: false, erro: "Envio de email não ativado — configure o SMTP em Configurações > Email" };
  if (!cfg.smtp_host || !cfg.email_remetente) {
    return { ok: false, erro: "Email (SMTP) incompleto — configure servidor e remetente em Configurações" };
  }
  return { ok: true };
}

async function enviarEmail({ config, para, assunto, html, anexoBase64, anexoNome }) {
  const val = validarConfig(config);
  if (!val.ok) return val;

  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: Number(config.smtp_port) || 587,
    secure: Number(config.smtp_port) === 465,
    auth: config.smtp_user
      ? { user: config.smtp_user, pass: config.smtp_senha || "" }
      : undefined,
  });

  const remetenteNome = config.email_nome || "SIGRAF";
  const mail = {
    from: `"${remetenteNome}" <${config.email_remetente}>`,
    to: para,
    subject: assunto,
    html,
  };

  if (anexoBase64 && anexoNome) {
    const base64 = String(anexoBase64).replace(/^data:[^;]+;base64,/i, "");
    mail.attachments = [{ filename: anexoNome, content: Buffer.from(base64, "base64") }];
  }

  await transporter.sendMail(mail);
  return { ok: true };
}

module.exports = { enviarEmail };
