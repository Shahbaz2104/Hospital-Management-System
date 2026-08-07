import axios, { AxiosError, type AxiosRequestConfig } from "axios";

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown
  ) {
    super(message);
  }
}

const client = axios.create({
  baseURL: "/api",
  headers: { "Content-Type": "application/json" },
});

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ success: boolean; error?: string; details?: unknown }>) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      try {
        await axios.post("/api/auth/refresh", null, { baseURL: "" });
        return client(original);
      } catch {
        // fall through to 401 handling
      }
    }

    if (error.response?.status === 401) {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?from=${encodeURIComponent(window.location.pathname)}`;
      }
    }

    return Promise.reject(
      new ApiClientError(
        error.response?.status ?? 500,
        error.response?.data?.error ?? "Something went wrong",
        error.response?.data?.details
      )
    );
  }
);

export async function api<T>(
  config: AxiosRequestConfig
): Promise<T> {
  const res = await client.request<{ success: boolean; data: T }>(config);
  return res.data.data;
}

export const apiGet = <T>(url: string, params?: Record<string, unknown>) =>
  api<T>({ method: "GET", url, params });

export const apiPost = <T>(url: string, data?: unknown) =>
  api<T>({ method: "POST", url, data });

export const apiPatch = <T>(url: string, data?: unknown) =>
  api<T>({ method: "PATCH", url, data });

export const apiDelete = <T>(url: string) =>
  api<T>({ method: "DELETE", url });