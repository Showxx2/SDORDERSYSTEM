interface Window {
  electronAPI: {
    dbLoad: () => Promise<any>;
    dbSave: (data: any) => Promise<{ success: boolean; error?: string }>;
    getPrinters?: () => Promise<any[]>;
    printReceipt?: (htmlContent: string, printerName?: string) => Promise<{ success: boolean; error?: string }>;
  };
}
