export type UserRole = 'admin' | 'seller';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  cmpOrCode: string;
}

export type ProductCategory =
  | 'Analgésicos'
  | 'Antibióticos'
  | 'Respiratorio'
  | 'Vitaminas'
  | 'Digestivo'
  | 'Dermocosmética'
  | 'Primeros Auxilios';

export interface Product {
  id: string;
  sku: string;
  barcode: string;
  name: string;
  activeIngredient: string;
  laboratory: string;
  category: ProductCategory;
  presentation: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  stock: number;
  minStock: number;
  optimalStock: number;
  costPrice: number;
  salePrice: number;
  requiresPrescription: boolean;
  location: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  documentType: 'DNI' | 'RUC' | 'CE';
  documentNumber: string;
  fullName: string;
  phone: string;
  email: string;
  allergies: string;
  notes: string;
  visitsCount: number;
  totalSpent: number;
  lastVisit: string;
}

export type QueueServiceType = 'Atención Rápida' | 'Receta Médica' | 'Consulta Farmacéutica';
export type QueueStatus = 'En espera' | 'En atención' | 'Atendido';

export interface QueueTicket {
  id: string;
  ticketCode: string;
  customerId: string | null;
  customerName: string;
  documentNumber: string;
  serviceType: QueueServiceType;
  priority: 'Normal' | 'Preferencial';
  status: QueueStatus;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  assignedUserName: string | null;
}

export type ReceiptType = 'Boleta' | 'Factura';
export type PaymentMethod = 'Efectivo' | 'Tarjeta' | 'Yape / Plin';
export type SaleStatus = 'Completada' | 'Anulada';

export interface SaleItem {
  productId: string;
  sku: string;
  name: string;
  presentation: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  requiresPrescription: boolean;
}

export interface Sale {
  id: string;
  receiptNumber: string;
  receiptType: ReceiptType;
  customerId: string | null;
  customerName: string;
  customerDocument: string;
  sellerId: string;
  sellerName: string;
  items: SaleItem[];
  subtotal: number;
  igv: number;
  discount: number;
  total: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeDue: number;
  prescriptionVerified: boolean;
  queueTicketId: string | null;
  status: SaleStatus;
  voidReason?: string;
  createdAt: string;
}

export type RestockOrderStatus = 'Pendiente' | 'Recibida';

export interface RestockOrderItem {
  productId: string;
  sku: string;
  productName: string;
  requestedQty: number;
  unitCost: number;
  newBatch?: string;
  newExpiryDate?: string;
}

export interface RestockOrder {
  id: string;
  orderCode: string;
  supplier: string;
  status: RestockOrderStatus;
  items: RestockOrderItem[];
  totalEstimatedCost: number;
  createdBy: string;
  createdAt: string;
  receivedAt: string | null;
  receivedBy: string | null;
}

export type AuditActionType =
  | 'AUTH_LOGIN'
  | 'AUTH_LOGOUT'
  | 'SALE_CREATED'
  | 'SALE_VOIDED'
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'STOCK_ADJUSTED'
  | 'RESTOCK_ORDERED'
  | 'RESTOCK_RECEIVED'
  | 'CUSTOMER_CREATED'
  | 'QUEUE_UPDATED';

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: AuditActionType;
  detail: string;
}

export type AlertSeverity = 'Agotado' | 'Stock Bajo' | 'Por Vencer';

export interface InventoryAlert {
  productId: string;
  sku: string;
  name: string;
  activeIngredient: string;
  category: ProductCategory;
  location: string;
  stock: number;
  minStock: number;
  optimalStock: number;
  suggestedQty: number;
  costPrice: number;
  expiryDate: string;
  daysToExpiry: number;
  severity: AlertSeverity;
}

export interface DashboardSummary {
  todayRevenue: number;
  todaySalesCount: number;
  averageTicket: number;
  averageWaitMinutes: number;
  activeQueueCount: number;
  alertCounts: {
    outOfStock: number;
    lowStock: number;
    expiringSoon: number;
    total: number;
  };
  hourlySales: { hour: string; total: number; count: number }[];
  topProducts: { productId: string; name: string; unitsSold: number; revenue: number }[];
  recentSales: Sale[];
  priorityAlerts: InventoryAlert[];
}
