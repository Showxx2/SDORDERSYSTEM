const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbLoad: () => ipcRenderer.invoke('db-load'),
  dbSave: (data) => ipcRenderer.invoke('db-save', data),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (htmlContent, printerName, silentParam) => ipcRenderer.invoke('print-receipt', htmlContent, printerName, silentParam),
  parseInvoicePdf: (pdfData) => ipcRenderer.invoke('parse-invoice-pdf', pdfData)
});
