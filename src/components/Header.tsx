import React from 'react';
import { FileSpreadsheet, HelpCircle, Building2, Layers } from 'lucide-react';

interface HeaderProps {
  onOpenHelp: () => void;
  hasItems: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onOpenHelp }) => {
  return (
    <header className="bg-gradient-to-r from-[#003B6D] via-[#004B87] to-[#0B5FA5] text-white shadow-md border-b border-[#002D54]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          
          {/* Brand & Title */}
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shadow-inner shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-white" />
            </div>
            
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase bg-white/15 text-white border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-sm animate-pulse"></span>
                  Tramontina
                </span>
              </div>
              
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mt-1 flex items-center gap-2">
                Conversor de Planilha
              </h1>
              <p className="text-xs sm:text-sm text-blue-100/90 font-normal">
                Extração automática de referências Tramontina e EANs a partir de ordens de compra em PDF
              </p>
            </div>
          </div>

          {/* Action button */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <button
              onClick={onOpenHelp}
              id="helpGuideBtn"
              type="button"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white text-[#004B87] hover:bg-blue-50 transition-all cursor-pointer shadow-sm active:scale-95 border border-white/30"
            >
              <HelpCircle className="w-3.5 h-3.5 text-[#004B87]" />
              <span>Guia & Regras</span>
            </button>
          </div>

        </div>
      </div>
      
      {/* Sub-bar with quick specs */}
      <div className="bg-[#002D54]/70 border-t border-white/10 px-4 sm:px-6 lg:px-8 py-1.5 text-xs text-blue-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-4 text-[11px] sm:text-xs">
          <span className="flex items-center gap-1.5">
            <Layers className="w-3 h-3 text-amber-400" /> Padrão Tramontina: <strong>8 dígitos (5+3)</strong>
          </span>
          <span className="hidden sm:inline">|</span>
          <span className="hidden sm:inline">Limite ERP: <strong>99 itens / arquivo CSV</strong></span>
        </div>
        <div className="text-[11px] text-blue-200/80">
          Processamento 100% seguro no navegador
        </div>
      </div>
    </header>
  );
};
