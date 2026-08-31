export type OrigemType = 'VP' | 'CD';

export type SkuExtractionMode = 'auto' | 'ref' | 'ean';

export interface OrderItem {
  id: string;
  sku: string;
  embalagem: number | string;
  quantidade: number | string;
  origem: OrigemType;
  desconto: number | string;
  source: string;
  loja: string;
  orderNumber?: string;
  cnpj?: string;
  detectedType: 'tramontina_ref' | 'ean13' | 'manual';
  isValidSku?: boolean;
  notes?: string;
}

export interface UploadedPdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  status: 'pending' | 'processing' | 'success' | 'error';
  errorMessage?: string;
  itemCount?: number;
  pageCount?: number;
}

export interface StoreGroup {
  loja: string;
  orderNumber?: string;
  cnpj?: string;
  items: OrderItem[];
  totalQty: number;
  totalItems: number;
}

export interface SampleModelOption {
  id: string;
  name: string;
  erp: string;
  itemCount: number;
  text: string;
  description: string;
  origemSuggestion?: OrigemType;
  multiStore?: boolean;
}
