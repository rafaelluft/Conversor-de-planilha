import { OrderItem, OrigemType } from '../types';

export const ITEM_LIMIT = 99;

export function safeFileName(label: string): string {
  // Se for formato de CNPJ (ex: "CNPJ: 15.205.628/0001-09")
  if (/^CNPJ\s*[:\s]*[\d\.\/\-]+$/i.test(label)) {
    const digits = label.replace(/\D/g, '');
    return `CNPJ_${digits}`;
  }

  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/**
 * Determina o nome ideal para a planilha exportada da OC ou Loja.
 * Prioriza o nome da OC (ex: "OC_1842749") ou o nome da loja/filial separada.
 */
export function getStoreFileName(loja: string, items?: OrderItem[], origem?: OrigemType): string {
  const cleanLoja = (loja || '').trim();

  // Se a loja tem nome descritivo (ex: "OC 1842749", "OC 1842749 · Filial 1", "Ped. 739407", "Empresa 1 - Casa Vieira")
  if (cleanLoja && cleanLoja !== 'Loja Principal' && cleanLoja !== 'Todas as Lojas') {
    // Se for apenas dígitos (ex: "1842749"), formata como OC_1842749
    if (/^\d{4,12}$/.test(cleanLoja)) {
      return `OC_${cleanLoja}`;
    }
    return safeFileName(cleanLoja);
  }

  // Se os itens possuem número de OC extraído (ex: orderNumber = "1842749")
  const orderNum = items?.find(it => it.orderNumber)?.orderNumber;
  if (orderNum) {
    const cleanOrder = safeFileName(orderNum);
    return cleanOrder.toUpperCase().startsWith('OC_') ? cleanOrder : `OC_${cleanOrder}`;
  }

  // Se tem nome do arquivo PDF de origem (ex: "pedido_supermercado.pdf")
  const sourceName = items?.find(it => it.source && it.source !== 'Texto Manual' && it.source !== 'Adicionado Manualmente')?.source;
  if (sourceName) {
    const cleanSource = safeFileName(sourceName.replace(/\.pdf$/i, ''));
    if (cleanSource) {
      return cleanSource;
    }
  }

  return `pedido_tramontina_${origem || 'VP'}`;
}

/**
 * Converte a lista de itens para o layout padrão de importação Tramontina:
 * SKU;Embalagem;Quantidade;Origem;Desconto
 */
export function rowsToCsv(list: OrderItem[], formatWithSlash = false): string {
  let csv = 'SKU;Embalagem;Quantidade;Origem;Desconto\r\n';
  list.forEach(r => {
    const skuFormatted = formatWithSlash ? r.sku : r.sku.replace(/\//g, '');
    const emb = r.embalagem ?? 1;
    const qtd = r.quantidade ?? 1;
    const orig = r.origem ?? 'VP';
    const desc = r.desconto ?? 0;
    csv += `${skuFormatted};${emb};${qtd};${orig};${desc}\r\n`;
  });
  return csv;
}

/**
 * Formata para copiar direto para a Área de Transferência (colar no Excel/SAP)
 */
export function rowsToTsv(list: OrderItem[]): string {
  let tsv = 'SKU\tEmbalagem\tQuantidade\tOrigem\tDesconto\tLoja\r\n';
  list.forEach(r => {
    tsv += `${r.sku}\t${r.embalagem}\t${r.quantidade}\t${r.origem}\t${r.desconto}\t${r.loja}\r\n`;
  });
  return tsv;
}

export function chunkRows<T>(list: T[], size: number = ITEM_LIMIT): T[][] {
  if (list.length === 0) return [[]];
  const chunks: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    chunks.push(list.slice(i, i + size));
  }
  return chunks;
}

export function triggerDownload(csvText: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + csvText], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadRowsAsCsv(
  list: OrderItem[],
  baseName: string,
  formatWithSlash = false,
  startDelay = 0
): { totalFiles: number; fileNames: string[] } {
  const chunks = chunkRows(list, ITEM_LIMIT);
  const fileNames: string[] = [];

  chunks.forEach((chunk, i) => {
    const suffix = chunks.length > 1 ? `_parte${i + 1}de${chunks.length}` : '';
    const fileName = `${baseName}${suffix}.csv`;
    fileNames.push(fileName);
    setTimeout(() => {
      triggerDownload(rowsToCsv(chunk, formatWithSlash), fileName);
    }, startDelay + i * 350);
  });

  return { totalFiles: chunks.length, fileNames };
}
