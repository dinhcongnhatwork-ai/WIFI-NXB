const BASE_URL = '';

interface FetchOptions extends RequestInit {
  token?: string;
}

function clearClientSession() {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.removeItem('token');
  localStorage.removeItem('username');
  window.dispatchEvent(new Event('auth:unauthorized'));
}

async function fetchApi<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...init } = options;

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE_URL}${url}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearClientSession();
      throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data;
}

export const api = {
  get: <T>(url: string, token?: string) =>
    fetchApi<T>(url, { method: 'GET', token }),

  post: <T>(url: string, body?: unknown, token?: string) =>
    fetchApi<T>(url, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body),
      token,
    }),

  put: <T>(url: string, body?: unknown, token?: string) =>
    fetchApi<T>(url, {
      method: 'PUT',
      body: JSON.stringify(body),
      token,
    }),

  delete: <T>(url: string, token?: string) =>
    fetchApi<T>(url, { method: 'DELETE', token }),

  upload: <T>(url: string, formData: FormData, token?: string) =>
    fetchApi<T>(url, {
      method: 'POST',
      body: formData,
      token,
    }),
};
