/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    getBackendUrl: () => Promise<string>;
    platform: string;
  };
}
