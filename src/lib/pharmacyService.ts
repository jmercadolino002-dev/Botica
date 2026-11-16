import { type User } from 'firebase/auth';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  AuditActionType,
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
  SaleItem,
  UserProfile,
} from '../shared/types';
import { OperationType, db, handleFirestoreError } from './firebase';
import {
  INITIAL_CUSTOMERS,
  INITIAL_PRODUCTS,
  INITIAL_QUEUE,
  INITIAL_RESTOCK_ORDERS,
  INITIAL_SALES,
} from './seedData';

const BOOTSTRAP_ADMIN_EMAIL = 'jmercadolino002@gmail.com';

function tsToIso(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string') return value;
  return new Date().toISOString();
}

function cleanId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function resolvePharmacyId(user: User): string {
  if (user.email === BOOTSTRAP_ADMIN_EMAIL && user.emailVerified) {
    return 'nova-salud-central';
  }
  return `farmacia-${user.uid.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48)}`;
}

export async function ensureUserAndWorkspace(firebaseUser: User): Promise<{
  profile: UserProfile;
  pharmacyId: string;
}> {
  const isBootstrapAdmin =
    firebaseUser.email === BOOTSTRAP_ADMIN_EMAIL && firebaseUser.emailVerified;
  const pharmacyId = resolvePharmacyId(firebaseUser);
  const role = isBootstrapAdmin ? 'admin' : 'admin';
  const userPublicRef = doc(db, 'users', firebaseUser.uid, 'public', 'profile');
  const userPrivateRef = doc(db, 'users', firebaseUser.uid, 'private', 'contact');
  const pharmacyRef = doc(db, 'pharmacies', pharmacyId);

  try {
    const publicSnap = await getDoc(userPublicRef);
    const displayName = (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Operador').slice(0, 100);

    if (!publicSnap.exists()) {
      await setDoc(userPublicRef, {
        uid: firebaseUser.uid,
        displayName,
        roleTitle: isBootstrapAdmin ? 'Química Farmacéutica' : 'Administrador de Botica',
        role: isBootstrapAdmin ? 'admin' : 'seller',
        cmpOrCode: isBootstrapAdmin ? 'CQFP-24819' : `OP-${firebaseUser.uid.slice(0, 6).toUpperCase()}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await setDoc(userPrivateRef, {
        uid: firebaseUser.uid,
        email: (firebaseUser.email || 'operador@novasalud.pe').slice(0, 160),
        pharmacyId,
        updatedAt: serverTimestamp(),
      });
    }

    const pharmSnap = await getDoc(pharmacyRef);
    if (!pharmSnap.exists()) {
      await setDoc(pharmacyRef, {
        id: pharmacyId,
        name: 'Botica Nova Salud',
        ruc: '20609418275',
        address: 'Av. Comercial Central 482 · Zona Comercial',
        ownerId: firebaseUser.uid,
        receiptCounter: 104,
        facturaCounter: 18,
        queueCounter: 43,
        restockCounter: 41,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const batch = writeBatch(db);
      for (const p of INITIAL_PRODUCTS) {
        batch.set(doc(db, 'pharmacies', pharmacyId, 'products', p.id), {
          ...p,
          pharmacyId,
          ownerId: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const c of INITIAL_CUSTOMERS) {
        batch.set(doc(db, 'pharmacies', pharmacyId, 'customers', c.id), {
          ...c,
          pharmacyId,
          ownerId: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const q of INITIAL_QUEUE) {
        batch.set(doc(db, 'pharmacies', pharmacyId, 'queue', q.id), {
          ...q,
          pharmacyId,
          ownerId: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const s of INITIAL_SALES) {
        batch.set(doc(db, 'pharmacies', pharmacyId, 'sales', s.id), {
          ...s,
          pharmacyId,
          ownerId: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      for (const r of INITIAL_RESTOCK_ORDERS) {
        batch.set(doc(db, 'pharmacies', pharmacyId, 'restockOrders', r.id), {
          ...r,
          pharmacyId,
          ownerId: firebaseUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
      batch.set(doc(db, 'pharmacies', pharmacyId, 'auditLogs', 'aud-init-1'), {
        id: 'aud-init-1',
        pharmacyId,
        ownerId: firebaseUser.uid,
        timestamp: new Date().toISOString(),
        userId: firebaseUser.uid,
        userName: displayName,
        userRole: role,
        action: 'AUTH_LOGIN',
        detail: 'Espacio de trabajo inicializado en Cloud Firestore con reglas de seguridad activas.',
        createdAt: serverTimestamp(),
      });
      await batch.commit();
    } else {
      // Ensure existing user can read products if empty
      const productsCheck = await getDocs(
        query(
          collection(db, 'pharmacies', pharmacyId, 'products'),
          where('ownerId', '==', pharmSnap.data().ownerId),
        ),
      );
      if (productsCheck.empty) {
        const batch = writeBatch(db);
        for (const p of INITIAL_PRODUCTS) {
          batch.set(doc(db, 'pharmacies', pharmacyId, 'products', p.id), {
            ...p,
            pharmacyId,
            ownerId: firebaseUser.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }
    }

    const freshPublic = await getDoc(userPublicRef);
    const pData = freshPublic.data();
    const profile: UserProfile = {
      id: firebaseUser.uid,
      name: (pData?.displayName as string) || displayName,
      email: firebaseUser.email || '',
      role: 'admin',
      title: isBootstrapAdmin ? 'Química Farmacéutica' : 'Administrador de Botica',
      cmpOrCode: (pData?.cmpOrCode as string) || 'CQFP-24819',
    };

    return { profile, pharmacyId };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `pharmacies/${pharmacyId}`);
  }
}

export function subscribeWorkspace(
  pharmacyId: string,
  ownerUid: string,
  isBootstrapAdmin: boolean,
  callbacks: {
    onProducts: (products: Product[]) => void;
    onCustomers: (customers: Customer[]) => void;
    onQueue: (queue: QueueTicket[]) => void;
    onSales: (sales: Sale[]) => void;
    onRestockOrders: (orders: RestockOrder[]) => void;
    onAuditLogs: (logs: AuditLog[]) => void;
  },
): () => void {
  const unsubs: (() => void)[] = [];

  const buildQuery = (colName: string, sortField = 'createdAt', dir: 'asc' | 'desc' = 'desc') => {
    const colRef = collection(db, 'pharmacies', pharmacyId, colName);
    if (isBootstrapAdmin) {
      return query(colRef, orderBy(sortField, dir));
    }
    return query(colRef, where('ownerId', '==', ownerUid));
  };

  unsubs.push(
    onSnapshot(
      buildQuery('products', 'sku', 'asc'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              sku: String(data.sku),
              barcode: String(data.barcode),
              name: String(data.name),
              activeIngredient: String(data.activeIngredient),
              laboratory: String(data.laboratory),
              category: data.category,
              presentation: String(data.presentation),
              batchNumber: String(data.batchNumber),
              expiryDate: String(data.expiryDate),
              stock: Number(data.stock),
              minStock: Number(data.minStock),
              optimalStock: Number(data.optimalStock),
              costPrice: Number(data.costPrice),
              salePrice: Number(data.salePrice),
              requiresPrescription: Boolean(data.requiresPrescription),
              location: String(data.location),
              updatedAt: tsToIso(data.updatedAt),
            } as Product;
          })
          .sort((a, b) => a.sku.localeCompare(b.sku));
        callbacks.onProducts(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `pharmacies/${pharmacyId}/products`),
    ),
  );

  unsubs.push(
    onSnapshot(
      buildQuery('customers', 'createdAt', 'desc'),
      (snap) => {
        const list = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            documentType: data.documentType,
            documentNumber: String(data.documentNumber),
            fullName: String(data.fullName),
            phone: String(data.phone || ''),
            email: String(data.email || ''),
            allergies: String(data.allergies || 'Ninguna conocida'),
            notes: String(data.notes || ''),
            visitsCount: Number(data.visitsCount || 0),
            totalSpent: Number(data.totalSpent || 0),
            lastVisit: String(data.lastVisit || tsToIso(data.updatedAt)),
          } as Customer;
        });
        callbacks.onCustomers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `pharmacies/${pharmacyId}/customers`),
    ),
  );

  unsubs.push(
    onSnapshot(
      buildQuery('queue', 'createdAt', 'asc'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ticketCode: String(data.ticketCode),
              customerId: (data.customerId as string | null) ?? null,
              customerName: String(data.customerName),
              documentNumber: String(data.documentNumber || ''),
              serviceType: data.serviceType,
              priority: data.priority,
              status: data.status,
              createdAt: tsToIso(data.createdAt),
              startedAt: (data.startedAt as string | null) ?? null,
              completedAt: (data.completedAt as string | null) ?? null,
              assignedUserName: (data.assignedUserName as string | null) ?? null,
            } as QueueTicket;
          })
          .sort((a, b) => a.ticketCode.localeCompare(b.ticketCode));
        callbacks.onQueue(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `pharmacies/${pharmacyId}/queue`),
    ),
  );

  unsubs.push(
    onSnapshot(
      buildQuery('sales', 'createdAt', 'desc'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              receiptNumber: String(data.receiptNumber),
              receiptType: data.receiptType,
              customerId: (data.customerId as string | null) ?? null,
              customerName: String(data.customerName),
              customerDocument: String(data.customerDocument),
              sellerId: String(data.sellerId),
              sellerName: String(data.sellerName),
              items: (data.items as SaleItem[]) || [],
              subtotal: Number(data.subtotal),
              igv: Number(data.igv),
              discount: Number(data.discount),
              total: Number(data.total),
              paymentMethod: data.paymentMethod,
              amountTendered: Number(data.amountTendered),
              changeDue: Number(data.changeDue),
              prescriptionVerified: Boolean(data.prescriptionVerified),
              queueTicketId: (data.queueTicketId as string | null) ?? null,
              status: data.status,
              voidReason: data.voidReason ? String(data.voidReason) : undefined,
              createdAt: tsToIso(data.createdAt),
            } as Sale;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onSales(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, `pharmacies/${pharmacyId}/sales`),
    ),
  );

  unsubs.push(
    onSnapshot(
      buildQuery('restockOrders', 'createdAt', 'desc'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              orderCode: String(data.orderCode),
              supplier: String(data.supplier),
              status: data.status,
              items: data.items || [],
              totalEstimatedCost: Number(data.totalEstimatedCost),
              createdBy: String(data.createdBy),
              createdAt: tsToIso(data.createdAt),
              receivedAt: (data.receivedAt as string | null) ?? null,
              receivedBy: (data.receivedBy as string | null) ?? null,
            } as RestockOrder;
          })
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        callbacks.onRestockOrders(list);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `pharmacies/${pharmacyId}/restockOrders`),
    ),
  );

  unsubs.push(
    onSnapshot(
      buildQuery('auditLogs', 'createdAt', 'desc'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              timestamp: String(data.timestamp || tsToIso(data.createdAt)),
              userId: String(data.userId),
              userName: String(data.userName),
              userRole: data.userRole,
              action: data.action as AuditActionType,
              detail: String(data.detail),
            } as AuditLog;
          })
          .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        callbacks.onAuditLogs(list);
      },
      (error) =>
        handleFirestoreError(error, OperationType.LIST, `pharmacies/${pharmacyId}/auditLogs`),
    ),
  );

  return () => {
    for (const unsub of unsubs) unsub();
  };
}

export function computeAlertsFromProducts(products: Product[]): InventoryAlert[] {
  const today = new Date();
  const alerts: InventoryAlert[] = [];

  for (const p of products) {
    const expiry = new Date(`${p.expiryDate}T00:00:00`);
    const daysToExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (p.stock <= 0) {
      alerts.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        activeIngredient: p.activeIngredient,
        category: p.category,
        location: p.location,
        stock: p.stock,
        minStock: p.minStock,
        optimalStock: p.optimalStock,
        suggestedQty: Math.max(p.optimalStock - p.stock, 10),
        costPrice: p.costPrice,
        expiryDate: p.expiryDate,
        daysToExpiry,
        severity: 'Agotado',
      });
    } else if (p.stock <= p.minStock) {
      alerts.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        activeIngredient: p.activeIngredient,
        category: p.category,
        location: p.location,
        stock: p.stock,
        minStock: p.minStock,
        optimalStock: p.optimalStock,
        suggestedQty: Math.max(p.optimalStock - p.stock, 5),
        costPrice: p.costPrice,
        expiryDate: p.expiryDate,
        daysToExpiry,
        severity: 'Stock Bajo',
      });
    } else if (daysToExpiry <= 60) {
      alerts.push({
        productId: p.id,
        sku: p.sku,
        name: p.name,
        activeIngredient: p.activeIngredient,
        category: p.category,
        location: p.location,
        stock: p.stock,
        minStock: p.minStock,
        optimalStock: p.optimalStock,
        suggestedQty: 0,
        costPrice: p.costPrice,
        expiryDate: p.expiryDate,
        daysToExpiry,
        severity: 'Por Vencer',
      });
    }
  }

  const order: Record<string, number> = { Agotado: 0, 'Stock Bajo': 1, 'Por Vencer': 2 };
  alerts.sort((a, b) => order[a.severity] - order[b.severity] || a.stock - b.stock);
  return alerts;
}

export function computeDashboardSummary(
  products: Product[],
  sales: Sale[],
  queue: QueueTicket[],
): DashboardSummary {
  const alerts = computeAlertsFromProducts(products);
  const completedSales = sales.filter((s) => s.status === 'Completada');
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todaySales = completedSales.filter((s) => s.createdAt.startsWith(todayPrefix));
  const effectiveSales = todaySales.length > 0 ? todaySales : completedSales;

  const todayRevenue = effectiveSales.reduce((sum, s) => sum + s.total, 0);
  const todaySalesCount = effectiveSales.length;
  const averageTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

  let totalWaitMin = 0;
  let waitSamples = 0;
  for (const q of queue) {
    const start = new Date(q.createdAt).getTime();
    const end = q.startedAt ? new Date(q.startedAt).getTime() : Date.now();
    const mins = Math.max(1, Math.round((end - start) / 60_000));
    totalWaitMin += Math.min(mins, 25);
    waitSamples++;
  }
  const averageWaitMinutes = waitSamples > 0 ? Math.round((totalWaitMin / waitSamples) * 10) / 10 : 3.2;

  const buckets: Record<string, { total: number; count: number }> = {};
  for (let h = 8; h <= 20; h += 2) {
    const label = `${String(h).padStart(2, '0')}:00`;
    buckets[label] = { total: 0, count: 0 };
  }
  for (const s of effectiveSales) {
    const hour = new Date(s.createdAt).getHours();
    const clamped = Math.max(8, Math.min(20, Math.floor(hour / 2) * 2));
    const label = `${String(clamped).padStart(2, '0')}:00`;
    if (buckets[label]) {
      buckets[label].total += s.total;
      buckets[label].count += 1;
    }
  }
  const hourlySales = Object.entries(buckets).map(([hour, data]) => ({
    hour,
    total: Math.round(data.total * 100) / 100,
    count: data.count,
  }));

  const productStats = new Map<string, { productId: string; name: string; unitsSold: number; revenue: number }>();
  for (const sale of completedSales) {
    for (const item of sale.items) {
      const existing = productStats.get(item.productId) || {
        productId: item.productId,
        name: item.name,
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += item.quantity;
      existing.revenue += item.subtotal;
      productStats.set(item.productId, existing);
    }
  }
  const topProducts = Array.from(productStats.values())
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    todayRevenue: Math.round(todayRevenue * 100) / 100,
    todaySalesCount,
    averageTicket: Math.round(averageTicket * 100) / 100,
    averageWaitMinutes,
    activeQueueCount: queue.filter((q) => q.status === 'En espera' || q.status === 'En atención').length,
    alertCounts: {
      outOfStock: alerts.filter((a) => a.severity === 'Agotado').length,
      lowStock: alerts.filter((a) => a.severity === 'Stock Bajo').length,
      expiringSoon: alerts.filter((a) => a.severity === 'Por Vencer').length,
      total: alerts.length,
    },
    hourlySales,
    topProducts,
    recentSales: sales.slice(0, 6),
    priorityAlerts: alerts.slice(0, 6),
  };
}

function appendAuditToBatch(
  batch: ReturnType<typeof writeBatch>,
  pharmacyId: string,
  ownerId: string,
  user: UserProfile,
  action: AuditActionType,
  detail: string,
) {
  const logId = cleanId('aud');
  batch.set(doc(db, 'pharmacies', pharmacyId, 'auditLogs', logId), {
    id: logId,
    pharmacyId,
    ownerId,
    timestamp: new Date().toISOString(),
    userId: user.id,
    userName: user.name.slice(0, 120),
    userRole: user.role,
    action,
    detail: detail.slice(0, 400),
    createdAt: serverTimestamp(),
  });
}

export const pharmacyService = {
  async createProduct(pharmacyId: string, user: UserProfile, payload: Partial<Product>): Promise<void> {
    const id = cleanId('prod');
    const path = `pharmacies/${pharmacyId}/products/${id}`;
    try {
      const batch = writeBatch(db);
      const sku = (payload.sku || `MED-${Date.now().toString().slice(-4)}`).trim().toUpperCase().slice(0, 40);
      const name = (payload.name || '').trim().slice(0, 140);
      const stock = Math.max(0, Number(payload.stock ?? 0));
      batch.set(doc(db, path), {
        id,
        pharmacyId,
        ownerId: user.id,
        sku,
        barcode: (payload.barcode || `7750182${Math.floor(100000 + Math.random() * 899999)}`).trim().slice(0, 40),
        name,
        activeIngredient: (payload.activeIngredient || '').trim().slice(0, 140),
        laboratory: (payload.laboratory || 'Genfar').trim().slice(0, 80),
        category: payload.category || 'Analgésicos',
        presentation: (payload.presentation || 'Caja x 10 unidades').trim().slice(0, 100),
        batchNumber: (payload.batchNumber || 'LOT-26N01').trim().slice(0, 50),
        expiryDate: (payload.expiryDate || new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10)).slice(0, 10),
        stock,
        minStock: Math.max(1, Number(payload.minStock ?? 10)),
        optimalStock: Math.max(5, Number(payload.optimalStock ?? 30)),
        costPrice: Math.max(0.1, Number(payload.costPrice ?? 5)),
        salePrice: Math.max(0.1, Number(payload.salePrice ?? 10)),
        requiresPrescription: Boolean(payload.requiresPrescription),
        location: (payload.location || 'Estante A-01').trim().slice(0, 50),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      appendAuditToBatch(batch, pharmacyId, user.id, user, 'PRODUCT_CREATED', `Producto ${sku} (${name}) registrado con stock ${stock}.`);
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async updateProduct(pharmacyId: string, user: UserProfile, id: string, payload: Partial<Product>): Promise<void> {
    const path = `pharmacies/${pharmacyId}/products/${id}`;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, path), {
        name: (payload.name || '').trim().slice(0, 140),
        activeIngredient: (payload.activeIngredient || '').trim().slice(0, 140),
        laboratory: (payload.laboratory || 'Genfar').trim().slice(0, 80),
        category: payload.category || 'Analgésicos',
        presentation: (payload.presentation || '').trim().slice(0, 100),
        batchNumber: (payload.batchNumber || '').trim().slice(0, 50),
        expiryDate: (payload.expiryDate || '').slice(0, 10),
        stock: Math.max(0, Number(payload.stock ?? 0)),
        minStock: Math.max(1, Number(payload.minStock ?? 10)),
        optimalStock: Math.max(5, Number(payload.optimalStock ?? 30)),
        costPrice: Math.max(0.1, Number(payload.costPrice ?? 5)),
        salePrice: Math.max(0.1, Number(payload.salePrice ?? 10)),
        requiresPrescription: Boolean(payload.requiresPrescription),
        location: (payload.location || '').trim().slice(0, 50),
        updatedAt: serverTimestamp(),
      });
      appendAuditToBatch(batch, pharmacyId, user.id, user, 'PRODUCT_UPDATED', `Ficha actualizada de ${payload.sku || id} (${payload.name || ''}).`);
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async adjustStock(pharmacyId: string, user: UserProfile, productId: string, delta: number, reason: string): Promise<void> {
    const path = `pharmacies/${pharmacyId}/products/${productId}`;
    try {
      await runTransaction(db, async (tx) => {
        const prodRef = doc(db, path);
        const snap = await tx.get(prodRef);
        if (!snap.exists()) throw new Error('Producto no encontrado.');
        const data = snap.data();
        const nextStock = Number(data.stock) + delta;
        if (nextStock < 0) throw new Error('El stock resultante no puede ser negativo.');

        tx.update(prodRef, { stock: nextStock, updatedAt: serverTimestamp() });
        const logId = cleanId('aud');
        tx.set(doc(db, 'pharmacies', pharmacyId, 'auditLogs', logId), {
          id: logId,
          pharmacyId,
          ownerId: String(data.ownerId),
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name.slice(0, 120),
          userRole: user.role,
          action: 'STOCK_ADJUSTED',
          detail: `Ajuste ${delta > 0 ? `+${delta}` : delta} u. en ${data.sku} (${data.name}) → Stock actual: ${nextStock}. Motivo: ${reason.trim()}`.slice(0, 400),
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('stock')) throw error;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async createCustomer(pharmacyId: string, user: UserProfile, payload: Partial<Customer>): Promise<Customer> {
    const id = cleanId('cust');
    const path = `pharmacies/${pharmacyId}/customers/${id}`;
    const docNum = (payload.documentNumber || '00000000').trim().slice(0, 20);
    if (docNum.length < 5) {
      throw new Error('El número de documento debe tener al menos 5 dígitos.');
    }
    const customer: Customer = {
      id,
      documentType: payload.documentType || 'DNI',
      documentNumber: docNum,
      fullName: (payload.fullName || '').trim().slice(0, 140),
      phone: (payload.phone || '').trim().slice(0, 30),
      email: (payload.email || '').trim().slice(0, 140),
      allergies: (payload.allergies || 'Ninguna conocida').trim().slice(0, 200),
      notes: (payload.notes || '').trim().slice(0, 300),
      visitsCount: 0,
      totalSpent: 0,
      lastVisit: new Date().toISOString(),
    };
    try {
      const batch = writeBatch(db);
      batch.set(doc(db, path), {
        ...customer,
        pharmacyId,
        ownerId: user.id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      appendAuditToBatch(batch, pharmacyId, user.id, user, 'CUSTOMER_CREATED', `Cliente registrado: ${customer.fullName} (${customer.documentType} ${customer.documentNumber}).`);
      await batch.commit();
      return customer;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async createQueueTicket(
    pharmacyId: string,
    user: UserProfile,
    payload: {
      customerId?: string | null;
      customerName: string;
      documentNumber?: string;
      serviceType: QueueServiceType;
      priority: 'Normal' | 'Preferencial';
    },
  ): Promise<void> {
    const id = cleanId('q');
    const pharmPath = `pharmacies/${pharmacyId}`;
    try {
      await runTransaction(db, async (tx) => {
        const pharmRef = doc(db, pharmPath);
        const pharmSnap = await tx.get(pharmRef);
        const nextNum = Number(pharmSnap.data()?.queueCounter || 43) + 1;
        const ownerId = String(pharmSnap.data()?.ownerId || user.id);
        const ticketCode = `T-${String(nextNum).padStart(3, '0')}`;

        tx.update(pharmRef, { queueCounter: nextNum, updatedAt: serverTimestamp() });
        tx.set(doc(db, pharmPath, 'queue', id), {
          id,
          pharmacyId,
          ownerId,
          ticketCode,
          customerId: payload.customerId ?? null,
          customerName: payload.customerName.trim().slice(0, 140),
          documentNumber: (payload.documentNumber || 'Sin documento').trim().slice(0, 30),
          serviceType: payload.serviceType,
          priority: payload.priority,
          status: 'En espera',
          startedAt: null,
          completedAt: null,
          assignedUserName: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const logId = cleanId('aud');
        tx.set(doc(db, pharmPath, 'auditLogs', logId), {
          id: logId,
          pharmacyId,
          ownerId,
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name.slice(0, 120),
          userRole: user.role,
          action: 'QUEUE_UPDATED',
          detail: `Turno ${ticketCode} generado para ${payload.customerName} (${payload.serviceType}).`.slice(0, 400),
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${pharmPath}/queue/${id}`);
    }
  },

  async updateQueueStatus(
    pharmacyId: string,
    user: UserProfile,
    ticketId: string,
    status: QueueStatus,
  ): Promise<void> {
    const path = `pharmacies/${pharmacyId}/queue/${ticketId}`;
    try {
      const payload: Record<string, unknown> = {
        status,
        updatedAt: serverTimestamp(),
      };
      if (status === 'En atención') {
        payload.startedAt = new Date().toISOString();
        payload.assignedUserName = user.name.slice(0, 120);
      } else if (status === 'Atendido') {
        payload.completedAt = new Date().toISOString();
        payload.assignedUserName = user.name.slice(0, 120);
      }
      await updateDoc(doc(db, path), payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async createSale(
    pharmacyId: string,
    user: UserProfile,
    payload: {
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
    },
  ): Promise<Sale> {
    const saleId = cleanId('sale');
    const pharmPath = `pharmacies/${pharmacyId}`;
    try {
      return await runTransaction(db, async (tx) => {
        const pharmRef = doc(db, pharmPath);
        const pharmSnap = await tx.get(pharmRef);
        const pharmData = pharmSnap.data();
        const ownerId = String(pharmData?.ownerId || user.id);

        const productSnaps = await Promise.all(
          payload.items.map((line) => tx.get(doc(db, pharmPath, 'products', line.productId))),
        );

        const customerSnap = payload.customerId
          ? await tx.get(doc(db, pharmPath, 'customers', payload.customerId))
          : null;

        const saleItems: SaleItem[] = [];
        let grossTotal = 0;
        let needsRx = false;

        for (let i = 0; i < payload.items.length; i++) {
          const snap = productSnaps[i];
          const qty = Math.round(payload.items[i].quantity);
          if (!snap.exists()) throw new Error('Uno de los productos ya no existe.');
          const p = snap.data();
          if (Number(p.stock) < qty) {
            throw new Error(`Stock insuficiente para ${p.name}. Disponible: ${p.stock} u.`);
          }
          if (p.requiresPrescription) needsRx = true;
          const lineSubtotal = Math.round(Number(p.salePrice) * qty * 100) / 100;
          grossTotal += lineSubtotal;
          saleItems.push({
            productId: snap.id,
            sku: String(p.sku),
            name: String(p.name),
            presentation: String(p.presentation),
            quantity: qty,
            unitPrice: Number(p.salePrice),
            subtotal: lineSubtotal,
            requiresPrescription: Boolean(p.requiresPrescription),
          });
        }

        if (needsRx && !payload.prescriptionVerified) {
          throw new Error('Confirma la verificación de receta médica antes de emitir la venta.');
        }

        const numericDiscount = Math.max(0, Math.min(grossTotal, Number(payload.discount || 0)));
        const total = Math.round((grossTotal - numericDiscount) * 100) / 100;
        const subtotal = Math.round((total / 1.18) * 100) / 100;
        const igv = Math.round((total - subtotal) * 100) / 100;
        const tendered =
          payload.paymentMethod === 'Efectivo' ? Math.max(total, Number(payload.amountTendered || total)) : total;
        const changeDue = Math.round((tendered - total) * 100) / 100;

        for (let i = 0; i < productSnaps.length; i++) {
          const snap = productSnaps[i];
          const nextStock = Number(snap.data()!.stock) - payload.items[i].quantity;
          tx.update(snap.ref, { stock: nextStock, updatedAt: serverTimestamp() });
        }

        if (customerSnap && customerSnap.exists()) {
          const cData = customerSnap.data();
          tx.update(customerSnap.ref, {
            visitsCount: Number(cData.visitsCount || 0) + 1,
            totalSpent: Math.round((Number(cData.totalSpent || 0) + total) * 100) / 100,
            lastVisit: new Date().toISOString(),
            updatedAt: serverTimestamp(),
          });
        }

        if (payload.queueTicketId) {
          tx.update(doc(db, pharmPath, 'queue', payload.queueTicketId), {
            status: 'Atendido',
            completedAt: new Date().toISOString(),
            assignedUserName: user.name.slice(0, 120),
            updatedAt: serverTimestamp(),
          });
        }

        let receiptCounter = Number(pharmData?.receiptCounter || 104);
        let facturaCounter = Number(pharmData?.facturaCounter || 18);
        let receiptNumber = '';

        if (payload.receiptType === 'Factura') {
          facturaCounter += 1;
          receiptNumber = `F001-${String(facturaCounter).padStart(6, '0')}`;
          tx.update(pharmRef, { facturaCounter, updatedAt: serverTimestamp() });
        } else {
          receiptCounter += 1;
          receiptNumber = `B001-${String(receiptCounter).padStart(6, '0')}`;
          tx.update(pharmRef, { receiptCounter, updatedAt: serverTimestamp() });
        }

        const safeDoc = (payload.customerDocument || '00000000').trim();
        const normalizedDoc = safeDoc.length >= 4 ? safeDoc.slice(0, 20) : '00000000';

        const saleRecord = {
          id: saleId,
          pharmacyId,
          ownerId,
          receiptNumber,
          receiptType: payload.receiptType,
          customerId: payload.customerId ?? null,
          customerName: (payload.customerName || 'Cliente General').trim().slice(0, 140),
          customerDocument: normalizedDoc,
          sellerId: user.id,
          sellerName: user.name.slice(0, 120),
          items: saleItems,
          subtotal,
          igv,
          discount: numericDiscount,
          total,
          paymentMethod: payload.paymentMethod,
          amountTendered: tendered,
          changeDue,
          prescriptionVerified: Boolean(payload.prescriptionVerified),
          queueTicketId: payload.queueTicketId ?? null,
          status: 'Completada' as const,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        tx.set(doc(db, pharmPath, 'sales', saleId), saleRecord);

        const logId = cleanId('aud');
        tx.set(doc(db, pharmPath, 'auditLogs', logId), {
          id: logId,
          pharmacyId,
          ownerId,
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name.slice(0, 120),
          userRole: user.role,
          action: 'SALE_CREATED',
          detail: `${payload.receiptType} ${receiptNumber} emitida a ${saleRecord.customerName} por S/ ${total.toFixed(2)} (${payload.paymentMethod}).`.slice(0, 400),
          createdAt: serverTimestamp(),
        });

        return {
          ...saleRecord,
          createdAt: new Date().toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof Error && (error.message.includes('Stock') || error.message.includes('receta'))) {
        throw error;
      }
      handleFirestoreError(error, OperationType.WRITE, `${pharmPath}/sales/${saleId}`);
    }
  },

  async voidSale(pharmacyId: string, user: UserProfile, saleId: string, reason: string): Promise<void> {
    const path = `pharmacies/${pharmacyId}/sales/${saleId}`;
    try {
      await runTransaction(db, async (tx) => {
        const saleRef = doc(db, path);
        const saleSnap = await tx.get(saleRef);
        if (!saleSnap.exists()) throw new Error('Venta no encontrada.');
        const saleData = saleSnap.data();
        if (saleData.status === 'Anulada') throw new Error('Esta venta ya fue anulada.');

        const items = (saleData.items as SaleItem[]) || [];
        const prodSnaps = await Promise.all(
          items.map((item) => tx.get(doc(db, 'pharmacies', pharmacyId, 'products', item.productId))),
        );

        for (let i = 0; i < prodSnaps.length; i++) {
          const pSnap = prodSnaps[i];
          if (pSnap.exists()) {
            const nextStock = Number(pSnap.data()!.stock) + items[i].quantity;
            tx.update(pSnap.ref, { stock: nextStock, updatedAt: serverTimestamp() });
          }
        }

        const safeReason = (reason || 'Anulación autorizada').trim().slice(0, 200);
        tx.update(saleRef, {
          status: 'Anulada',
          voidReason: safeReason,
          updatedAt: serverTimestamp(),
        });

        const logId = cleanId('aud');
        tx.set(doc(db, 'pharmacies', pharmacyId, 'auditLogs', logId), {
          id: logId,
          pharmacyId,
          ownerId: String(saleData.ownerId),
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name.slice(0, 120),
          userRole: user.role,
          action: 'SALE_VOIDED',
          detail: `Comprobante ${saleData.receiptNumber} anulado (S/ ${Number(saleData.total).toFixed(2)}). Stock restituido. Motivo: ${safeReason}`.slice(0, 400),
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('anulada')) throw error;
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  async createRestockOrder(
    pharmacyId: string,
    user: UserProfile,
    supplier: string,
    items: { productId: string; requestedQty: number }[],
    products: Product[],
  ): Promise<void> {
    const orderId = cleanId('rst');
    const pharmPath = `pharmacies/${pharmacyId}`;
    try {
      await runTransaction(db, async (tx) => {
        const pharmRef = doc(db, pharmPath);
        const pharmSnap = await tx.get(pharmRef);
        const ownerId = String(pharmSnap.data()?.ownerId || user.id);
        const nextNum = Number(pharmSnap.data()?.restockCounter || 41) + 1;
        const orderCode = `OC-2026-${String(nextNum).padStart(4, '0')}`;

        const orderItems: RestockOrder['items'] = [];
        let totalEstimatedCost = 0;

        for (const row of items) {
          const p = products.find((prod) => prod.id === row.productId);
          if (!p) continue;
          const qty = Math.max(1, Math.round(row.requestedQty));
          orderItems.push({
            productId: p.id,
            sku: p.sku,
            productName: p.name,
            requestedQty: qty,
            unitCost: p.costPrice,
          });
          totalEstimatedCost += qty * p.costPrice;
        }

        if (orderItems.length === 0) throw new Error('Selecciona al menos un producto válido.');

        tx.update(pharmRef, { restockCounter: nextNum, updatedAt: serverTimestamp() });
        tx.set(doc(db, pharmPath, 'restockOrders', orderId), {
          id: orderId,
          pharmacyId,
          ownerId,
          orderCode,
          supplier: supplier.trim().slice(0, 140),
          status: 'Pendiente',
          items: orderItems,
          totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
          createdBy: user.name.slice(0, 120),
          receivedAt: null,
          receivedBy: null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        const logId = cleanId('aud');
        tx.set(doc(db, pharmPath, 'auditLogs', logId), {
          id: logId,
          pharmacyId,
          ownerId,
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name.slice(0, 120),
          userRole: user.role,
          action: 'RESTOCK_ORDERED',
          detail: `Orden ${orderCode} emitida a ${supplier} (${orderItems.length} líneas, S/ ${totalEstimatedCost.toFixed(2)}).`.slice(0, 400),
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${pharmPath}/restockOrders/${orderId}`);
    }
  },

  async receiveRestockOrder(
    pharmacyId: string,
    user: UserProfile,
    orderId: string,
    batchNumber: string,
    expiryDate: string,
  ): Promise<void> {
    const path = `pharmacies/${pharmacyId}/restockOrders/${orderId}`;
    try {
      await runTransaction(db, async (tx) => {
        const orderRef = doc(db, path);
        const orderSnap = await tx.get(orderRef);
        if (!orderSnap.exists()) throw new Error('Orden de reposición no encontrada.');
        const orderData = orderSnap.data();
        if (orderData.status === 'Recibida') throw new Error('Esta orden ya fue recibida.');

        const items = (orderData.items as RestockOrder['items']) || [];
        const prodSnaps = await Promise.all(
          items.map((item) => tx.get(doc(db, 'pharmacies', pharmacyId, 'products', item.productId))),
        );

        const nextBatch = (batchNumber || 'LOT-26R91').trim().slice(0, 50);
        const nextExpiry = (expiryDate || new Date(Date.now() + 540 * 86400_000).toISOString().slice(0, 10)).slice(0, 10);

        for (let i = 0; i < prodSnaps.length; i++) {
          const pSnap = prodSnaps[i];
          if (pSnap.exists()) {
            const nextStock = Number(pSnap.data()!.stock) + items[i].requestedQty;
            tx.update(pSnap.ref, {
              stock: nextStock,
              batchNumber: nextBatch,
              expiryDate: nextExpiry,
              updatedAt: serverTimestamp(),
            });
          }
          items[i] = { ...items[i], newBatch: nextBatch, newExpiryDate: nextExpiry };
        }

        tx.update(orderRef, {
          status: 'Recibida',
          items,
          receivedAt: new Date().toISOString(),
          receivedBy: user.name.slice(0, 120),
          updatedAt: serverTimestamp(),
        });

        const logId = cleanId('aud');
        tx.set(doc(db, 'pharmacies', pharmacyId, 'auditLogs', logId), {
          id: logId,
          pharmacyId,
          ownerId: String(orderData.ownerId),
          timestamp: new Date().toISOString(),
          userId: user.id,
          userName: user.name.slice(0, 120),
          userRole: user.role,
          action: 'RESTOCK_RECEIVED',
          detail: `Ingreso de mercadería ${orderData.orderCode} confirmado (Lote ${nextBatch}, Venc. ${nextExpiry}).`.slice(0, 400),
          createdAt: serverTimestamp(),
        });
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },
};
