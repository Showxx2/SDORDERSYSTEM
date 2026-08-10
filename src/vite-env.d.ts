interface Window {
  electronAPI: {
    dbLoad: () => Promise<any>;
    dbSave: (data: any) => Promise<{ success: boolean; error?: string }>;
  };
}
