const config = {
  //@ts-ignore
  API_RESOURCE_URL: import.meta.env.VITE_API_RESOURCE_URL ||
    'http://localhost:8000',
};

interface RequestOptions extends RequestInit {
  token?: string;
  params?: Record<string, string>;
  timeout?: number;
  validateStatus?: (status: number) => boolean;
}

interface HttpResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Headers;
}

interface BackendError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}

class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: BackendError | any,
    public headers: Headers
  ) {
    // Call super first with a temporary message
    super(`${status} ${statusText}`);
    
    // Set the name
    this.name = 'HttpError';
    
    // Now we can safely use this to set the proper message
    Object.defineProperty(this, 'message', {
      get: () => this.getErrorMessage()
    });
  }

  private getErrorMessage(): string {
    if (typeof this.data === 'object' && this.data !== null) {
      // Handle backend error format
      if (this.data.message) {
        return this.data.message;
      }
      // Handle array of errors
      if (Array.isArray(this.data.errors)) {
        return this.data.errors.map((err: any) => err.message).join(', ');
      }
      // Handle error object
      if (this.data.error) {
        return this.data.error;
      }
    }
    // Fallback to status text
    return `${this.status} ${this.statusText}`;
  }

  // Helper method to get formatted error details
  getErrorDetails(): BackendError {
    if (typeof this.data === 'object' && this.data !== null) {
      return {
        message: this.getErrorMessage(),
        code: this.data.code,
        details: this.data.details || this.data
      };
    }
    return {
      message: this.getErrorMessage(),
      details: this.data
    };
  }
}

class HttpClient {
  private baseUrl: string;
  private defaultTimeout: number = 30000; // 30 seconds
  private defaultValidateStatus: (status: number) => boolean = (status) => status >= 200 && status < 300;

  constructor(baseUrl: string = config.API_RESOURCE_URL) {
    this.baseUrl = baseUrl;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    // Ensure path starts with /admin/api
    const apiPath = path.startsWith('/admin/api') ? path : `/admin/api${path}`;
    const url = new URL(`${this.baseUrl}${apiPath}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }

  private buildHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<HttpResponse<T>> {
    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
    
    if (!this.defaultValidateStatus(response.status)) {
      throw new HttpError(
        response.status,
        response.statusText,
        data,
        response.headers
      );
    }

    return {
      data: data?.data ?? data,
      status: response.status,
      statusText: response.statusText,
      headers: response.headers
    };
  }

  private async fetchWithTimeout(
    url: string,
    options: RequestOptions & { timeout?: number }
  ): Promise<Response> {
    const { timeout = this.defaultTimeout, ...fetchOptions } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        credentials: 'include',
      });
      clearTimeout(id);
      return response;
    } catch (error) {
      clearTimeout(id);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new HttpError(
          408,
          'Request Timeout',
          { message: 'Request timed out' },
          new Headers()
        );
      }
      throw error;
    }
  }

  async get<T = any>(path: string, options: RequestOptions = {}): Promise<HttpResponse<T>> {
    const { token, params, timeout, validateStatus, ...rest } = options;
    try {
      const response = await this.fetchWithTimeout(
        this.buildUrl(path, params),
        {
          ...rest,
          headers: this.buildHeaders(token),
          timeout,
        }
      );
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        500,
        'Network Error',
        { message: error instanceof Error ? error.message : 'Unknown error' },
        new Headers()
      );
    }
  }

  async post<T = any>(
    path: string,
    data: unknown,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const { token, timeout, validateStatus, ...rest } = options;
    try {
      const response = await this.fetchWithTimeout(
        this.buildUrl(path),
        {
          ...rest,
          method: 'POST',
          headers: this.buildHeaders(token),
          body: JSON.stringify(data),
          timeout,
        }
      );
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        500,
        'Network Error',
        { message: error instanceof Error ? error.message : 'Unknown error' },
        new Headers()
      );
    }
  }

  async put<T = any>(
    path: string,
    data: unknown,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const { token, timeout, validateStatus, ...rest } = options;
    try {
      const response = await this.fetchWithTimeout(
        this.buildUrl(path),
        {
          ...rest,
          method: 'PUT',
          headers: this.buildHeaders(token),
          body: JSON.stringify(data),
          timeout,
        }
      );
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        500,
        'Network Error',
        { message: error instanceof Error ? error.message : 'Unknown error' },
        new Headers()
      );
    }
  }

  async delete<T = any>(
    path: string,
    options: RequestOptions = {},
  ): Promise<HttpResponse<T>> {
    const { token, timeout, validateStatus, ...rest } = options;
    try {
      const response = await this.fetchWithTimeout(
        this.buildUrl(path),
        {
          ...rest,
          method: 'DELETE',
          headers: this.buildHeaders(token),
          timeout,
        }
      );
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(
        500,
        'Network Error',
        { message: error instanceof Error ? error.message : 'Unknown error' },
        new Headers()
      );
    }
  }
}

// Export a singleton instance
export const httpHandler = new HttpClient();

// Also export the class for testing or custom instances
export default HttpClient;
