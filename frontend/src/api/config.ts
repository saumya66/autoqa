/**
 * API configuration.
 * - getBaseUrl: Local backend (windows, execute, feature context, etc.)
 * - getCloudBaseUrl: Cloud backend (auth, projects)
 */

let cachedBaseUrl: string | null = null;
let cachedCloudBaseUrl: string | null = null;

export async function getBaseUrl(): Promise<string> {
  if (cachedBaseUrl) return cachedBaseUrl;
  if (typeof window !== 'undefined' && window.electronAPI?.getBackendUrl) {
    cachedBaseUrl = await window.electronAPI.getBackendUrl();
  } else {
    cachedBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
  }
  return cachedBaseUrl;
}

export function getCloudBaseUrl(): string {
  if (cachedCloudBaseUrl) return cachedCloudBaseUrl;
  cachedCloudBaseUrl =
    import.meta.env.VITE_CLOUD_API_URL || 'http://localhost:8001';
  return cachedCloudBaseUrl;
}

/** Reset cached URLs (e.g. after config change) */
export function clearBaseUrlCache(): void {
  cachedBaseUrl = null;
  cachedCloudBaseUrl = null;
}
