import * as pdfjsLib from 'pdfjs-dist';
import { OrderItem, OrigemType, SkuExtractionMode } from '../types';

// Set worker source with reliable fallback for Vite / browser environments
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export interface CodeMatch {
  code: string;
  start: number;
  end: number;
  type: 'tramontina_ref' | 'ean13';
}

/**
 * Normaliza qualquer referência Tramontina para o padrão 5 dígitos / 3 dígitos (ex: 24011/008)
 */
export function normalizeTramontinaSku(raw: string): string {
  const clean = raw.replace(/[\/\-\.\s]/g, '');
  if (clean.length === 8 && /^\d{8}$/.test(clean)) {
    return `${clean.slice(0, 5)}/${clean.slice(5, 8)}`;
  }
  if (clean.length === 7 && /^\d{7}$/.test(clean)) {
    return `${clean.slice(0, 5)}/${clean.slice(5, 7)}`;
  }
  return raw.trim();
}

export function isValidTramontinaSku(sku: string): boolean {
  const clean = sku.replace(/[\/\-\.\s]/g, '');
  return (clean.length === 8 || clean.length === 7) && /^\d{7,8}$/.test(clean);
}

/**
 * Extrai texto do PDF com fallback robusto:
 * 1. Primeiro tenta com agrupamento geométrico por linhas (X, Y)
 * 2. Se falhar ou vier vazio, faz concatenação direta sequencial de todos os itens de texto
 */
export async function extractTextFromPdf(file: File): Promise<{ text: string; pageCount: number }> {
  try {
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buf),
      useSystemFonts: true,
      disableFontFace: false,
    });
    const pdf = await loadingTask.promise;
    let fullDocumentText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      
      interface TextItemWithPos {
        str: string;
        x: number;
        y: number;
        height: number;
      }

      const items: TextItemWithPos[] = [];
      let rawSequentialText = '';

      content.items.forEach((it: any) => {
        if (!it.str || it.str.trim() === '') return;
        rawSequentialText += it.str + ' ';
        const x = it.transform ? it.transform[4] : 0;
        const y = it.transform ? it.transform[5] : 0;
        const height = it.height || (it.transform ? Math.abs(it.transform[0]) : 10);
        items.push({ str: it.str, x, y, height });
      });

      // Agrupa itens em linhas por proximidade de coordenada Y (tolerância ~4.0pt)
      const lineBuckets: Array<{ y: number; items: TextItemWithPos[] }> = [];
      const Y_TOLERANCE = 4.0;

      items.forEach(item => {
        let bucket = lineBuckets.find(b => Math.abs(b.y - item.y) <= Y_TOLERANCE);
        if (!bucket) {
          bucket = { y: item.y, items: [] };
          lineBuckets.push(bucket);
        }
        bucket.items.push(item);
      });

      // Ordena linhas de cima para baixo (Y decrescente no espaço do PDF)
      lineBuckets.sort((a, b) => b.y - a.y);

      const pageLines: string[] = [];
      lineBuckets.forEach(bucket => {
        // Ordena palavras dentro da mesma linha da esquerda para a direita (X crescente)
        bucket.items.sort((a, b) => a.x - b.x);
        const lineStr = bucket.items.map(it => it.str.trim()).join(' ');
        if (lineStr.length > 0) {
          pageLines.push(lineStr);
        }
      });

      const structuredPageText = pageLines.join('\n');
      if (structuredPageText.trim().length > 0) {
        fullDocumentText += structuredPageText + '\n\n';
      } else if (rawSequentialText.trim().length > 0) {
        fullDocumentText += rawSequentialText + '\n\n';
      }
    }

    return { text: fullDocumentText, pageCount: pdf.numPages };
  } catch (err) {
    console.error('Erro ao ler PDF:', err);
    throw err;
  }
}

/**
 * Parser de linha tabular multi-ERP especializado:
 * Suporta:
 * 1. MDC / Ferreira Costa (XPED / SAP)
 * 2. Comercial Miudezas Freitas (Pedido Real)
 * 3. Casa Vieira (Rotina 210)
 * 4. TOTVS Varejo / Centerbox / Gerardos (RELPEDSUPRIM_CENTERBOX.QRP)
 * 5. Consinco / Rebouças / Dia a Dia (RelPedSuprim.QRP)
 * 6. Grupo Casa Freitas (Pedido de Compra)
 * 7. Carajás Material de Construção (Business Integrator EDI)
 */
export function parseTabularLine(line: string): {
  isMatch: boolean;
  skuRef?: string;
  ean?: string;
  quantidade?: number;
  embalagem?: number;
} | null {
  const cleanLine = line.trim();
  if (!cleanLine) return null;

  // ----------------------------------------------------
  // MODELO 0: Rotina 210 / WinThor / TOTVS Distribuição (Emitir Pedido de Compra)
  // Ex: "84882 COLHER MESA C/12PCS LEME AZ 23183990 1X1 CJ 80,00 19,951000 0,00 19,951000 0,00 6,50..."
  // Ex: "113021 FAQUEIRO 24PCS NEW KOLOR 23198/093 PRETO 23198/093 1X1 UN 60,00 30,286800..."
  // Ex: "35402 FACA PEXEIRA INOX 5" 22902/005 C/12 22902005 1X1 CT 40,00 70,500000..."
  // ----------------------------------------------------
  const r210Regex = /^(\d{2,8})\s+(.+?)\s+([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{7,8})\s+(?:\(?\d+[xX]\d+\)?|\d+)\s+([A-ZÀ-Ü]{2,3})\s+(\d+(?:[,\.]\d+)?)\s+(\d+(?:[,\.]\d+)?)/i;
  const r210Match = r210Regex.exec(cleanLine);
  if (r210Match) {
    const rawRef = r210Match[3];
    const qtd = parseFloat(r210Match[5].replace(',', '.'));
    return {
      isMatch: true,
      skuRef: normalizeTramontinaSku(rawRef),
      quantidade: qtd,
      embalagem: 1
    };
  }

  // ----------------------------------------------------
  // MODELO 1: Ferreira Costa / MDC (ex: "360 UN-1-UN 63962072 3443876 7891116082409 COLHER CHA...")
  // ----------------------------------------------------
  const fcRegex = /^(\d+(?:[,\.]\d+)?)\s+([A-ZÀ-Ü]{2,3})-(\d+)-\2\s+([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{7,8})(?:\s+(\d{4,8}))?(?:\s+(789\d{10}|\d{13}))?\s*(.*)$/i;
  const fcMatch = fcRegex.exec(cleanLine);
  if (fcMatch) {
    const qtd = parseFloat(fcMatch[1].replace(',', '.'));
    const emb = parseInt(fcMatch[3], 10) || 1;
    const rawRef = fcMatch[4];
    const eanCandidate = fcMatch[6];
    const desc = fcMatch[7] || '';
    const descEan = !eanCandidate ? /\b(789\d{10}|\d{13})\b/.exec(desc)?.[1] : eanCandidate;

    return {
      isMatch: true,
      skuRef: normalizeTramontinaSku(rawRef),
      ean: descEan || undefined,
      quantidade: qtd,
      embalagem: emb
    };
  }

  // Modelo 1B: Ferreira Costa com código colado após prefixo longo
  const fcSpecialRegex = /^(\d+(?:[,\.]\d+)?)\s+([A-ZÀ-Ü]{2,3})-(\d+)-\2\s+(\d+)\s+(\d{4,8})\s+(789\d{10}|\d{13})\s+(.*)$/i;
  const fcSpecialMatch = fcSpecialRegex.exec(cleanLine);
  if (fcSpecialMatch) {
    const qtd = parseFloat(fcSpecialMatch[1].replace(',', '.'));
    const emb = parseInt(fcSpecialMatch[3], 10) || 1;
    const ean = fcSpecialMatch[6];
    const desc = fcSpecialMatch[7];
    const refInDesc = /\b([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{8})\b/.exec(desc);

    return {
      isMatch: true,
      skuRef: refInDesc ? normalizeTramontinaSku(refInDesc[1]) : undefined,
      ean: ean,
      quantidade: qtd,
      embalagem: emb
    };
  }

  // ----------------------------------------------------
  // MODELO 2: Miudezas Freitas
  // ----------------------------------------------------
  const mfRegex = /^(\d{4})\s+([0-9A-Z]+)\s+([0-9]{8})\s+(.+?)\s+(UN|JG|CJ|CX|PC|PÇ|CT)\s+(\d+)\s+(\d+(?:[,\.]\d+)?)\s+([\d\.,]+)/i;
  const mfMatch = mfRegex.exec(cleanLine);
  if (mfMatch) {
    const rawRef = mfMatch[3];
    const emb = parseInt(mfMatch[6], 10) || 1;
    const qtd = parseFloat(mfMatch[7].replace(',', '.'));
    return {
      isMatch: true,
      skuRef: normalizeTramontinaSku(rawRef),
      quantidade: qtd,
      embalagem: emb
    };
  }

  // ----------------------------------------------------
  // MODELO 3: Casa Vieira (Rotina 210)
  // ----------------------------------------------------
  const cvRegex = /^(789\d{10})\s+([0-9]{8})\s+(\d+)\s+(.+?)\s+(\d+(?:[,\.]\d+)?)\s+([\d\.,]+)\s+([\d\.,]+)\s+([\d\.,]+)$/i;
  const cvMatch = cvRegex.exec(cleanLine);
  if (cvMatch) {
    const ean = cvMatch[1];
    const rawRef = cvMatch[2];
    const desc = cvMatch[4];
    const qtd = parseFloat(cvMatch[5].replace(',', '.'));

    const refInDesc = /\b([0-9]{5}[\/\-\.][0-9]{2,3})\b/.exec(desc);
    const skuRef = refInDesc ? normalizeTramontinaSku(refInDesc[1]) : normalizeTramontinaSku(rawRef);

    return {
      isMatch: true,
      skuRef: skuRef,
      ean: ean,
      quantidade: qtd,
      embalagem: 1
    };
  }

  // ----------------------------------------------------
  // MODELO 4: Carajás Material de Construção (Business Integrator EDI)
  // ----------------------------------------------------
  const carajasRegex = /^(\d{1,4})\s+(\d{6,14})\s+(789\d{10})\s+([0-9\s]{7,10})\s+(.+?)\s+-\s*(\d+(?:[,\.]\d+)?)\s+(UN|JG|CJ|CX|PC|PÇ)\s+(\d+)/i;
  const carajasMatch = carajasRegex.exec(cleanLine);
  if (carajasMatch) {
    const ean = carajasMatch[3];
    const rawProdCode = carajasMatch[4].replace(/\s+/g, '');
    const desc = carajasMatch[5];
    const qtd = parseFloat(carajasMatch[6].replace(',', '.'));
    const emb = parseInt(carajasMatch[8], 10) || 1;

    let finalRef = isValidTramontinaSku(rawProdCode) ? normalizeTramontinaSku(rawProdCode) : undefined;
    if (!finalRef) {
      const refInDesc = /\b([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{8})\b/.exec(desc);
      if (refInDesc) finalRef = normalizeTramontinaSku(refInDesc[1]);
    }

    return {
      isMatch: true,
      skuRef: finalRef,
      ean: ean,
      quantidade: qtd,
      embalagem: emb
    };
  }

  // ----------------------------------------------------
  // MODELO 5: Grupo Casa Freitas (Pedido de Compra)
  // ----------------------------------------------------
  const cfRegex = /^(\d{4})\s+([0-9A-Z]+)\s+(789\d{10})\s+(.+?)\s+(?:MAISON\s+|TRAMO\s+)?(UN|JG|CJ|CX|PC|PÇ)\s+(\d+(?:[,\.]\d+)?)\s+([\d\.,]+)/i;
  const cfMatch = cfRegex.exec(cleanLine);
  if (cfMatch) {
    const ean = cfMatch[3];
    const desc = cfMatch[4];
    const qtd = parseFloat(cfMatch[6].replace(',', '.'));

    const refInDesc = /\b([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{8})\b/.exec(desc);
    const skuRef = refInDesc ? normalizeTramontinaSku(refInDesc[1]) : undefined;

    return {
      isMatch: true,
      skuRef: skuRef,
      ean: ean,
      quantidade: qtd,
      embalagem: 1
    };
  }

  // ----------------------------------------------------
  // MODELO 6: Consinco / Rebouças / Dia a Dia (RelPedSuprim.QRP)
  // ----------------------------------------------------
  const consincoWithRefRegex = /^(?:([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{8})\s+[\d\.,]+\s+)?(\d{4,8})\s+(.+?REF:\s*([0-9\/\-\.]+).*?)\s+(CX|UN|JG|CJ|PC|PÇ)\s+(\d+)\s+(\d+(?:[,\.]\d+)?)/i;
  const consincoWithRefMatch = consincoWithRefRegex.exec(cleanLine);
  if (consincoWithRefMatch) {
    const initialRef = consincoWithRefMatch[1];
    const labelRef = consincoWithRefMatch[4];
    const rawRef = labelRef || initialRef;
    const unitType = consincoWithRefMatch[5].toUpperCase();
    const emb = parseInt(consincoWithRefMatch[6], 10) || 1;
    const qtd = parseFloat(consincoWithRefMatch[7].replace(',', '.'));

    return {
      isMatch: true,
      skuRef: normalizeTramontinaSku(rawRef),
      embalagem: unitType === 'CX' ? emb : 1,
      quantidade: qtd
    };
  }

  // ----------------------------------------------------
  // MODELO 7: TOTVS Varejo / Centerbox / Gerardos (RELPEDSUPRIM_CENTERBOX.QRP)
  // ----------------------------------------------------
  const totvsRegex = /^(?:([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{8})\s+[\d\.,]+\s+)?(\d{4,8})\s+(.+?)\s+(CX|UN|JG|CJ|PC|PÇ)\s+(\d+)\s+(\d+(?:[,\.]\d+)?)\s+([\d\.,]+)/i;
  const totvsMatch = totvsRegex.exec(cleanLine);
  if (totvsMatch) {
    const initialRef = totvsMatch[1];
    const desc = totvsMatch[3];
    const unitType = totvsMatch[4].toUpperCase();
    const emb = parseInt(totvsMatch[5], 10) || 1;
    const qtd = parseFloat(totvsMatch[6].replace(',', '.'));

    let finalRef: string | undefined = initialRef ? normalizeTramontinaSku(initialRef) : undefined;
    if (!finalRef) {
      const refInDesc = /\b(?:R|REF:?)?([0-9]{5}[\/\-\.][0-9]{2,3}|[0-9]{8})\b/i.exec(desc);
      if (refInDesc) {
        finalRef = normalizeTramontinaSku(refInDesc[1]);
      }
    }

    if (finalRef && isValidTramontinaSku(finalRef)) {
      return {
        isMatch: true,
        skuRef: finalRef,
        embalagem: unitType === 'CX' ? emb : 1,
        quantidade: qtd
      };
    }
  }

  // ----------------------------------------------------
  // Padrão Geral com Rótulos (Ex: "REF: 24011/008 EMB: 6 QTDE: 24 UN")
  // ----------------------------------------------------
  const labeledRegex = /(?:REF(?:ER[EÊ]NCIA)?|C[OÓ]D(?:IGO)?|SKU|MATERIAL)?[:\s#]*([0-9]{5}[\/\-\.][0-9]{3}|[0-9]{8})\b.*?(?:EMB(?:ALAGEM)?|CX|BOX)[:\s]*(\d+).*?(?:QTDE?|QUANT(?:IDADE)?|SOLIC)[:\s]*(\d+(?:[,\.]\d+)?)/i;
  const labeledMatch = labeledRegex.exec(cleanLine);
  if (labeledMatch) {
    return {
      isMatch: true,
      skuRef: normalizeTramontinaSku(labeledMatch[1]),
      embalagem: parseInt(labeledMatch[2], 10) || 1,
      quantidade: parseFloat(labeledMatch[3].replace(',', '.'))
    };
  }

  return null;
}

/**
 * Referência Tramontina: 8 dígitos (5 prefixo + 3 sufixo) ou 7 dígitos.
 * Pode vir formatada (24011/008, 20599-751, 23799.063), com espaços (24011 / 008)
 * ou sem separador (24011008, 63962072).
 */
export function extractReferenceCodes(text: string): CodeMatch[] {
  const found: CodeMatch[] = [];
  const posSeen = new Set<number>();

  // Prioridade 1: Referência com rótulo explícito (REF, CÓD, PROD, ITEM, MATERIAL, SKU, TRAMONTINA, FORNECEDOR)
  const labelRegex = /(?:REF(?:ER[EÊ]NCIA)?|C[OÓ]D(?:IGO)?|MATERIAL|SKU|PROD(?:UTO)?|ITEM|TRAMONTINA|FABRICANTE|FORNECEDOR)[:\.\s#]*([0-9]{5})[\/\-\.\s]?([0-9]{2,3})\b/gi;
  let m: RegExpExecArray | null;

  while ((m = labelRegex.exec(text)) !== null) {
    const startPos = m.index;
    if (posSeen.has(startPos)) continue;
    posSeen.add(startPos);

    const prefix = m[1];
    const suffix = m[2];
    found.push({
      code: `${prefix}/${suffix}`,
      start: startPos,
      end: startPos + m[0].length,
      type: 'tramontina_ref'
    });
  }

  // Prioridade 2: Referência com separador explícito (barra, traço ou ponto: 24011/008, 20599-751, 23799.063)
  const formattedRegex = /\b([0-9]{5})[\/\-\.]([0-9]{2,3})\b/g;
  while ((m = formattedRegex.exec(text)) !== null) {
    const startPos = m.index;
    if (posSeen.has(startPos)) continue;

    // Evita datas no formato DD/MM/AAAA ou AAAA-MM-DD
    const dateContext = text.slice(Math.max(0, startPos - 4), Math.min(text.length, startPos + 12));
    if (/\b\d{2}[\/\-\.]\d{2}[\/\-\.]\d{4}\b/.test(dateContext) || /\b\d{4}[\/\-\.]\d{2}[\/\-\.]\d{2}\b/.test(dateContext)) {
      continue;
    }

    // Evita contexto estrito de CEP (Ex: CEP 95185-000 ou RS 95185-000)
    const context = text.slice(Math.max(0, startPos - 25), Math.min(text.length, startPos + 25));
    if (/\bCEP[:\s]*\d{5}[\/\-\.]\d{3}\b/i.test(context)) {
      continue;
    }
    if (/\b[A-Z]{2}\s+\d{5}[\/\-\.]\d{3}\b/.test(context)) {
      continue;
    }

    posSeen.add(startPos);
    found.push({
      code: `${m[1]}/${m[2]}`,
      start: startPos,
      end: startPos + m[0].length,
      type: 'tramontina_ref'
    });
  }

  // Prioridade 3: 8 dígitos contínuos (ex: 63962072, 24011008, 25655100)
  const continuousRegex = /\b([0-9]{5})([0-9]{3})\b/g;
  while ((m = continuousRegex.exec(text)) !== null) {
    const startPos = m.index;
    if (posSeen.has(startPos)) continue;

    const context = text.slice(Math.max(0, startPos - 40), Math.min(text.length, startPos + 40));
    
    // Evita CNPJ (14 dígitos), CPF (11 dígitos), CEP, Inscrição Estadual, Telefone
    if (/\b(CEP|CNPJ|CPF|INSCRI[CÇ][AÃ]O|FONE|FAX|TELEFONE|TEL|0800)\b/i.test(context)) {
      continue;
    }
    // Evita se for parte de um número maior (ex: 13 dígitos EAN ou 14 dígitos CNPJ)
    const surroundingDigits = text.slice(Math.max(0, startPos - 2), Math.min(text.length, startPos + 10));
    if (/\d{9,}/.test(surroundingDigits)) {
      continue;
    }
    // Evita datas sem separador
    if (/\b(19|20)\d{6}\b/.test(m[0])) {
      const yr = parseInt(m[0].slice(0, 4), 10);
      const mo = parseInt(m[0].slice(4, 6), 10);
      const da = parseInt(m[0].slice(6, 8), 10);
      if (yr >= 1990 && yr <= 2040 && mo >= 1 && mo <= 12 && da >= 1 && da <= 31) {
        continue;
      }
    }

    posSeen.add(startPos);
    found.push({
      code: `${m[1]}/${m[2]}`,
      start: startPos,
      end: startPos + m[0].length,
      type: 'tramontina_ref'
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * Códigos EAN / GTIN de 13 dígitos (Ex: 7891112003456, 7891116051993, 7896403797721)
 */
export function extractEanCodes(text: string): CodeMatch[] {
  const found: CodeMatch[] = [];
  const posSeen = new Set<number>();

  // Prioridade 1: Código EAN brasileiro (começa com 789)
  const eanBrRegex = /\b(789\d{10})\b/g;
  let m: RegExpExecArray | null;
  while ((m = eanBrRegex.exec(text)) !== null) {
    const startPos = m.index;
    if (posSeen.has(startPos)) continue;
    posSeen.add(startPos);
    found.push({
      code: m[1],
      start: startPos,
      end: startPos + m[0].length,
      type: 'ean13'
    });
  }

  // Prioridade 2: Código de 13 dígitos com rótulo explícito (EAN, GTIN, Cód. Barras, Barcode)
  const labelRegex = /(?:EAN(?:-?13)?|GTIN(?:-?13)?|C[OÓ]D(?:IGO)?\.?\s*(?:DE\s*)?BARRAS?|BARCODE)[:\s]{0,4}(\d{13})\b/gi;
  while ((m = labelRegex.exec(text)) !== null) {
    const startPos = m.index;
    if (posSeen.has(startPos)) continue;
    posSeen.add(startPos);
    found.push({
      code: m[1],
      start: startPos,
      end: startPos + m[0].length,
      type: 'ean13'
    });
  }

  // Prioridade 3: Qualquer sequência isolada de 13 dígitos (que não seja CNPJ ou data)
  const standaloneRegex = /\b(\d{13})\b/g;
  while ((m = standaloneRegex.exec(text)) !== null) {
    const startPos = m.index;
    if (posSeen.has(startPos)) continue;
    
    // Evita se fizer parte de um CNPJ (14 dígitos)
    const surrounding = text.slice(Math.max(0, startPos - 2), Math.min(text.length, startPos + 15));
    if (/\d{14,}/.test(surrounding)) continue;

    posSeen.add(startPos);
    found.push({
      code: m[1],
      start: startPos,
      end: startPos + m[0].length,
      type: 'ean13'
    });
  }

  return found.sort((a, b) => a.start - b.start);
}

/**
 * Modo Automático: combina referências Tramontina e EANs.
 */
export function extractAutoCodes(text: string): CodeMatch[] {
  const refs = extractReferenceCodes(text);
  const eans = extractEanCodes(text);

  if (refs.length === 0) return eans;
  if (eans.length === 0) return refs;

  const combined: CodeMatch[] = [...refs];
  const PROXIMITY_WINDOW = 120;

  for (const ean of eans) {
    const hasNearbyRef = refs.some(ref => Math.abs(ean.start - ref.start) < PROXIMITY_WINDOW);
    if (!hasNearbyRef) {
      combined.push(ean);
    }
  }

  return combined.sort((a, b) => a.start - b.start);
}

/**
 * Localiza quantidade e tamanho de embalagem adjacentes ao código do produto
 */
export function attachPackagingAndQuantity(
  matches: CodeMatch[],
  text: string
): Array<{ sku: string; embalagem: number; quantidade: number; detectedType: 'tramontina_ref' | 'ean13' }> {
  const WINDOW = 280;
  const isCxaMastFormat = /Cxa\s*Mast/i.test(text);
  const boxQtyFirstLabel = '(?:CX|CAIXA|EMB(?:ALAGEM)?|BOX)';
  const boxLabel = isCxaMastFormat ? '(?:CX|CAIXA|EMB(?:ALAGEM)?|UN|UND|UNID(?:ADE)?|BOX)' : '(?:CX|CAIXA|EMB(?:ALAGEM)?|BOX)';
  const unitLabel = isCxaMastFormat ? '(?:CJ|CT|JG|PC|PÇ)' : '(?:UN|UND|UNID(?:ADE)?|CJ|CT|JG|PC|PÇ|PE[CÇ]A|FD|PCT)';
  const SEP = '[\\s:\\-\\|]*';

  const boxQtyFirst = new RegExp('(\\d+(?:[,\.]\d+)?)\\s*' + boxQtyFirstLabel + '\\.?' + SEP + '(\\d+)\\b(?!-)', 'i');
  const boxLabelFirst = new RegExp('\\b' + boxLabel + '\\.?' + SEP + '(\\d+)\\s+(\\d+(?:[,\.]\d+)?)\\b(?!-)', 'i');
  const unitQty = new RegExp('\\b' + unitLabel + '\\.?' + SEP + '(\\d+(?:[,\.]\d+)?)\\b(?!-)', 'i');
  const unitQtyBefore = new RegExp('(?<![Xx0-9])(\\d+(?:[,\.]\d+)?)\\s*' + unitLabel + '\\b(?!-)', 'i');
  
  // Rótulos diretos de Embalagem e Quantidade
  const embOnlyRegex = /\b(?:EMB(?:ALAGEM)?|CXA?\.?|CAIXA|M[UÚ]LT(?:IPLO)?|FATOR)\s*[:=\-]?\s*(\d+)/i;
  const qtdOnlyRegex = /\b(?:QTDE?|QUANT(?:IDADE)?|QUANT\.?|QT\.?\s*PED(?:IDO)?|SOLIC(?:ITADA)?|QTD\.?|QTD)\s*[:=\-]?\s*(\d+(?:[,\.]\d+)?)/i;
  
  const packLandmark = /(\d+(?:[,\.]\d+)?)\s+(UN|JG|CJ|CT|PC|PÇ|CX|FD|PCT)-(\d+)-\2\b/i;

  function findAllMatches(win: string, regex: RegExp) {
    const g = new RegExp(regex.source, regex.flags.includes('g') ? regex.flags : regex.flags + 'g');
    const out: RegExpExecArray[] = [];
    let m: RegExpExecArray | null;
    while ((m = g.exec(win)) !== null) {
      out.push(m);
      if (m[0].length === 0) g.lastIndex++;
    }
    return out;
  }

  function scanWindow(win: string, preferLast: boolean) {
    interface Candidate {
      pos: number;
      len: number;
      data: { quantidade: number; embalagem: number };
    }
    const candidates: Candidate[] = [];

    findAllMatches(win, boxQtyFirst).forEach(m => {
      candidates.push({
        pos: m.index,
        len: m[0].length,
        data: { quantidade: parseFloat(m[1].replace(',', '.')), embalagem: parseInt(m[2], 10) || 1 }
      });
    });

    findAllMatches(win, boxLabelFirst).forEach(m => {
      candidates.push({
        pos: m.index,
        len: m[0].length,
        data: { embalagem: parseInt(m[1], 10) || 1, quantidade: parseFloat(m[2].replace(',', '.')) }
      });
    });

    const beforeMatches = findAllMatches(win, unitQtyBefore);
    beforeMatches.forEach(m => {
      candidates.push({
        pos: m.index,
        len: m[0].length,
        data: { embalagem: 1, quantidade: parseFloat(m[1].replace(',', '.')) }
      });
    });

    findAllMatches(win, unitQty).forEach(m => {
      const overlaps = beforeMatches.some(b => m.index >= b.index && m.index < b.index + b[0].length);
      if (!overlaps) {
        candidates.push({
          pos: m.index,
          len: m[0].length,
          data: { embalagem: 1, quantidade: parseFloat(m[1].replace(',', '.')) }
        });
      }
    });

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => (preferLast ? b.pos - a.pos : a.pos - b.pos));
    return candidates[0];
  }

  return matches.map((match, i) => {
    const prevEnd = i > 0 ? matches[i - 1].end : 0;
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : text.length;
    const windowAfter = text.slice(match.end, Math.min(nextStart, match.end + WINDOW));
    const windowBefore = text.slice(Math.max(prevEnd, match.start - WINDOW), match.start);

    // Formato FerreiraCosta / MDC (ex: 360 UN-1-UN)
    const landmark = packLandmark.exec(windowBefore) || packLandmark.exec(windowAfter);
    if (landmark) {
      return {
        sku: match.code,
        quantidade: parseFloat(landmark[1].replace(',', '.')),
        embalagem: parseInt(landmark[3], 10) || 1,
        detectedType: match.type
      };
    }

    const afterRes = scanWindow(windowAfter, false);
    const beforeRes = scanWindow(windowBefore, true);
    let combo: { quantidade: number; embalagem: number } | null = null;

    if (afterRes && beforeRes) {
      const afterDist = afterRes.pos;
      const beforeDist = windowBefore.length - beforeRes.pos - beforeRes.len;
      combo = afterDist <= beforeDist ? afterRes.data : beforeRes.data;
    } else if (afterRes) {
      combo = afterRes.data;
    } else if (beforeRes) {
      combo = beforeRes.data;
    }

    if (combo) {
      return {
        sku: match.code,
        embalagem: combo.embalagem,
        quantidade: combo.quantidade,
        detectedType: match.type
      };
    }

    const embMatch = embOnlyRegex.exec(windowAfter) || embOnlyRegex.exec(windowBefore);
    const qtdMatch = qtdOnlyRegex.exec(windowAfter) || qtdOnlyRegex.exec(windowBefore);
    const qtdRaw = qtdMatch ? qtdMatch[1] : null;

    return {
      sku: match.code,
      embalagem: embMatch ? parseInt(embMatch[1], 10) || 1 : 1,
      quantidade: qtdRaw ? parseFloat(qtdRaw.replace(',', '.')) : 1,
      detectedType: match.type
    };
  });
}

export interface StoreSegment {
  label: string;
  text: string;
  cnpj?: string;
  orderNumber?: string;
}

/**
 * Extrai número de CNPJ formatado de um bloco de texto
 */
export function extractCnpjFromText(text: string): string | undefined {
  // Padrão formatado com pontos e barra: 00.000.000/0000-00
  const formatted = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/.exec(text);
  if (formatted) return formatted[1];

  // Com rótulo CNPJ / C.N.P.J. / CGC
  const labeled = /(?:CNPJ|C\.N\.P\.J\.?|CGC)[:\s]*(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}|\d{14})\b/i.exec(text);
  if (labeled) {
    const raw = labeled[1].replace(/\D/g, '');
    if (raw.length === 14) {
      return `${raw.slice(0, 2)}.${raw.slice(2, 5)}.${raw.slice(5, 8)}/${raw.slice(8, 12)}-${raw.slice(12, 14)}`;
    }
    return labeled[1];
  }
  return undefined;
}

/**
 * Divide o texto do pedido por OC / Número do Pedido / Loja / Filial quando houver múltiplos pedidos no mesmo PDF
 */
export function splitIntoStores(text: string): StoreSegment[] {
  // 1. Detecção por Múltiplos Números de Pedido / OC / Ordem de Compra
  const orderRegex = /(?:N[úu]mero\s+(?:do\s+)?Pedido|N[ºo°]\s*(?:do\s*)?Pedido|PEDIDO(?:\s+DE\s+COMPRA[S]?)?|ORDEM\s+DE\s+COMPRA|O\.?C\.?)\s*[:#.]?\s*([0-9A-Z\/\-_]{3,15})/gi;
  const orderMatches: Array<{ index: number; orderNumber: string; filial?: string }> = [];
  let ordM: RegExpExecArray | null;

  while ((ordM = orderRegex.exec(text)) !== null) {
    const orderNumber = ordM[1].trim();
    // Procura por Filial ou Loja nas proximidades (até 120 caracteres)
    const context = text.slice(ordM.index, Math.min(text.length, ordM.index + 120));
    const filialMatch = /(?:Filial|Loja|Unidade)\s*[:#.]?\s*(\d+|[A-Z0-9\s—–-]+?)(?:\s+Data|\s+COMPRA|\s+CNPJ|\s+Fornecedor|\n|\r|$)/i.exec(context);
    const filial = filialMatch ? filialMatch[1].trim() : undefined;
    orderMatches.push({ index: ordM.index, orderNumber, filial });
  }

  // Agrupa primeiras ocorrências de cada número de pedido distinto
  const distinctOrders: Array<{ index: number; orderNumber: string; filial?: string }> = [];
  const seenOrders = new Set<string>();

  orderMatches.forEach(om => {
    if (!seenOrders.has(om.orderNumber)) {
      seenOrders.add(om.orderNumber);
      distinctOrders.push(om);
    }
  });

  if (distinctOrders.length >= 2) {
    distinctOrders.sort((a, b) => a.index - b.index);
    const segments: StoreSegment[] = [];
    for (let i = 0; i < distinctOrders.length; i++) {
      const start = i === 0 ? 0 : distinctOrders[i].index - 30;
      const end = i + 1 < distinctOrders.length ? distinctOrders[i + 1].index - 30 : text.length;
      const sliceText = text.slice(Math.max(0, start), end);
      const cnpj = extractCnpjFromText(sliceText);
      const occ = distinctOrders[i];
      const filialStr = occ.filial ? ` · Filial ${occ.filial}` : '';
      const cnpjStr = cnpj ? ` (CNPJ: ${cnpj})` : '';
      const label = `OC ${occ.orderNumber}${filialStr}${cnpjStr}`;
      segments.push({
        label,
        text: sliceText,
        cnpj,
        orderNumber: occ.orderNumber
      });
    }
    return segments;
  }

  // 2. Casa Vieira (Rotina 210)
  const cvStoreRegex = /Empresa\s+(\d+)\s+([A-Z0-9\s\.\-—–]+?)(?:\s+CNPJ|\s+IE|\s+UF|\n|\r)/gi;
  const cvMatches: Array<{ index: number; label: string; empNum: string }> = [];
  let cvM: RegExpExecArray | null;
  while ((cvM = cvStoreRegex.exec(text)) !== null) {
    const empNum = cvM[1];
    const empName = cvM[2].replace(/[=\|]+/g, '').trim();
    cvMatches.push({
      index: cvM.index,
      empNum,
      label: `Empresa ${empNum} — ${empName}`
    });
  }

  if (cvMatches.length >= 2) {
    const segments: StoreSegment[] = [];
    for (let i = 0; i < cvMatches.length; i++) {
      const start = cvMatches[i].index;
      const end = i + 1 < cvMatches.length ? cvMatches[i + 1].index : text.length;
      const sliceText = text.slice(start, end);
      const cnpj = extractCnpjFromText(sliceText);
      const label = cnpj ? `${cvMatches[i].label} (CNPJ: ${cnpj})` : cvMatches[i].label;
      segments.push({ label, text: sliceText, cnpj });
    }
    return segments;
  }

  // 3. Consinco / TOTVS / Centerbox
  const consincoStoreRegex = /PEDIDO\s+DE\s+COMPRAS\s+([0-9A-Z\/]+)[\s\S]{1,120}?R\.\s*Social\s+([^\n\r]+)/gi;
  const consincoMatches: Array<{ index: number; label: string; pedNum: string }> = [];
  let conM: RegExpExecArray | null;
  while ((conM = consincoStoreRegex.exec(text)) !== null) {
    const pedNum = conM[1];
    const rSocial = conM[2].replace(/[=\|]+/g, '').trim();
    consincoMatches.push({
      index: conM.index,
      pedNum,
      label: `Ped. ${pedNum} — ${rSocial}`
    });
  }

  if (consincoMatches.length >= 2) {
    const segments: StoreSegment[] = [];
    for (let i = 0; i < consincoMatches.length; i++) {
      const start = consincoMatches[i].index;
      const end = i + 1 < consincoMatches.length ? consincoMatches[i + 1].index : text.length;
      const sliceText = text.slice(start, end);
      const cnpj = extractCnpjFromText(sliceText);
      const label = cnpj ? `${consincoMatches[i].label} (CNPJ: ${cnpj})` : consincoMatches[i].label;
      segments.push({ label, text: sliceText, cnpj, orderNumber: consincoMatches[i].pedNum });
    }
    return segments;
  }

  // 4. Loja / Filial explícita
  const lojaRegex = /(?:===+\s*)?(?:LOJA\s+(\d+|[A-Z0-9\s—–-]+)|FILIAL(?:\s+DE\s+DESTINO)?\s*[:\s]+(\d+|[A-Z0-9\s—–-]+))(?:\s*[:—–-]\s*([^\n\r]+))?/gi;
  const lojaMatches: Array<{ index: number; label: string }> = [];
  let m: RegExpExecArray | null;

  while ((m = lojaRegex.exec(text)) !== null) {
    const rawName = (m[1] || m[2] || '').trim();
    const subDesc = (m[3] || '').trim();
    let label = `Loja ${rawName}`;
    if (subDesc && !subDesc.startsWith('=')) {
      label += ` — ${subDesc.replace(/[=\|]+/g, '').trim()}`;
    }
    lojaMatches.push({ index: m.index, label });
  }

  if (lojaMatches.length >= 2) {
    const segments: StoreSegment[] = [];
    for (let i = 0; i < lojaMatches.length; i++) {
      const start = lojaMatches[i].index;
      const end = i + 1 < lojaMatches.length ? lojaMatches[i + 1].index : text.length;
      const sliceText = text.slice(start, end);
      const cnpj = extractCnpjFromText(sliceText);
      const label = cnpj ? `${lojaMatches[i].label} (CNPJ: ${cnpj})` : lojaMatches[i].label;
      segments.push({ label, text: sliceText, cnpj });
    }
    return segments;
  }

  // 5. Detecção por múltiplos CNPJs no documento
  const allCnpjs: Array<{ index: number; cnpj: string }> = [];
  const cnpjGlobalRegex = /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/g;
  let cMatch: RegExpExecArray | null;
  while ((cMatch = cnpjGlobalRegex.exec(text)) !== null) {
    allCnpjs.push({ index: cMatch.index, cnpj: cMatch[1] });
  }

  // Se tiver 2 ou mais CNPJs distintos
  const uniqueCnpjSet = new Set(allCnpjs.map(c => c.cnpj));
  if (uniqueCnpjSet.size >= 2) {
    const distinctFirstOccurrences: Array<{ index: number; cnpj: string }> = [];
    const seenC = new Set<string>();
    allCnpjs.forEach(c => {
      if (!seenC.has(c.cnpj)) {
        seenC.add(c.cnpj);
        distinctFirstOccurrences.push(c);
      }
    });

    distinctFirstOccurrences.sort((a, b) => a.index - b.index);
    if (distinctFirstOccurrences.length >= 2) {
      const segments: StoreSegment[] = [];
      for (let i = 0; i < distinctFirstOccurrences.length; i++) {
        const start = i === 0 ? 0 : distinctFirstOccurrences[i].index - 60;
        const end = i + 1 < distinctFirstOccurrences.length ? distinctFirstOccurrences[i + 1].index - 60 : text.length;
        const sliceText = text.slice(Math.max(0, start), end);
        const cnpj = distinctFirstOccurrences[i].cnpj;
        segments.push({
          label: `CNPJ ${cnpj}`,
          text: sliceText,
          cnpj
        });
      }
      return segments;
    }
  }

  // 6. Identificação por cabeçalho em loja/pedido único
  const singleOrder = distinctOrders.length === 1 ? distinctOrders[0] : null;
  const fcHeaderMatch = /TRAMONTINA\s+MAD\s+(\d+)/i.exec(text);
  const destMatch = /Loja\s+Destino[\s\S]{1,60}?(MDC[^\n\r]*|FERREIRA\s+COSTA[^\n\r]*)/i.exec(text);
  const carajasMatch = /Ref\.:\s*(?:\(Referência do Local\)\s*)?([^\n\r]+)/i.exec(text);
  const cfSingleMatch = /Filial(?:\s+de\s+destino)?:\s*([^\n\r\/]+)/i.exec(text);
  const singleCnpj = extractCnpjFromText(text);
  
  let defaultLabel = 'Loja Principal';
  if (singleOrder) {
    const filialStr = singleOrder.filial ? ` · Filial ${singleOrder.filial}` : '';
    defaultLabel = `OC ${singleOrder.orderNumber}${filialStr}`;
  } else if (fcHeaderMatch && destMatch) {
    defaultLabel = `TRAMONTINA MAD ${fcHeaderMatch[1]} — ${destMatch[1].trim()}`;
  } else if (fcHeaderMatch) {
    defaultLabel = `TRAMONTINA MAD ${fcHeaderMatch[1]}`;
  } else if (destMatch) {
    defaultLabel = destMatch[1].trim();
  } else if (carajasMatch) {
    defaultLabel = carajasMatch[1].trim();
  } else if (cfSingleMatch) {
    defaultLabel = cfSingleMatch[1].trim();
  } else if (singleCnpj) {
    defaultLabel = `CNPJ: ${singleCnpj}`;
  }

  return [{
    label: defaultLabel,
    text,
    cnpj: singleCnpj,
    orderNumber: singleOrder ? singleOrder.orderNumber : undefined
  }];
}

/**
 * Função principal de extração: processa linhas estruturadas de tabela primeiro
 * para garantir 100% de captura de pedidos densos e múltiplos ERPs.
 */
export function extractSkusFromText(
  text: string,
  sourceName: string,
  mode: SkuExtractionMode,
  origem: OrigemType,
  separarLoja: boolean
): OrderItem[] {
  // Identifica OCs / lojas / filiais e CNPJs para garantir a integridade dos dados
  const segments = splitIntoStores(text);
  const allItems: OrderItem[] = [];

  segments.forEach(seg => {
    const lines = seg.text.split(/[\r\n]+/);
    const storeItems: OrderItem[] = [];
    const processedLineIndices = new Set<number>();
    const effectiveLabel = (separarLoja || segments.length > 1) ? seg.label : 'Loja Principal';

    // 1º Passo: Executa o parser estruturado linha por linha
    lines.forEach((line, lineIdx) => {
      const parsed = parseTabularLine(line);
      if (parsed && parsed.isMatch) {
        let chosenSku: string | undefined;

        if (mode === 'ean') {
          chosenSku = parsed.ean || parsed.skuRef;
        } else if (mode === 'ref') {
          chosenSku = parsed.skuRef || parsed.ean;
        } else {
          // Modo 'auto': prioriza referência Tramontina formatada (5+3 dígitos), se ausente usa EAN
          chosenSku = parsed.skuRef || parsed.ean;
        }

        if (chosenSku) {
          processedLineIndices.add(lineIdx);
          const isEan = chosenSku.length === 13 && /^\d{13}$/.test(chosenSku);
          storeItems.push({
            id: `${sourceName}-${seg.label}-${Date.now()}-${storeItems.length}-${Math.random().toString(36).substr(2, 4)}`,
            sku: chosenSku,
            embalagem: parsed.embalagem || 1,
            quantidade: parsed.quantidade || 1,
            origem: origem,
            desconto: 0,
            source: sourceName,
            loja: effectiveLabel,
            orderNumber: seg.orderNumber,
            cnpj: seg.cnpj,
            detectedType: isEan ? 'ean13' : 'tramontina_ref',
            isValidSku: isEan ? false : isValidTramontinaSku(chosenSku)
          });
        }
      }
    });

    // Se o parser de linha capturou itens com alta densidade, usamos esses resultados
    if (storeItems.length > 0) {
      // Linhas não processadas com produtos em formato livre
      const unprocessedText = lines
        .filter((_, idx) => !processedLineIndices.has(idx))
        .join('\n');

      const extractor = mode === 'ean' ? extractEanCodes : mode === 'ref' ? extractReferenceCodes : extractAutoCodes;
      const leftoverMatches = extractor(unprocessedText);
      if (leftoverMatches.length > 0) {
        const leftoverWithData = attachPackagingAndQuantity(leftoverMatches, unprocessedText);
        leftoverWithData.forEach((d, index) => {
          const cleanSku = d.sku.replace(/[\/\-\.\s]/g, '');
          const alreadyAdded = storeItems.some(it => it.sku.replace(/[\/\-\.\s]/g, '') === cleanSku);
          if (!alreadyAdded) {
            storeItems.push({
              id: `${sourceName}-${seg.label}-leftover-${Date.now()}-${index}`,
              sku: d.sku,
              embalagem: d.embalagem,
              quantidade: d.quantidade,
              origem: origem,
              desconto: 0,
              source: sourceName,
              loja: effectiveLabel,
              orderNumber: seg.orderNumber,
              cnpj: seg.cnpj,
              detectedType: d.detectedType,
              isValidSku: isValidTramontinaSku(d.sku)
            });
          }
        });
      }

      allItems.push(...storeItems);
      return;
    }

    // 2º Passo: Fallback para formato livre / texto corrido
    const extractor = mode === 'ean' ? extractEanCodes : mode === 'ref' ? extractReferenceCodes : extractAutoCodes;
    const rawMatches = extractor(seg.text);
    const withData = attachPackagingAndQuantity(rawMatches, seg.text);

    const items = withData.map((d, index) => ({
      id: `${sourceName}-${seg.label}-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 4)}`,
      sku: d.sku,
      embalagem: d.embalagem,
      quantidade: d.quantidade,
      origem: origem,
      desconto: 0,
      source: sourceName,
      loja: effectiveLabel,
      orderNumber: seg.orderNumber,
      cnpj: seg.cnpj,
      detectedType: d.detectedType,
      isValidSku: isValidTramontinaSku(d.sku)
    }));

    allItems.push(...items);
  });

  return allItems;
}

/**
 * Deduplica itens estritamente POR OC / CNPJ / LOJA:
 * Se um mesmo SKU estiver presente na OC 1 e na OC 2,
 * AMBOS os itens são preservados para faturamento independente!
 * Apenas duplicatas do MESMO SKU dentro da MESMA OC / Loja são consolidadas.
 */
export function dedupeItems(list: OrderItem[]): OrderItem[] {
  const map = new Map<string, OrderItem>();

  list.forEach(item => {
    const cleanSku = item.sku.replace(/[\/\-\.\s]/g, '');
    if (!cleanSku) return;

    // Chave única composta por OC / Loja / CNPJ + SKU
    const storeKey = (item.orderNumber || item.loja || item.cnpj || item.source || 'loja-padrao')
      .trim()
      .toLowerCase();
    
    const uniqueKey = `${storeKey}:::${cleanSku}`;

    if (!map.has(uniqueKey)) {
      map.set(uniqueKey, { ...item });
    } else {
      // Se duplicado na mesma OC/loja, soma as quantidades e preserva 1 registro único
      const existing = map.get(uniqueKey)!;
      const currentQty = typeof existing.quantidade === 'number' ? existing.quantidade : parseFloat(String(existing.quantidade).replace(',', '.')) || 0;
      const newQty = typeof item.quantidade === 'number' ? item.quantidade : parseFloat(String(item.quantidade).replace(',', '.')) || 0;
      existing.quantidade = currentQty + newQty;
    }
  });

  return Array.from(map.values());
}
