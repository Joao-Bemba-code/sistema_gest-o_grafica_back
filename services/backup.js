const fs = require("fs");
const path = require("path");
const os = require("os");

const { exportarSqlite, carimbo } = require("./sqliteExport");

const RAIZ_BACKEND = path.join(__dirname, "..");
const DIR_DADOS = process.env.SIGRAF_DADOS || RAIZ_BACKEND;

const LEIA_ME = `SIGRAF - Backup completo (${new Date().toLocaleString("pt-BR")})

Conteudo do ZIP:
  base_dados.sqlite -> TODA a base de dados em formato SQLite (portatil)
  uploads/          -> ficheiros enviados para o sistema

Como recuperar os dados:
  1. Instale o backend e coloque este ZIP numa pasta.
  2. Extraia o ZIP.
  3. No ficheiro .env do backend defina:
       Lang=sqlite
       Sqlite_File=<caminho completo do base_dados.sqlite extraido>
  4. Inicie o backend. O sistema corre com todos os dados, sem precisar de MySQL.
`;

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function nomeBackup(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function dosDataTempo(d) {
  const tempo = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2);
  const data = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { tempo, data };
}

function listarArquivos(dir, prefixo, saida) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const origem = path.join(dir, entry.name);
    const destino = prefixo + entry.name;
    if (entry.isDirectory()) listarArquivos(origem, destino + "/", saida);
    else saida.push({ origem, destino });
  }
}

async function criarZipBackup(log = () => {}) {
  const ts = nomeBackup();
  const trabalho = fs.mkdtempSync(path.join(os.tmpdir(), "sigraf-backup-"));

  try {
    log("A exportar base de dados para SQLite...");
    const baseSqlite = path.join(trabalho, "base_dados.sqlite");
    await exportarSqlite(baseSqlite);

    const leiame = path.join(trabalho, "LEIA-ME.txt");
    fs.writeFileSync(leiame, LEIA_ME);

    const entradas = [
      { origem: leiame, destino: "LEIA-ME.txt" },
      { origem: baseSqlite, destino: "base_dados.sqlite" },
    ];
    const uploads = path.join(DIR_DADOS, "uploads");
    if (fs.existsSync(uploads)) {
      log("A juntar ficheiros de uploads...");
      listarArquivos(uploads, "uploads/", entradas);
    }

    const nome = `sigraf-backup-${ts}.zip`;
    const caminho = path.join(os.tmpdir(), nome);
    const fd = fs.openSync(caminho, "w");
    const central = [];
    let offset = 0;

    try {
      for (const e of entradas) {
        const dados = fs.readFileSync(e.origem);
        const crc = crc32(dados);
        const dt = dosDataTempo(new Date());
        const nameBuf = Buffer.from(e.destino, "utf8");
        const header = Buffer.alloc(30);
        header.writeUInt32LE(0x04034b50, 0);
        header.writeUInt16LE(20, 4);
        header.writeUInt16LE(0x0800, 6);
        header.writeUInt16LE(0, 8);
        header.writeUInt16LE(dt.tempo, 10);
        header.writeUInt16LE(dt.data, 12);
        header.writeUInt32LE(crc, 14);
        header.writeUInt32LE(dados.length, 18);
        header.writeUInt32LE(dados.length, 22);
        header.writeUInt16LE(nameBuf.length, 26);
        header.writeUInt16LE(0, 28);
        fs.writeSync(fd, header);
        fs.writeSync(fd, nameBuf);
        fs.writeSync(fd, dados);
        central.push({ nome: nameBuf, crc, tamanho: dados.length, offset, dt });
        offset += 30 + nameBuf.length + dados.length;
      }

      const centralInicio = offset;
      for (const c of central) {
        const rec = Buffer.alloc(46);
        rec.writeUInt32LE(0x02014b50, 0);
        rec.writeUInt16LE(20, 4);
        rec.writeUInt16LE(20, 6);
        rec.writeUInt16LE(0x0800, 8);
        rec.writeUInt16LE(0, 10);
        rec.writeUInt16LE(c.dt.tempo, 12);
        rec.writeUInt16LE(c.dt.data, 14);
        rec.writeUInt32LE(c.crc, 16);
        rec.writeUInt32LE(c.tamanho, 20);
        rec.writeUInt32LE(c.tamanho, 24);
        rec.writeUInt16LE(c.nome.length, 28);
        rec.writeUInt16LE(0, 30);
        rec.writeUInt16LE(0, 32);
        rec.writeUInt16LE(0, 34);
        rec.writeUInt16LE(0, 36);
        rec.writeUInt32LE(0, 38);
        rec.writeUInt32LE(c.offset, 42);
        fs.writeSync(fd, rec);
        fs.writeSync(fd, c.nome);
      }

      const centralTamanho = offset - centralInicio;
      const eocd = Buffer.alloc(22);
      eocd.writeUInt32LE(0x06054b50, 0);
      eocd.writeUInt16LE(0, 4);
      eocd.writeUInt16LE(0, 6);
      eocd.writeUInt16LE(central.length, 8);
      eocd.writeUInt16LE(central.length, 10);
      eocd.writeUInt32LE(centralTamanho, 12);
      eocd.writeUInt32LE(centralInicio, 16);
      eocd.writeUInt16LE(0, 20);
      fs.writeSync(fd, eocd);
    } finally {
      fs.closeSync(fd);
    }

    return { caminho, nome };
  } finally {
    fs.rmSync(trabalho, { recursive: true, force: true });
  }
}

module.exports = { criarZipBackup, nomeBackup };
