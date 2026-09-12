const ExcelJS = require("exceljs");

const COR = {
  cabecalhoFundo: "1F4E79",
  cabecalhoTexto: "FFFFFF",
  banda: "F2F7FB",
  entradaFundo: "E8F5E9",
  entradaTexto: "1B5E20",
  saidaFundo: "FFEBEE",
  saidaTexto: "B71C1C",
  transfFundo: "E3F2FD",
  transfTexto: "0D47A1",
  totalEntradaFundo: "E2EFDA",
  totalEntradaTexto: "375623",
  totalSaidaFundo: "FCE4EC",
  totalSaidaTexto: "B71C1C",
  saldoDiaFundo: "FFF2CC",
  saldoDiaTexto: "7F6000",
};

const LARGURAS = [12, 8, 14, 16, 34, 14, 14, 16, 20, 20, 20, 14, 18, 24, 30];

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

/**
 * Gera o ficheiro .xlsx formatado com a vista de tesouraria.
 * Devolve um buffer pronto a enviar.
 */
async function gerarExcel({ movimentos = [], contaId, saldoAnterior = 0, moeda = "KZ" }) {
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
  const cabecalhoLetras = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O"];
  const colEntrada = "F", colSaida = "G", colSaldo = "H";

  // Cabeçalho
  ws.columns = headers.map((h, i) => ({ header: h, key: `c${i}`, width: LARGURAS[i] }));
  const header = ws.getRow(1);
  header.height = 26;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: COR.cabecalhoTexto }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.cabecalhoFundo } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "medium", color: { argb: "9BC2E6" } } };
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
    row.height = 20;

    // Cor por tipo (preenchimento forte)
    let fundo = null, texto = "333333";
    if (tipo === "entrada") { fundo = COR.entradaFundo; texto = COR.entradaTexto; }
    else if (tipo === "saida") { fundo = COR.saidaFundo; texto = COR.saidaTexto; }
    else if (tipo === "transferencia") { fundo = COR.transfFundo; texto = COR.transfTexto; }

    if (fundo) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fundo } };
      });
    } else if (i % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.banda } };
      });
    }

    row.eachCell((cell, colIdx) => {
      cell.font = { color: { argb: texto }, size: 10 };
      cell.alignment = {
        vertical: "middle",
        horizontal: [1, 2, 3, 12].includes(colIdx) ? "center" : "left",
        wrapText: true,
      };
      if (cell.value === null) cell.value = "";
    });

    // Moeda
    ["F", "G", "H"].forEach((c) => {
      const cell = row.getCell(c);
      cell.numFmt = numFmt;
    });
    row.getCell(colSaldo).font = { bold: true, color: { argb: COR.cabecalhoFundo }, size: 10 };

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

    const estiloTotal = (row, fundo, texto) => {
      row.height = 20;
      const e = row.getCell("E");
      e.font = { bold: true, color: { argb: texto }, size: 11 };
      e.alignment = { vertical: "middle", horizontal: "right" };
      e.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fundo } };
      ["F", "G", "H"].forEach((c) => {
        const cell = row.getCell(c);
        cell.font = { bold: true, color: { argb: texto }, size: 11 };
        cell.numFmt = numFmt;
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fundo } };
      });
    };
    estiloTotal(rTotE, COR.totalEntradaFundo, COR.totalEntradaTexto);
    estiloTotal(rTotS, COR.totalSaidaFundo, COR.totalSaidaTexto);
    estiloTotal(rSald, COR.saldoDiaFundo, COR.saldoDiaTexto);

    const exp = ws.addRow([]);
    exp.height = 4;
    const expRow = ws.addRow({ c0: "EXPORTADO EM", c1: new Date().toLocaleString("pt-AO") });
    expRow.getCell(1).font = { italic: true, color: { argb: "808080" }, size: 9 };
    expRow.getCell(2).font = { italic: true, color: { argb: "808080" }, size: 9 };
  }

  // Formatação condicional real
  if (movimentos.length > 0) {
    const ref = `A2:O${filaAtual}`;
    ws.addConditionalFormatting({
      ref,
      rules: [
        {
          type: "expression",
          formulae: [`$C2="Entrada"`],
          priority: 1,
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.entradaFundo }, fgColor: { argb: COR.entradaFundo } },
            font: { color: { argb: COR.entradaTexto } },
          },
        },
        {
          type: "expression",
          formulae: [`$C2="Saida"`],
          priority: 2,
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.saidaFundo }, fgColor: { argb: COR.saidaFundo } },
            font: { color: { argb: COR.saidaTexto } },
          },
        },
        {
          type: "expression",
          formulae: [`$C2="Transferencia"`],
          priority: 3,
          style: {
            fill: { type: "pattern", pattern: "solid", bgColor: { argb: COR.transfFundo }, fgColor: { argb: COR.transfFundo } },
            font: { color: { argb: COR.transfTexto } },
          },
        },
      ],
    });
  }

  // Auto-filtro
  if (movimentos.length > 0) {
    ws.autoFilter = { from: "A1", to: `O${filaAtual}` };
  }

  const buffer = await wb.xlsx.writeBuffer();
  return buffer;
}

module.exports = { gerarExcel };