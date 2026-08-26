const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  dbLoad: () => ipcRenderer.invoke('db-load'),
  dbSave: (data) => ipcRenderer.invoke('db-save', data),
  getPrinters: () => ipcRenderer.invoke('get-printers'),
  printReceipt: (htmlContent, printerName) => ipcRenderer.invoke('print-receipt', htmlContent, printerName)
});
