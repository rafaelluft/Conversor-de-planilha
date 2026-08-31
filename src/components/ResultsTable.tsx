import React, { useState, useMemo } from 'react';
import {
  Download,
  Copy,
  Plus,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  Building,
  Package,
  Layers,
  FileSpreadsheet,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { OrderItem, OrigemType } from '../types';
import { rowsToTsv, downloadRowsAsCsv, safeFileName, ITEM_LIMIT } from '../utils/csvExporter';
import confetti from 'canvas-confetti';

interface ResultsTableProps {
  rows: OrderItem[];
  origem: OrigemType;
  separarLoja: boolean;
  excluirDuplicados: boolean;
  formatWithSlash: boolean;
  onUpdateRow: (id: string, field: keyof OrderItem, value: any) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: () => void;
  onClearRows: () => void;
  onNotify: (text: string, type: 'ok' | 'warn' | 'info') => void;
}

export const ResultsTable: React.FC<ResultsTableProps> = ({
  rows,
  origem,
  separarLoja,
  excluirDuplicados,
  formatWithSlash,
  onUpdateRow,
  onDeleteRow,
  onAddRow,
  onNotify,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);
  const [collapsedStores, setCollapsedStores] = useState<Record<string, boolean>>({});

  // Filter rows based on search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return rows;
    const term = searchTerm.toLowerCase();
    return rows.filter(
      r =>
        r.sku.toLowerCase().includes(term) ||
        r.loja.toLowerCase().includes(term) ||
        r.source.toLowerCase().includes(term)
    );
  }, [rows, searchTerm]);

  // Group by store
  const storeGroups = useMemo(() => {
    const map = new Map<string, OrderItem[]>();
    filteredRows.forEach(r => {
      const list = map.get(r.loja) || [];
      list.push(r);
      map.set(r.loja, list);
    });
    return Array.from(map.entries()).map(([loja, items]) => ({
      loja,
      items,
      totalQty: items.reduce((sum, item) => sum + (Number(item.quantidade) || 0), 0),
    }));
  }, [filteredRows]);

  const totalQuantity = useMemo(() => {
    return filteredRows.reduce((sum, r) => sum + (Number(r.quantidade) || 0), 0);
  }, [filteredRows]);

  const uniqueFiles = useMemo(() => {
    return new Set(rows.map(r => r.source)).size;
  }, [rows]);

  const validSkusCount = useMemo(() => {
    return filteredRows.filter(r => r.isValidSku).length;
  }, [filteredRows]);

  const handleCopyClipboard = async () => {
    try {
      const tsv = rowsToTsv(filteredRows);
      await navigator.clipboard.writeText(tsv);
      setCopied(true);
      onNotify('Itens copiados para a Área de Transferência! Pronto para colar no Excel ou ERP.', 'ok');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify('Não foi possível copiar automaticamente para a área de transferência.', 'warn');
    }
  };

  const handleDownloadAllCsv = () => {
    if (filteredRows.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    const { totalFiles } = downloadRowsAsCsv(
      filteredRows,
      `pedido_tramontina_${origem}_${stamp}`,
      formatWithSlash
    );

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    } catch {
      // ignore
    }

    if (totalFiles > 1) {
      onNotify(
        `Pedido com ${filteredRows.length} itens: gerados ${totalFiles} arquivos .CSV (limite de ${ITEM_LIMIT} itens por arquivo para importação no ERP).`,
        'ok'
      );
    } else {
      onNotify(`Planilha .CSV gerada e baixada com sucesso (${filteredRows.length} itens)!`, 'ok');
    }
  };

  const handleDownloadSingleStore = (lojaName: string, storeItems: OrderItem[]) => {
    const stamp = new Date().toISOString().slice(0, 10);
    const { totalFiles } = downloadRowsAsCsv(
      storeItems,
      `pedido_${origem}_${safeFileName(lojaName)}_${stamp}`,
      formatWithSlash
    );

    if (totalFiles > 1) {
      onNotify(
        `Loja "${lojaName}" com ${storeItems.length} itens: gerados ${totalFiles} arquivos (limite de ${ITEM_LIMIT} itens por arquivo).`,
        'ok'
      );
    } else {
      onNotify(`Arquivo .CSV da loja "${lojaName}" gerado com sucesso!`, 'ok');
    }
  };

  const handleDownloadAllStoresSeparately = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    let queueCount = 0;

    storeGroups.forEach((group, groupIdx) => {
      const items = group.items;
      const { totalFiles } = downloadRowsAsCsv(
        items,
        `pedido_${origem}_${safeFileName(group.loja)}_${stamp}`,
        formatWithSlash
      );
      queueCount += totalFiles;
    });

    try {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.8 } });
    } catch {
      // ignore
    }

    onNotify(`Iniciando download de ${storeGroups.length} lojas (${queueCount} arquivos no total).`, 'ok');
  };

  const toggleStoreCollapse = (loja: string) => {
    setCollapsedStores(prev => ({ ...prev, [loja]: !prev[loja] }));
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 transition-all">
      {/* Step Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#004B87] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            3
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Conferência & Download da Planilha
            </h2>
            <p className="text-xs text-slate-500">
              Revise os códigos extraídos, ajuste quantidades ou adicione itens manualmente
            </p>
          </div>
        </div>

        {/* Global actions */}
        {rows.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="addRow"
              onClick={onAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Adicionar Linha</span>
            </button>

            <button
              type="button"
              onClick={handleCopyClipboard}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              title="Copiar tabela formatada para colar no Excel ou SAP"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Excel'}</span>
            </button>

            {!separarLoja ? (
              <button
                type="button"
                id="downloadCsv"
                onClick={handleDownloadAllCsv}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-[#004B87] hover:bg-[#003B6D] text-white shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Planilha (.CSV)</span>
              </button>
            ) : (
              <button
                type="button"
                id="downloadAllLojas"
                onClick={handleDownloadAllStoresSeparately}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-[#004B87] hover:bg-[#003B6D] text-white shadow-sm transition-all cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Todas as OCs / Lojas ({storeGroups.length})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Metric Cards */}
      {rows.length > 0 && (
        <div id="summaryRow" className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <FileSpreadsheet className="w-3.5 h-3.5 text-[#004B87]" />
              <span>Itens no Pedido</span>
            </div>
            <div className="text-xl font-bold text-slate-900" id="metricCount">
              {filteredRows.length}
            </div>
            <div className="text-[10px] text-slate-400">
              {excluirDuplicados ? 'Deduplicados' : 'Itens totais'}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Package className="w-3.5 h-3.5 text-emerald-600" />
              <span>Peças Totais</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {totalQuantity.toLocaleString('pt-BR')}
            </div>
            <div className="text-[10px] text-slate-400">Soma das quantidades</div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <Building className="w-3.5 h-3.5 text-indigo-600" />
              <span>Lojas / Filiais</span>
            </div>
            <div className="text-xl font-bold text-slate-900" id="metricFiles">
              {separarLoja ? storeGroups.length : `${uniqueFiles} arquivo(s)`}
            </div>
            <div className="text-[10px] text-slate-400">
              {separarLoja ? 'Grupos de faturamento' : 'Arquivos processados'}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-lg p-3">
            <div className="flex items-center gap-2 text-slate-500 text-xs font-medium mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#004B87]" />
              <span>Validação Tramontina</span>
            </div>
            <div className="text-xl font-bold text-slate-900">
              {validSkusCount} <span className="text-xs font-normal text-slate-500">/ {filteredRows.length}</span>
            </div>
            <div className="text-[10px] text-emerald-700 font-medium">
              {filteredRows.length > 0 ? `${Math.round((validSkusCount / filteredRows.length) * 100)}% refs válidas` : '0%'}
            </div>
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      {rows.length > 0 && (
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar SKU, loja ou arquivo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#004B87]/20 focus:border-[#004B87] outline-none text-slate-800"
            />
          </div>

          <div className="text-xs text-slate-500">
            Mostrando <strong>{filteredRows.length}</strong> de {rows.length} itens
          </div>
        </div>
      )}

      {/* Table Content or Empty State */}
      <div id="tableWrap">
        {rows.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-[#004B87] flex items-center justify-center mx-auto mb-3">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Ainda não há itens extraídos</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              Suba o PDF da ordem de compra ou cole o texto no Passo 1 e clique em <strong>"Extrair Referências"</strong>.
            </p>
          </div>
        ) : !separarLoja ? (
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-inner bg-white">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-600 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Código SKU / Ref</th>
                  <th className="py-2.5 px-3 w-28">Embalagem</th>
                  <th className="py-2.5 px-3 w-28">Quantidade</th>
                  <th className="py-2.5 px-3 w-24">Origem</th>
                  <th className="py-2.5 px-3 w-20">Desconto</th>
                  <th className="py-2.5 px-3">Arquivo / Origem</th>
                  <th className="py-2.5 px-3 w-10 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRows.map((row, idx) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    index={idx + 1}
                    onUpdate={onUpdateRow}
                    onDelete={onDeleteRow}
                  />
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Multi-Store View */
          <div className="space-y-4">
            {storeGroups.map((group) => {
              const isCollapsed = !!collapsedStores[group.loja];
              return (
                <div key={group.loja} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                  <div className="bg-slate-100/90 px-4 py-2.5 flex items-center justify-between border-b border-slate-200">
                    <div
                      onClick={() => toggleStoreCollapse(group.loja)}
                      className="flex items-center gap-2 cursor-pointer select-none"
                    >
                      <Building className="w-4 h-4 text-[#004B87]" />
                      <div>
                        <span className="font-bold text-xs text-slate-800">{group.loja}</span>
                        <span className="text-[11px] text-slate-500 ml-2">
                          ({group.items.length} itens · {group.totalQty} un)
                        </span>
                      </div>
                      {isCollapsed ? (
                        <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
                      ) : (
                        <ChevronUp className="w-3.5 h-3.5 text-slate-500 ml-1" />
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadSingleStore(group.loja, group.items)}
                      className="loja-download inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-white hover:bg-blue-50 border border-slate-200 text-[#004B87] transition-colors cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>Baixar CSV desta loja</span>
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <th className="py-2 px-3 w-10 text-center">#</th>
                            <th className="py-2 px-3">Código SKU / Ref</th>
                            <th className="py-2 px-3 w-28">Embalagem</th>
                            <th className="py-2 px-3 w-28">Quantidade</th>
                            <th className="py-2 px-3 w-24">Origem</th>
                            <th className="py-2 px-3 w-20">Desconto</th>
                            <th className="py-2 px-3">Origem</th>
                            <th className="py-2 px-3 w-10 text-center"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {group.items.map((row, idx) => (
                            <TableRow
                              key={row.id}
                              row={row}
                              index={idx + 1}
                              onUpdate={onUpdateRow}
                              onDelete={onDeleteRow}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};

interface TableRowProps {
  row: OrderItem;
  index: number;
  onUpdate: (id: string, field: keyof OrderItem, value: any) => void;
  onDelete: (id: string) => void;
}

const TableRow: React.FC<TableRowProps> = ({ row, index, onUpdate, onDelete }) => {
  return (
    <tr className="hover:bg-blue-50/40 transition-colors group">
      {/* Index */}
      <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
        {index}
      </td>

      {/* SKU with validation badge */}
      <td className="py-2 px-3">
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={row.sku}
            onChange={(e) => onUpdate(row.id, 'sku', e.target.value)}
            className="w-36 font-mono text-xs font-semibold text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#004B87] rounded px-2 py-1 outline-none transition-all"
            placeholder="Ex: 24011/008"
          />
          {row.isValidSku ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800"
              title="Referência Tramontina Válida (8 dígitos)"
            >
              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
              <span>Ref</span>
            </span>
          ) : row.detectedType === 'ean13' ? (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-[#004B87]"
              title="Código EAN-13 / GTIN"
            >
              EAN
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-800"
              title="Código manual ou formato customizado"
            >
              <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
              <span>Aviso</span>
            </span>
          )}
        </div>
      </td>

      {/* Embalagem */}
      <td className="py-2 px-3">
        <input
          type="number"
          min="1"
          value={row.embalagem}
          onChange={(e) => onUpdate(row.id, 'embalagem', Number(e.target.value) || 1)}
          className="w-20 font-mono text-xs text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#004B87] rounded px-2 py-1 outline-none transition-all"
        />
      </td>

      {/* Quantidade */}
      <td className="py-2 px-3">
        <input
          type="number"
          min="0.01"
          step="any"
          value={row.quantidade}
          onChange={(e) => onUpdate(row.id, 'quantidade', Number(e.target.value) || 0)}
          className="w-20 font-mono text-xs font-semibold text-[#004B87] bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#004B87] rounded px-2 py-1 outline-none transition-all"
        />
      </td>

      {/* Origem Selector per row */}
      <td className="py-2 px-3">
        <select
          value={row.origem}
          onChange={(e) => onUpdate(row.id, 'origem', e.target.value as OrigemType)}
          className="text-xs bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#004B87] rounded px-1.5 py-1 font-semibold text-slate-700 outline-none cursor-pointer"
        >
          <option value="VP">VP (Fábrica)</option>
          <option value="CD">CD (Nordeste)</option>
        </select>
      </td>

      {/* Desconto */}
      <td className="py-2 px-3">
        <input
          type="number"
          min="0"
          value={row.desconto}
          onChange={(e) => onUpdate(row.id, 'desconto', Number(e.target.value) || 0)}
          className="w-14 font-mono text-xs text-slate-600 bg-transparent hover:bg-slate-100 focus:bg-white border border-transparent hover:border-slate-300 focus:border-[#004B87] rounded px-2 py-1 outline-none transition-all"
        />
      </td>

      {/* Source & CNPJ / OC */}
      <td className="py-2 px-3 text-slate-500 font-sans text-[11px] max-w-xs" title={row.source}>
        <div className="truncate font-medium text-slate-600">{row.source}</div>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          {row.orderNumber && (
            <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] bg-blue-50 text-[#004B87] font-mono font-semibold border border-blue-200/60">
              OC: {row.orderNumber}
            </span>
          )}
          {row.cnpj && (
            <span className="text-[10px] text-slate-500 font-mono">CNPJ: {row.cnpj}</span>
          )}
        </div>
      </td>

      {/* Remove Button */}
      <td className="py-2 px-3 text-center">
        <button
          type="button"
          onClick={() => onDelete(row.id)}
          className="rm-btn p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
          title="Remover item da lista"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </td>
    </tr>
  );
};
