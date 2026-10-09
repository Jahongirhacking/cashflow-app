import { isApiErrorResponse } from '@finance/shared';
import { Platform } from 'react-native';
import { env } from '@/lib/env';
import { ApiError } from './errors';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
  timeoutMs?: number;
}

type TokenProvider = () => Promise<string | null>;
type UnauthorizedHandler = () => void;
type ErrorObserver = (error: ApiError) => void;

let tokenProvider: TokenProvider = () => Promise.resolve(null);
let unauthorizedHandler: UnauthorizedHandler = () => undefined;
const errorObservers = new Set<ErrorObserver>();

/** Observe every API error (e.g. to detect lost spreadsheet access). Returns an unsubscribe function. */
export function observeApiErrors(observer: ErrorObserver): () => void {
  errorObservers.add(observer);
  return () => errorObservers.delete(observer);
}

function notifyError(error: ApiError): ApiError {
  for (const observer of errorObservers) observer(error);
  return error;
}

/** Native clients attach a bearer token; web relies on the HTTP-only session cookie. */
export function configureApiClient(options: {
  getToken?: TokenProvider;
  onUnauthorized?: UnauthorizedHandler;
}) {
  if (options.getToken) tokenProvider = options.getToken;
  if (options.onUnauthorized) unauthorizedHandler = options.onUnauthorized;
}

/** Bearer token for native clients (null on web, where the session cookie is used). */
export function getAuthToken(): Promise<string | null> {
  return tokenProvider();
}

export function buildUrl(path: string, query?: QueryParams): string {
  const url = new URL(path.startsWith('/') ? path : `/${path}`, `${env.apiUrl}/`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

export async function apiRequest<TResponse>(
  path: string,
  options: RequestOptions = {},
): Promise<TResponse> {
  const { method = 'GET', body, query, signal, timeoutMs = 20_000 } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortFromCaller = () => controller.abort();
  signal?.addEventListener('abort', abortFromCaller);

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const token = await tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
    });
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted) {
      throw new ApiError('TIMEOUT', 'Request timed out');
    }
    throw new ApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed',
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  if (response.status === 204) return undefined as TResponse;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      if (response.ok)
        throw new ApiError('UNEXPECTED_RESPONSE', 'Malformed JSON response', response.status);
    }
  }

  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      if (payload.code === 'UNAUTHORIZED') unauthorizedHandler();
      throw notifyError(
        new ApiError(payload.code, payload.message, payload.statusCode, payload.details),
      );
    }
    if (response.status === 401) unauthorizedHandler();
    throw notifyError(
      new ApiError(
        response.status >= 500 ? 'INTERNAL_ERROR' : 'UNEXPECTED_RESPONSE',
        `Request failed with status ${response.status}`,
        response.status,
      ),
    );
  }

  return payload as TResponse;
}

/** Multipart upload (the browser/RN sets the boundary header). Same auth and error handling as apiRequest. */
export async function apiUpload<TResponse>(
  path: string,
  formData: FormData,
  timeoutMs = 60_000,
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = await tokenProvider();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(buildUrl(path), {
      method: 'POST',
      headers,
      body: formData,
      signal: controller.signal,
      credentials: Platform.OS === 'web' ? 'include' : 'omit',
    });
  } catch (error) {
    if (controller.signal.aborted) throw new ApiError('TIMEOUT', 'Upload timed out');
    throw new ApiError(
      'NETWORK_ERROR',
      error instanceof Error ? error.message : 'Network request failed',
    );
  } finally {
    clearTimeout(timeout);
  }
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    if (response.ok)
      throw new ApiError('UNEXPECTED_RESPONSE', 'Malformed JSON response', response.status);
  }
  if (!response.ok) {
    if (isApiErrorResponse(payload)) {
      if (payload.code === 'UNAUTHORIZED') unauthorizedHandler();
      throw notifyError(
        new ApiError(payload.code, payload.message, payload.statusCode, payload.details),
      );
    }
    throw notifyError(
      new ApiError(
        response.status >= 500 ? 'INTERNAL_ERROR' : 'UNEXPECTED_RESPONSE',
        `Upload failed with status ${response.status}`,
        response.status,
      ),
    );
  }
  return payload as TResponse;
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    apiRequest<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
  upload: apiUpload,
};
