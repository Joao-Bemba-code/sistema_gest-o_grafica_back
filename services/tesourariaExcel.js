const ExcelJS = require("exceljs");

// Estilo sóbrio: um único tom no cabeçalho e linhas brancas.
// As colunas de texto têm a largura calculada a partir do conteúdo,
// para cada valor caber na própria coluna sem aparecer "###".
const COR = {
  cabecalhoFundo: "1F4E79",
  cabecalhoTexto: "FFFFFF",
};

const LETRAS = "ABCDEFGHIJKLMNO";

// Larguras fixas para colunas de data/hora/valores (suficientes para o formato de moeda)
const LARGURAS_FIXAS = { A: 12, B: 8, F: 20, G: 20, H: 20 };
const LARGURA_MIN = 10;
const LARGURA_MAX = 42;

function fmtData(v) {
  if (!v) return null;
  const d = new Date(String(v).slice(0, 10) + "T00:00:00");
  return isNaN(d.getTime()) ? String(v) : d;
}

function fmtHora(v) {
  if (!v) return null;
  const s = String(v).split(":").slice(0, 2).join(":");
  const [hh, mm] = s.split(":").map((n) => parseInt(n, 10));
  if (isNaN(hh) || isNaN(mm)) return String(v);
  return new Date(2000, 0, 1, hh, mm);
}

const capitalizar = (s) => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : "");

function sinalDe(tipo, valor) {
  if (String(tipo).toLowerCase() === "entrada") return Number(valor || 0);
  if (String(tipo).toLowerCase() === "saida") return -Number(valor || 0);
  return 0; // transferencia: não afecta o saldo acumulado global
}

// Calcula a largura de cada coluna de texto a partir do conteúdo real.
// Colunas de data/hora/moeda mantêm a largura fixa definida acima.
function calcularLarguras(ws, totalColunas) {
  const larguras = new Array(totalColunas).fill(LARGURA_MIN);
  ws.eachRow((row) => {
    row.eachCell((cell, colNumber) => {
      const idx = colNumber - 1;
      if (LARGURAS_FIXAS[LETRAS[idx]]) return;
      const v = cell.value;
      if (v == null || v === "") return;
      let t = "";
      if (v instanceof Date) {
        t = "00/00/0000";
      } else if (typeof v === "object") {
        if (v.richText) t = v.richText.map((r) => r.text).join("");
        else if (v.result != null) t = String(v.result);
        else t = "";
      } else {
        t = String(v);
      }
      const maiorLinha = t.split("\n").reduce((m, l) => Math.max(m, l.length), 0);
      larguras[idx] = Math.max(larguras[idx], Math.min(maiorLinha + 2, LARGURA_MAX));
    });
  });
  return larguras;
}

/**
 * Gera o ficheiro .xlsx com a vista de tesouraria.
 * Devolve um buffer pronto a enviar.
 */
async function gerarExcel({ movimentos = [], contaId, saldoAnterior = 0, saldoAtual = 0, moeda = "KZ" }) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sistema GSF";
  wb.created = new Date();
  const ws = wb.addWorksheet("Tesouraria", {
    views: [{ state: "frozen", ySplit: 1 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const numFmt = moeda === "EUROS" ? '#,##0.00" €"' : '#,##0.00" Kz"';
  const headers = [
    "Data", "Hora", "Tipo", "Categoria", "Descrição",
    "Valor Entrada", "Valor Saída", "Saldo Acumulado",
    "Método de Pagamento", "Conta Origem", "Conta Destino",
    "Estado", "Referência", "Cliente", "Observações",
  ];
  const colEntrada = "F", colSaida = "G", colSaldo = "H";

  // Cabeçalho — as larguras das colunas de texto são recalculadas no fim
  ws.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: LARGURAS_FIXAS[LETRAS[i]] || LARGURA_MIN }));
  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COR.cabecalhoTexto }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.cabecalhoFundo } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });

  let saldo = Number(saldoAnterior || 0);
  let filaAtual = null;

  // Linhas de movimentos
  movimentos.forEach((m, i) => {
    const tipo = String(m.tipo || "").toLowerCase();
    saldo = Number((saldo + sinalDe(m.tipo, m.valor)).toFixed(2));

    const valor = {
      c0: fmtData(m.data_movimento),
      c1: fmtHora(m.hora_movimento),
      c2: capitalizar(m.tipo),
      c3: capitalizar(m.categoria || ""),
      c4: String(m.descricao || ""),
      c5: tipo === "entrada" ? Number(m.valor) : null,
      c6: tipo === "saida" || tipo === "transferencia" ? Number(m.valor) : null,
      c7: saldo,
      c8: capitalizar(m.metodo_pagamento || ""),
      c9: m.conta ? `${m.conta.banco_nome || ""}${m.conta.numero_conta ? ` (${m.conta.numero_conta})` : ""}`.trim() : "",
      c10: m.contaDestino ? `${m.contaDestino.banco_nome || ""}${m.contaDestino.numero_conta ? ` (${m.contaDestino.numero_conta})` : ""}`.trim() : "",
      c11: capitalizar(m.estado || ""),
      c12: String(m.referencia || ""),
      c13: m.cliente ? (m.cliente.empresa || m.cliente.nome || "") : "",
      c14: String(m.observacoes || ""),
    };

    const row = ws.addRow(valor);
    filaAtual = row.number;

    row.eachCell((cell, colIdx) => {
      const letra = LETRAS[colIdx - 1];
      cell.font = { size: 10 };
      cell.alignment = {
        vertical: "middle",
        horizontal: ["F", "G", "H"].includes(letra)
          ? "right"
          : ["A", "B", "C", "L", "M"].includes(letra)
            ? "center"
            : "left",
        wrapText: !["A", "B", "F", "G", "H"].includes(letra),
      };
      if (cell.value === null) cell.value = "";
    });

    // Formatos de data, hora e moeda (larguras fixas garantem que nunca fica "###")
    row.getCell("A").numFmt = "dd/mm/yyyy";
    row.getCell("B").numFmt = "hh:mm";
    ["F", "G", "H"].forEach((c) => {
      row.getCell(c).numFmt = numFmt;
    });
    row.getCell(colSaldo).font = { bold: true, size: 10 };

    // A partir da 2ª linha, o saldo acumulado torna-se fórmula (o Excel recalcula)
    if (i >= 1) {
      // Transferência não afecta o saldo acumulado global
      row.getCell(colSaldo).value = {
        formula: `H${row.number - 1}+SE($C${row.number}="Entrada";F${row.number};0)-SE($C${row.number}="Saida";G${row.number};0)`,
      };
    }
  });

  // Totais
  if (movimentos.length > 0) {
    const espaco = ws.addRow([]);
    espaco.height = 8;

    const rTotE = ws.addRow({ c4: "TOTAL ENTRADAS", c5: { formula: `SUM(F2:F${filaAtual})` } });
    const rTotS = ws.addRow({ c4: "TOTAL SAÍDAS", c6: { formula: `SUM(G2:G${filaAtual})` } });
    const rSald = ws.addRow({ c4: "SALDO DO PERÍODO", c7: { formula: `H${filaAtual}` } });
    const rSaldoAtual = ws.addRow({ c4: "SALDO ATUAL", c7: Number(saldoAtual || 0) });

    const estiloTotal = (row) => {
      row.height = 20;
      const e = row.getCell("E");
      e.font = { bold: true, size: 11 };
      e.alignment = { vertical: "middle", horizontal: "right" };
      ["F", "G", "H"].forEach((c) => {
        const cell = row.getCell(c);
        cell.font = { bold: true, size: 11 };
        cell.numFmt = numFmt;
      });
    };
    estiloTotal(rTotE);
    estiloTotal(rTotS);
    estiloTotal(rSald);
    estiloTotal(rSaldoAtual);

    const exp = ws.addRow([]);
    exp.height = 4;
    const expRow = ws.addRow({ c0: "EXPORTADO EM", c1: new Date().toLocaleString("pt-AO") });
    expRow.getCell(1).font = { italic: true, color: { argb: "808080" }, size: 9 };
    expRow.getCell(2).font = { italic: true, color: { argb: "808080" }, size: 9 };
  }

  // Auto-filtro
  if (movimentos.length > 0) {
    ws.autoFilter = { from: "A1", to: `O${filaAtual}` };
  }

  // Largura das colunas de texto conforme o conteúdo (cada palavra cabe na sua coluna)
  const larguras = calcularLarguras(ws, headers.length);
  ws.columns.forEach((col, i) => {
    col.width = LARGURAS_FIXAS[LETRAS[i]] || larguras[i];
  });

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

module.exports = { gerarExcel };
