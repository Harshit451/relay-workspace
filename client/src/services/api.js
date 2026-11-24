const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const request = async (path, options = {}) => {
  const { timeoutMs = 15000, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const token = localStorage.getItem("relay_token");
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(fetchOptions.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(fetchOptions.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || "Something went wrong.");
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error("The server took too long to respond. Please retry; free hosting may need up to 60 seconds to wake up.");
      timeoutError.code = "REQUEST_TIMEOUT";
      throw timeoutError;
    }
    if (error instanceof TypeError) {
      const networkError = new Error("Could not reach the server. Check your connection and retry.");
      networkError.code = "NETWORK_ERROR";
      throw networkError;
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
};
