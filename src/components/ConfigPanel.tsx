import React from 'react';
import { Factory, Truck, Play, Trash2, Filter, Layers, CheckSquare, Loader2, Sparkles } from 'lucide-react';
import { OrigemType, SkuExtractionMode } from '../types';

interface ConfigPanelProps {
  origem: OrigemType;
  onOrigemChange: (val: OrigemType) => void;
  skuMode: SkuExtractionMode;
  onSkuModeChange: (val: SkuExtractionMode) => void;
  excluirDuplicados: boolean;
  onExcluirDuplicadosChange: (val: boolean) => void;
  separarLoja: boolean;
  onSepararLojaChange: (val: boolean) => void;
  formatWithSlash: boolean;
  onFormatWithSlashChange: (val: boolean) => void;
  onProcess: () => void;
  onClearAll: () => void;
  isProcessing: boolean;
  hasInput: boolean;
  statusMsg?: { text: string; type: 'ok' | 'warn' | 'info' } | null;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  origem,
  onOrigemChange,
  skuMode,
  onSkuModeChange,
  excluirDuplicados,
  onExcluirDuplicadosChange,
  separarLoja,
  onSepararLojaChange,
  formatWithSlash,
  onFormatWithSlashChange,
  onProcess,
  onClearAll,
  isProcessing,
  hasInput,
  statusMsg,
}) => {
  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 transition-all">
      {/* Step Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#004B87] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            2
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Origem & Parâmetros do Pedido
            </h2>
            <p className="text-xs text-slate-500">
              Selecione o centro distribuidor/fábrica e o padrão de extração desejado
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {/* Origem Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
            Origem de Faturamento (Fábrica vs CD)
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              id="btnVP"
              onClick={() => onOrigemChange('VP')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                origem === 'VP'
                  ? 'border-[#004B87] bg-blue-50/70 text-[#004B87] ring-1 ring-[#004B87] shadow-sm font-semibold'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${origem === 'VP' ? 'bg-[#004B87] text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Factory className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  VP Fábrica Tramontina
                  {origem === 'VP' && <span className="w-1.5 h-1.5 rounded-full bg-[#004B87]"></span>}
                </div>
                <div className="text-[11px] text-slate-500 font-normal">
                  Rio Grande do Sul / Pernambuco
                </div>
              </div>
            </button>

            <button
              type="button"
              id="btnCD"
              onClick={() => onOrigemChange('CD')}
              className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                origem === 'CD'
                  ? 'border-[#004B87] bg-blue-50/70 text-[#004B87] ring-1 ring-[#004B87] shadow-sm font-semibold'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className={`p-2 rounded-lg ${origem === 'CD' ? 'bg-[#004B87] text-white' : 'bg-slate-100 text-slate-500'}`}>
                <Truck className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  CD - Centro de distribuidor nordeste
                  {origem === 'CD' && <span className="w-1.5 h-1.5 rounded-full bg-[#004B87]"></span>}
                </div>
                <div className="text-[11px] text-slate-500 font-normal">
                  Bahia
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Extraction Filter & Mode */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div>
            <label htmlFor="skuFormat" className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>Código a extrair do documento:</span>
            </label>
            <select
              id="skuFormat"
              value={skuMode}
              onChange={(e) => onSkuModeChange(e.target.value as SkuExtractionMode)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:ring-2 focus:ring-[#004B87]/20 focus:border-[#004B87] outline-none cursor-pointer"
            >
              <option value="auto">Automático (Prioriza Referência 8 dígitos + EAN-13)</option>
              <option value="ref">Apenas Referência Tramontina (Ex: 21199/993)</option>
              <option value="ean">Apenas Código EAN (Código de barras 13 dígitos)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>Padrão do SKU no CSV exportado:</span>
            </label>
            <select
              value={formatWithSlash ? 'slash' : 'clean'}
              onChange={(e) => onFormatWithSlashChange(e.target.value === 'slash')}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-medium text-slate-800 focus:ring-2 focus:ring-[#004B87]/20 focus:border-[#004B87] outline-none cursor-pointer"
            >
              <option value="clean">Sem barra (Ex: 24011008) — Padrão ERP Tramontina</option>
              <option value="slash">Com barra (Ex: 24011/008) — Legível</option>
            </select>
          </div>
        </div>

        {/* Checkbox Options */}
        <div className="pt-2 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-xs text-slate-700 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                id="excluirDuplicados"
                checked={excluirDuplicados}
                onChange={(e) => onExcluirDuplicadosChange(e.target.checked)}
                className="w-4 h-4 rounded text-[#004B87] accent-[#004B87] border-slate-300 focus:ring-[#004B87]"
              />
              <span className="font-medium">
                Excluir duplicados por CNPJ <span className="text-slate-400 font-normal">(mantém itens entre lojas)</span>
              </span>
            </label>

            <label className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200 text-xs text-slate-700 cursor-pointer select-none transition-colors">
              <input
                type="checkbox"
                id="separarLoja"
                checked={separarLoja}
                onChange={(e) => onSepararLojaChange(e.target.checked)}
                className="w-4 h-4 rounded text-[#004B87] accent-[#004B87] border-slate-300 focus:ring-[#004B87]"
              />
              <span className="font-medium">
                Separar por Loja / OC <span className="text-slate-400 font-normal">(Multi-OC, CNPJ ou Filiais)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Actions & Status Alert */}
        <div className="pt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            id="processBtn"
            onClick={onProcess}
            disabled={!hasInput || isProcessing}
            className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold text-white shadow-sm transition-all cursor-pointer active:scale-95 ${
              !hasInput || isProcessing
                ? 'bg-slate-300 cursor-not-allowed text-slate-500 shadow-none'
                : 'bg-[#004B87] hover:bg-[#003B6D] hover:shadow-md'
            }`}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Processando PDF...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Extrair Referências Tramontina</span>
              </>
            )}
          </button>

          <button
            type="button"
            id="clearBtn"
            onClick={onClearAll}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-slate-400" />
            <span>Limpar tudo</span>
          </button>
        </div>

        {/* Status Message */}
        {statusMsg && (
          <div
            id="statusMsg"
            className={`p-3 rounded-lg text-xs font-medium flex items-start gap-2 border transition-all ${
              statusMsg.type === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : statusMsg.type === 'warn'
                ? 'bg-amber-50 text-amber-900 border-amber-200'
                : 'bg-blue-50 text-[#004B87] border-blue-200'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {statusMsg.type === 'ok' && <CheckSquare className="w-4 h-4 text-emerald-600" />}
              {statusMsg.type === 'warn' && <Filter className="w-4 h-4 text-amber-600" />}
              {statusMsg.type === 'info' && <Layers className="w-4 h-4 text-[#004B87]" />}
            </div>
            <div>{statusMsg.text}</div>
          </div>
        )}
      </div>
    </section>
  );
};
