import { Platform } from 'react-native';
import { ApiError } from './errors';
import { buildUrl, getAuthToken } from './client';

/**
 * Fetch a file from the API and hand it to the user: a browser download on web,
 * the system share sheet on Android/iOS (saved to the app cache first).
 */
export async function downloadFile(path: string, fallbackName: string): Promise<void> {
  const url = buildUrl(path);
  const token = await getAuthToken();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers, credentials: 'include' });
    if (!response.ok) throw await toApiError(response);
    const name = fileNameFrom(response.headers.get('content-disposition')) ?? fallbackName;
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
    return;
  }

  const [{ File, Paths }, Sharing] = await Promise.all([
    import('expo-file-system'),
    import('expo-sharing'),
  ]);
  const destination = new File(Paths.cache, fallbackName);
  if (destination.exists) destination.delete();
  const file = await File.downloadFileAsync(url, destination, { headers });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: fallbackName,
    });
  }
}

function fileNameFrom(disposition: string | null): string | null {
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition ?? '');
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const payload = (await response.json()) as { code?: string; message?: string };
    if (payload.code && payload.message) {
      return new ApiError(payload.code as ApiError['code'], payload.message, response.status);
    }
  } catch {
    // not JSON
  }
  return new ApiError(
    response.status >= 500 ? 'INTERNAL_ERROR' : 'UNEXPECTED_RESPONSE',
    `Download failed with status ${response.status}`,
    response.status,
  );
}
