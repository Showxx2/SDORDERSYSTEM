interface Window {
  electronAPI: {
    dbLoad: () => Promise<any>;
    dbSave: (data: any) => Promise<{ success: boolean; error?: string }>;
    getPrinters?: () => Promise<any[]>;
    printReceipt?: (htmlContent: string, printerName?: string, silentParam?: boolean) => Promise<{ success: boolean; error?: string }>;
    parseInvoicePdf?: (filePath: string) => Promise<{ success: boolean; text?: string; error?: string }>;
  };
}
