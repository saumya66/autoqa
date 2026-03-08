/**
 * API configuration - base URL for backend requests.
 * Uses VITE_API_BASE_URL from env, or Electron IPC when available (runtime config).
 */

let cachedBaseUrl: string | null = null;

export async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  if (typeof window !== 'undefined' && window.electronAPI?.getBackendUrl) {
    cachedBaseUrl = await window.electronAPI.getBackendUrl();
  } else {
    cachedBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  }
  return cachedBaseUrl;
}

/** Reset cached URL (e.g. after config change) */
export function clearBaseUrlCache(): void {
  cachedBaseUrl = null;
}
