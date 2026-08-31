import { useState } from 'react';
import { Header } from './components/Header';
import { DropzoneArea } from './components/DropzoneArea';
import { ConfigPanel } from './components/ConfigPanel';
import { ResultsTable } from './components/ResultsTable';
import { HelpModal } from './components/HelpModal';
import { OrderItem, UploadedPdfFile, OrigemType, SkuExtractionMode } from './types';
import { extractTextFromPdf, extractSkusFromText, dedupeItems, isValidTramontinaSku } from './utils/pdfParser';

export default function App() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedPdfFile[]>([]);
  const [pastedText, setPastedText] = useState<string>('');
  const [origem, setOrigem] = useState<OrigemType>('VP');
  const [skuMode, setSkuMode] = useState<SkuExtractionMode>('auto');
  const [excluirDuplicados, setExcluirDuplicados] = useState<boolean>(false);
  const [separarLoja, setSepararLoja] = useState<boolean>(false);
  const [formatWithSlash, setFormatWithSlash] = useState<boolean>(false);

  const [rows, setRows] = useState<OrderItem[]>([]);
  const [rawRows, setRawRows] = useState<OrderItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; type: 'ok' | 'warn' | 'info' } | null>(null);

  // Add files to queue
  const handleAddFiles = (fileList: FileList | File[]) => {
    const newFiles: UploadedPdfFile[] = [];
    Array.from(fileList).forEach(file => {
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        newFiles.push({
          id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
          file,
          name: file.name,
          size: file.size,
          status: 'pending',
        });
      }
    });

    if (newFiles.length === 0) {
      setStatusMsg({
        text: 'Por favor, selecione arquivos válidos no formato PDF.',
        type: 'warn',
      });
      return;
    }

    setUploadedFiles(prev => [...prev, ...newFiles]);
    setStatusMsg({
      text: `${newFiles.length} arquivo(s) PDF adicionado(s). Clique no botão "Extrair Referências Tramontina" para processar.`,
      type: 'info',
    });
  };

  const handleRemoveFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleClearFiles = () => {
    setUploadedFiles([]);
  };

  const handleClearAll = () => {
    setUploadedFiles([]);
    setPastedText('');
    setRows([]);
    setRawRows([]);
    setStatusMsg(null);
  };

  const handleOrigemChange = (newOrigem: OrigemType) => {
    setOrigem(newOrigem);
    setRows(prev => prev.map(r => ({ ...r, origem: newOrigem })));
    setRawRows(prev => prev.map(r => ({ ...r, origem: newOrigem })));
  };

  const handleExcluirDuplicadosChange = (val: boolean) => {
    setExcluirDuplicados(val);
    if (rawRows.length > 0) {
      const finalRows = val ? dedupeItems(rawRows) : rawRows;
      setRows(finalRows);
      setStatusMsg({
        text: val
          ? `Duplicados consolidados por CNPJ / Loja (${finalRows.length} itens no total).`
          : `Exibindo todos os itens do pedido (${finalRows.length} itens).`,
        type: 'info',
      });
    }
  };

  // Main processing pipeline triggered exclusively by "Extrair Referências Tramontina"
  const handleProcess = async () => {
    if (uploadedFiles.length === 0 && !pastedText.trim()) {
      setStatusMsg({
        text: 'Adicione pelo menos um arquivo PDF ou cole o texto do pedido no Passo 1 antes de extrair.',
        type: 'warn',
      });
      return;
    }

    setIsProcessing(true);
    setStatusMsg({
      text: 'Lendo arquivos PDF e extraindo referências Tramontina...',
      type: 'info',
    });

    let extracted: OrderItem[] = [];
    const updatedFileList = [...uploadedFiles];

    try {
      // 1. Process PDFs
      for (let i = 0; i < updatedFileList.length; i++) {
        const item = updatedFileList[i];
        item.status = 'processing';
        setUploadedFiles([...updatedFileList]);

        try {
          const { text, pageCount } = await extractTextFromPdf(item.file);
          const fileItems = extractSkusFromText(text, item.name, skuMode, origem, separarLoja);
          extracted = extracted.concat(fileItems);

          item.status = 'success';
          item.itemCount = fileItems.length;
          item.pageCount = pageCount;
        } catch {
          item.status = 'error';
          item.errorMessage = 'Não foi possível ler o texto do PDF.';
        }
      }

      setUploadedFiles([...updatedFileList]);

      // 2. Process Pasted Text (if any)
      if (pastedText.trim()) {
        const textItems = extractSkusFromText(pastedText.trim(), 'Texto Manual', skuMode, origem, separarLoja);
        extracted = extracted.concat(textItems);
      }

      if (extracted.length === 0) {
        setRows([]);
        setRawRows([]);
        setStatusMsg({
          text: 'Nenhuma referência Tramontina ou EAN foi identificada. Verifique se o PDF possui texto selecionável ou cole o texto na caixa de texto.',
          type: 'warn',
        });
      } else {
        setRawRows(extracted);
        const finalRows = excluirDuplicados ? dedupeItems(extracted) : extracted;
        setRows(finalRows);
        setStatusMsg({
          text: `${finalRows.length} item(ns) extraído(s) com sucesso! Confira os dados na tabela e baixe o arquivo .CSV para o ERP.`,
          type: 'ok',
        });
      }
    } catch {
      setStatusMsg({
        text: 'Ocorreu um erro ao processar os arquivos. Tente novamente.',
        type: 'warn',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Row operations
  const handleUpdateRow = (id: string, field: keyof OrderItem, value: any) => {
    setRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'sku') {
          updated.isValidSku = isValidTramontinaSku(value);
        }
        return updated;
      })
    );
    setRawRows(prev =>
      prev.map(r => {
        if (r.id !== id) return r;
        const updated = { ...r, [field]: value };
        if (field === 'sku') {
          updated.isValidSku = isValidTramontinaSku(value);
        }
        return updated;
      })
    );
  };

  const handleDeleteRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setRawRows(prev => prev.filter(r => r.id !== id));
  };

  const handleAddRow = () => {
    const newRow: OrderItem = {
      id: `manual-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      sku: '',
      embalagem: 1,
      quantidade: 1,
      origem: origem,
      desconto: 0,
      source: 'Adicionado Manualmente',
      loja: 'Loja Principal',
      detectedType: 'manual',
      isValidSku: false,
    };
    setRows(prev => [newRow, ...prev]);
  };

  const hasInput = uploadedFiles.length > 0 || pastedText.trim().length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
      {/* Tramontina Header */}
      <Header
        onOpenHelp={() => setIsHelpOpen(true)}
        hasItems={rows.length > 0}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        
        {/* Top Section: Steps 1 and 2 in a balanced layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Step 1: Upload & Input */}
          <div className="lg:col-span-6">
            <DropzoneArea
              files={uploadedFiles}
              onAddFiles={handleAddFiles}
              onRemoveFile={handleRemoveFile}
              onClearFiles={handleClearFiles}
              pastedText={pastedText}
              onPastedTextChange={setPastedText}
              isProcessing={isProcessing}
            />
          </div>

          {/* Step 2: Configuration & Trigger Button */}
          <div className="lg:col-span-6">
            <ConfigPanel
              origem={origem}
              onOrigemChange={handleOrigemChange}
              skuMode={skuMode}
              onSkuModeChange={setSkuMode}
              excluirDuplicados={excluirDuplicados}
              onExcluirDuplicadosChange={handleExcluirDuplicadosChange}
              separarLoja={separarLoja}
              onSepararLojaChange={setSepararLoja}
              formatWithSlash={formatWithSlash}
              onFormatWithSlashChange={setFormatWithSlash}
              onProcess={handleProcess}
              onClearAll={handleClearAll}
              isProcessing={isProcessing}
              hasInput={hasInput}
              statusMsg={statusMsg}
            />
          </div>

        </div>

        {/* Step 3: Results Table & Export */}
        <div>
          <ResultsTable
            rows={rows}
            origem={origem}
            separarLoja={separarLoja}
            excluirDuplicados={excluirDuplicados}
            formatWithSlash={formatWithSlash}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onAddRow={handleAddRow}
            onClearRows={() => setRows([])}
            onNotify={(text, type) => setStatusMsg({ text, type })}
          />
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#004B87]">Tramontina</span>
            <span>•</span>
            <span>Sistema de conversão de Pedidos para ERP</span>
          </div>
          <div className="text-slate-500 font-medium">
            Desenvolvido por: Rafael Luft
          </div>
        </div>
      </footer>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </div>
  );
}
