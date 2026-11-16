import type {
  AuditLog,
  Customer,
  DashboardSummary,
  InventoryAlert,
  PaymentMethod,
  Product,
  QueueServiceType,
  QueueStatus,
  QueueTicket,
  ReceiptType,
  RestockOrder,
  Sale,
  UserProfile,
  UserRole,
} from '../shared/types';

const TOKEN_KEY = 'novasalud_token';
const LOGOUT_FLAG = 'novasalud_logged_out';

export function getStoredToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string | null): void {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(LOGOUT_FLAG);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function markExplicitLogout(): void {
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.setItem(LOGOUT_FLAG, '1');
}

export function wasExplicitlyLoggedOut(): boolean {
  return localStorage.getItem(LOGOUT_FLAG) === '1';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Error HTTP ${res.status}`);
  }
  return data as T;
}

export const api = {
  async login(email: string, password: string): Promise<{ token: string; user: UserProfile }> {
    const res = await request<{ token: string; user: UserProfile }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setStoredToken(res.token);
    return res;
  },

  async demoInit(role: UserRole = 'admin'): Promise<{ token: string; user: UserProfile }> {
    const res = await request<{ token: string; user: UserProfile }>('/api/auth/demo-init', {
      method: 'POST',
      body: JSON.stringify({ role }),
    });
    setStoredToken(res.token);
    return res;
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      markExplicitLogout();
    }
  },

  async me(): Promise<{ user: UserProfile }> {
    return request<{ user: UserProfile }>('/api/auth/me');
  },

  getDashboard(): Promise<DashboardSummary> {
    return request<DashboardSummary>('/api/dashboard');
  },

  getProducts(): Promise<{ products: Product[] }> {
    return request<{ products: Product[] }>('/api/products');
  },

  createProduct(payload: Partial<Product>): Promise<{ product: Product }> {
    return request<{ product: Product }>('/api/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateProduct(id: string, payload: Partial<Product>): Promise<{ product: Product }> {
    return request<{ product: Product }>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  adjustStock(id: string, delta: number, reason: string): Promise<{ product: Product }> {
    return request<{ product: Product }>(`/api/products/${id}/adjust`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason }),
    });
  },

  getAlerts(): Promise<{ alerts: InventoryAlert[]; restockOrders: RestockOrder[] }> {
    return request<{ alerts: InventoryAlert[]; restockOrders: RestockOrder[] }>('/api/alerts');
  },

  createRestockOrder(
    supplier: string,
    items: { productId: string; requestedQty: number }[],
  ): Promise<{ order: RestockOrder }> {
    return request<{ order: RestockOrder }>('/api/restock-orders', {
      method: 'POST',
      body: JSON.stringify({ supplier, items }),
    });
  },

  receiveRestockOrder(
    id: string,
    batchNumber?: string,
    expiryDate?: string,
  ): Promise<{ order: RestockOrder }> {
    return request<{ order: RestockOrder }>(`/api/restock-orders/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify({ batchNumber, expiryDate }),
    });
  },

  getCustomers(): Promise<{ customers: Customer[] }> {
    return request<{ customers: Customer[] }>('/api/customers');
  },

  createCustomer(payload: Partial<Customer>): Promise<{ customer: Customer }> {
    return request<{ customer: Customer }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getQueue(): Promise<{ queue: QueueTicket[] }> {
    return request<{ queue: QueueTicket[] }>('/api/queue');
  },

  createQueueTicket(payload: {
    customerId?: string | null;
    customerName: string;
    documentNumber?: string;
    serviceType: QueueServiceType;
    priority: 'Normal' | 'Preferencial';
  }): Promise<{ ticket: QueueTicket }> {
    return request<{ ticket: QueueTicket }>('/api/queue', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateQueueStatus(id: string, status: QueueStatus): Promise<{ ticket: QueueTicket }> {
    return request<{ ticket: QueueTicket }>(`/api/queue/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getSales(): Promise<{ sales: Sale[] }> {
    return request<{ sales: Sale[] }>('/api/sales');
  },

  createSale(payload: {
    receiptType: ReceiptType;
    customerId?: string | null;
    customerName: string;
    customerDocument: string;
    items: { productId: string; quantity: number }[];
    discount: number;
    paymentMethod: PaymentMethod;
    amountTendered: number;
    prescriptionVerified: boolean;
    queueTicketId?: string | null;
  }): Promise<{ sale: Sale; alertCount: number }> {
    return request<{ sale: Sale; alertCount: number }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  voidSale(id: string, reason: string): Promise<{ sale: Sale }> {
    return request<{ sale: Sale }>(`/api/sales/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  getAuditLogs(): Promise<{ auditLogs: AuditLog[] }> {
    return request<{ auditLogs: AuditLog[] }>('/api/audit');
  },
};
