export async function api<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? `Request failed (${response.status})`, response.status);
  }
  return response.json();
}
export const post = (value: unknown): RequestInit => ({
  method: 'POST',
  body: JSON.stringify(value),
});
export function download(content: string, name: string, type: string) {
  const href = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
export async function downloadPlan(blueprint: unknown, failureId: string) {
  const response = await fetch('/api/export-plan', {
    ...post({ blueprint, failureId }),
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) throw new Error('Could not create the recovery plan.');
  download(await response.text(), 'blackout-recovery-plan.html', 'text/html');
}
export function readStorage<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveStorage(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}
export function actionId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export const isRejected = (error: unknown) =>
  error instanceof ApiError && error.status >= 400 && error.status < 500;
