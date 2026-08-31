import React, { useRef, useState } from 'react';
import { UploadCloud, FileText, Trash2, ChevronDown, ChevronUp, AlertCircle, FileCheck2, ClipboardPaste } from 'lucide-react';
import { UploadedPdfFile } from '../types';

interface DropzoneAreaProps {
  files: UploadedPdfFile[];
  onAddFiles: (files: FileList | File[]) => void;
  onRemoveFile: (id: string) => void;
  onClearFiles: () => void;
  pastedText: string;
  onPastedTextChange: (text: string) => void;
  isProcessing: boolean;
}

export const DropzoneArea: React.FC<DropzoneAreaProps> = ({
  files,
  onAddFiles,
  onRemoveFile,
  onClearFiles,
  pastedText,
  onPastedTextChange,
  isProcessing,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [showPasteBox, setShowPasteBox] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onAddFiles(e.dataTransfer.files);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <section className="bg-white rounded-xl border border-slate-200/90 shadow-sm p-5 transition-all">
      {/* Step Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#004B87] text-white flex items-center justify-center font-bold text-xs shadow-sm">
            1
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Suba o PDF da ordem de compra
            </h2>
            <p className="text-xs text-slate-500">
              Arraste relatórios gerados por ERPs de clientes (Ferreira Costa, Miudezas Freitas, Casa Vieira, Centerbox, Consinco, Casa Freitas, Carajás, etc.)
            </p>
          </div>
        </div>

        {files.length > 0 && (
          <button
            onClick={onClearFiles}
            type="button"
            className="text-xs text-slate-500 hover:text-amber-700 font-medium flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-amber-50 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remover todos</span>
          </button>
        )}
      </div>

      {/* Drag & Drop Zone */}
      <div
        id="dropzone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 sm:p-8 text-center cursor-pointer transition-all duration-200 ${
          isDragging
            ? 'border-amber-400 bg-amber-50/50 scale-[0.99]'
            : 'border-slate-300 hover:border-amber-400 hover:bg-amber-50/20 bg-slate-50/40'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          id="fileInput"
          accept="application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              onAddFiles(e.target.files);
            }
          }}
        />

        <div className="flex flex-col items-center justify-center gap-2.5">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors shadow-xs ${
            isDragging ? 'bg-amber-400 text-slate-950' : 'bg-blue-100/80 text-[#004B87]'
          }`}>
            <UploadCloud className="w-7 h-7" />
          </div>
          
          <div>
            <p className="text-sm font-semibold text-slate-800">
              <span className="text-[#004B87] hover:underline font-bold">Clique para selecionar</span> ou arraste um ou múltiplos PDFs aqui
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Suporta ordens de compra em PDF com texto vetorial e múltiplas páginas de qualquer cliente Tramontina
            </p>
          </div>

          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
              .PDF
            </span>
            <span className="text-[11px] text-slate-400">Processa 80+ itens por documento sem perder linhas</span>
          </div>
        </div>
      </div>

      {/* Uploaded Files List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600 px-1">
            <span>Arquivos Selecionados ({files.length})</span>
            <span>Tamanho</span>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg text-xs transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded bg-blue-100 text-[#004B87] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 truncate max-w-xs sm:max-w-md">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-slate-500">
                      <span>{formatFileSize(file.size)}</span>
                      {file.status === 'success' && (
                        <span className="text-emerald-700 flex items-center gap-0.5 font-medium">
                          <FileCheck2 className="w-3 h-3" /> Processado ({file.itemCount ?? 0} itens)
                        </span>
                      )}
                      {file.status === 'error' && (
                        <span className="text-amber-800 flex items-center gap-0.5 font-medium">
                          <AlertCircle className="w-3 h-3 text-amber-600" /> Falha na leitura
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(file.id);
                  }}
                  disabled={isProcessing}
                  className="p-1 text-slate-400 hover:text-amber-700 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                  title="Remover arquivo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fallback Textarea Dropdown */}
      <div className="mt-4 pt-3 border-t border-slate-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowPasteBox(!showPasteBox)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#004B87] hover:text-[#003B6D] transition-colors cursor-pointer py-1"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>{showPasteBox ? 'Ocultar caixa de texto manual' : 'O PDF é uma imagem ou cópia de texto? Cole o conteúdo aqui'}</span>
            {showPasteBox ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showPasteBox && (
          <div className="mt-2.5 space-y-1.5">
            <textarea
              id="pasteArea"
              value={pastedText}
              onChange={(e) => onPastedTextChange(e.target.value)}
              placeholder="Cole aqui o texto da ordem de compra ou cotação..."
              className="w-full h-28 p-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none transition-all resize-y text-slate-800 placeholder:text-slate-400"
            />
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Será processado em conjunto com os arquivos PDF carregados ao clicar em Extrair Referências.</span>
              <span>{pastedText.length} caracteres</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
