import React from 'react';
import { X, Layers, CheckCircle2, ShieldCheck, FileSpreadsheet, Building2, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#004B87] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Guia de Uso & Regras Tramontina</h3>
              <p className="text-xs text-blue-100">Como funciona o extrator inteligente de pedidos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-700 leading-relaxed">
          
          {/* Section 1 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
              <Layers className="w-4 h-4 text-[#004B87]" />
              <span>1. Padrão de Referências Tramontina (8 Dígitos)</span>
            </div>
            <p className="text-slate-600 mb-2">
              As referências de produtos do Grupo Tramontina possuem <strong>8 dígitos</strong> (5 prefixo + 3 sufixo), no formato <code className="bg-white px-1.5 py-0.5 rounded border font-mono font-bold text-[#004B87]">21199/993</code>, <code className="bg-white px-1.5 py-0.5 rounded border font-mono">21199-993</code> ou <code className="bg-white px-1.5 py-0.5 rounded border font-mono">21199993</code>.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] pt-1">
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 1:</span> Avides / Cutelaria
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 2:</span> Cutelaria
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 4:</span> Garibaldi
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 5:</span> Eletrik
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 6:</span> Farroupilha
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 7:</span> Multi
              </div>
              <div className="bg-white p-2 rounded border border-slate-200">
                <span className="font-bold text-[#004B87]">Início da ref 9:</span> Delta
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              * O extrator ignora automaticamente CEPs, CNPJs, telefones e inscrições estaduais para evitar falsos positivos.
            </p>
          </div>

          {/* Section 2 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>2. Detecção de Embalagem (CX) e Quantidade</span>
            </div>
            <p className="text-slate-600">
              O algoritmo analisa inteligentemente o layout do pedido para identificar:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-1 text-slate-600">
              <li><strong>Caixa Master (CX / EMB):</strong> Extrai a quantidade pedida e a embalagem múltipla (Ex: 12 un/cx).</li>
              <li><strong>Unidade Avulsa (UN / UND / CJ):</strong> Define embalagem padrão 1 e captura a quantidade real sem confundir com o preço unitário.</li>
              <li><strong>Modelos ERP complexos:</strong> Suporte nativo a relatórios Consinco, Totvs, Ferreira Costa, MDC e Business Integrator.</li>
            </ul>
          </div>

          {/* Section 3 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
              <Building2 className="w-4 h-4 text-indigo-600" />
              <span>3. Separação por Loja / Multi-CNPJ</span>
            </div>
            <p className="text-slate-600">
              Ao ativar <strong>"Separar por loja"</strong>, pedidos de grandes redes com múltiplas filiais no mesmo PDF são agrupados por CNPJ ou Razão Social, permitindo download consolidado ou individual por loja.
            </p>
          </div>

          {/* Section 4 */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4">
            <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-2">
              <FileSpreadsheet className="w-4 h-4 text-amber-600" />
              <span>4. Regra de Limite ERP (99 Itens por Arquivo)</span>
            </div>
            <p className="text-slate-600">
              Para atender aos limites de importação em sistemas corporativos da Tramontina, pedidos com mais de <strong>99 itens</strong> são divididos automaticamente em arquivos complementares sequenciais (<code className="bg-white px-1 py-0.5 rounded border font-mono text-[10px]">_parte1de2.csv</code>, <code className="bg-white px-1 py-0.5 rounded border font-mono text-[10px]">_parte2de2.csv</code>).
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Processamento local: nenhum dado de pedido sai do seu computador.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#004B87] hover:bg-[#003B6D] text-white font-semibold text-xs rounded-lg transition-colors cursor-pointer"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
