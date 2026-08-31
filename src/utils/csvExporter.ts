import { OrderItem } from '../types';

export const ITEM_LIMIT = 99;

export function safeFileName(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
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
  formatWithSlash = false
): { totalFiles: number; fileNames: string[] } {
  const chunks = chunkRows(list, ITEM_LIMIT);
  const fileNames: string[] = [];

  chunks.forEach((chunk, i) => {
    const suffix = chunks.length > 1 ? `_parte${i + 1}de${chunks.length}` : '';
    const fileName = `${baseName}${suffix}.csv`;
    fileNames.push(fileName);
    setTimeout(() => {
      triggerDownload(rowsToCsv(chunk, formatWithSlash), fileName);
    }, i * 350);
  });

  return { totalFiles: chunks.length, fileNames };
}
