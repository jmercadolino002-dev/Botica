import crypto from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import express, { NextFunction, Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import { store, verifyPassword } from './server/store';
import type {
  DashboardSummary,
  PaymentMethod,
  Product,
  QueueServiceType,
  ReceiptType,
  RestockOrder,
  Sale,
  SaleItem,
  UserProfile,
} from './src/shared/types';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'novasalud-clinical-hmac-secret-2026';

interface AuthenticatedRequest extends Request {
  user?: UserProfile;
}

function signToken(payload: { userId: string; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): { userId: string; exp: number } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as {
      userId: string;
      exp: number;
    };
    if (!parsed.userId || Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce<Record<string, string>>((acc, part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      acc[key] = val;
    }
    return acc;
  }, {});
}

function sanitizeUser(u: {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'seller';
  title: string;
  cmpOrCode: string;
}): UserProfile {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    title: u.title,
    cmpOrCode: u.cmpOrCode,
  };
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return auth.slice(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies.novasalud_session || null;
}

function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Sesión no autenticada. Inicia sesión para continuar.' });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Sesión expirada o inválida.' });
    return;
  }
  const db = store.getState();
  const user = db.users.find((u) => u.id === payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Usuario no encontrado.' });
    return;
  }
  req.user = sanitizeUser(user);
  next();
}

function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({
      error: 'Acceso restringido. Esta acción requiere perfil de Química Farmacéutica (Administrador).',
    });
    return;
  }
  next();
}

function issueSession(res: Response, user: UserProfile): { token: string; user: UserProfile } {
  const token = signToken({ userId: user.id, exp: Date.now() + 1000 * 60 * 60 * 12 });
  res.setHeader(
    'Set-Cookie',
    `novasalud_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200`,
  );
  return { token, user };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  // Auth routes
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: 'Ingresa tu correo y contraseña.' });
      return;
    }
    const db = store.getState();
    const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash, user.passwordSalt)) {
      res.status(401).json({ error: 'Credenciales incorrectas. Verifica tu correo y contraseña.' });
      return;
    }
    const profile = sanitizeUser(user);
    store.addAudit(profile, 'AUTH_LOGIN', `Inicio de sesión verificado (${profile.title}).`);
    res.json(issueSession(res, profile));
  });

  app.post('/api/auth/demo-init', (req: Request, res: Response) => {
    const { role } = (req.body || {}) as { role?: 'admin' | 'seller' };
    const db = store.getState();
    const target = db.users.find((u) => u.role === (role === 'seller' ? 'seller' : 'admin')) || db.users[0];
    const profile = sanitizeUser(target);
    store.addAudit(profile, 'AUTH_LOGIN', `Sesión operativa iniciada (${profile.title}).`);
    res.json(issueSession(res, profile));
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    if (req.user) {
      store.addAudit(req.user, 'AUTH_LOGOUT', 'Cierre de sesión de operador.');
    }
    res.setHeader('Set-Cookie', 'novasalud_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.user });
  });

  // Dashboard summary
  app.get('/api/dashboard', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    const alerts = store.computeAlerts();
    const completedSales = db.sales.filter((s) => s.status === 'Completada');
    const todayPrefix = new Date().toISOString().slice(0, 10);
    const todaySales = completedSales.filter((s) => s.createdAt.startsWith(todayPrefix));
    const effectiveSales = todaySales.length > 0 ? todaySales : completedSales;

    const todayRevenue = effectiveSales.reduce((sum, s) => sum + s.total, 0);
    const todaySalesCount = effectiveSales.length;
    const averageTicket = todaySalesCount > 0 ? todayRevenue / todaySalesCount : 0;

    // Average wait time from queue
    const waitingOrServed = db.queue.filter((q) => q.status !== 'En espera' || true);
    let totalWaitMin = 0;
    let waitSamples = 0;
    for (const q of waitingOrServed) {
      const start = new Date(q.createdAt).getTime();
      const end = q.startedAt ? new Date(q.startedAt).getTime() : Date.now();
      const mins = Math.max(1, Math.round((end - start) / 60_000));
      totalWaitMin += Math.min(mins, 25);
      waitSamples++;
    }
    const averageWaitMinutes = waitSamples > 0 ? Math.round((totalWaitMin / waitSamples) * 10) / 10 : 3.2;

    // Hourly sales buckets (08:00 - 20:00)
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

    // Top products
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

    const summary: DashboardSummary = {
      todayRevenue: Math.round(todayRevenue * 100) / 100,
      todaySalesCount,
      averageTicket: Math.round(averageTicket * 100) / 100,
      averageWaitMinutes,
      activeQueueCount: db.queue.filter((q) => q.status === 'En espera' || q.status === 'En atención').length,
      alertCounts: {
        outOfStock: alerts.filter((a) => a.severity === 'Agotado').length,
        lowStock: alerts.filter((a) => a.severity === 'Stock Bajo').length,
        expiringSoon: alerts.filter((a) => a.severity === 'Por Vencer').length,
        total: alerts.length,
      },
      hourlySales,
      topProducts,
      recentSales: db.sales.slice(0, 6),
      priorityAlerts: alerts.slice(0, 6),
    };

    res.json(summary);
  });

  // Products / Inventory
  app.get('/api/products', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    res.json({ products: db.products });
  });

  app.post('/api/products', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const body = req.body as Partial<Product>;
    if (!body.name || !body.sku || !body.activeIngredient || body.salePrice == null) {
      res.status(400).json({ error: 'Nombre, SKU, principio activo y precio de venta son obligatorios.' });
      return;
    }
    const db = store.getState();
    if (db.products.some((p) => p.sku.toLowerCase() === body.sku!.trim().toLowerCase())) {
      res.status(409).json({ error: `Ya existe un producto registrado con el SKU ${body.sku}.` });
      return;
    }

    const product: Product = {
      id: `prod-${Date.now()}`,
      sku: body.sku.trim().toUpperCase(),
      barcode: (body.barcode || `7750182${Math.floor(100000 + Math.random() * 899999)}`).trim(),
      name: body.name.trim(),
      activeIngredient: body.activeIngredient.trim(),
      laboratory: (body.laboratory || 'Genfar').trim(),
      category: body.category || 'Analgésicos',
      presentation: (body.presentation || 'Caja x 10 unidades').trim(),
      batchNumber: (body.batchNumber || `LOT-${new Date().getFullYear().toString().slice(-2)}Z`).trim(),
      expiryDate: body.expiryDate || new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10),
      stock: Math.max(0, Number(body.stock ?? 0)),
      minStock: Math.max(1, Number(body.minStock ?? 10)),
      optimalStock: Math.max(5, Number(body.optimalStock ?? 30)),
      costPrice: Math.max(0.1, Number(body.costPrice ?? 5)),
      salePrice: Math.max(0.1, Number(body.salePrice)),
      requiresPrescription: Boolean(body.requiresPrescription),
      location: (body.location || 'Estante A-01').trim(),
      updatedAt: new Date().toISOString(),
    };

    db.products.unshift(product);
    store.addAudit(req.user!, 'PRODUCT_CREATED', `Producto ${product.sku} (${product.name}) registrado con stock ${product.stock}.`);
    res.status(201).json({ product });
  });

  app.put('/api/products/:id', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    const idx = db.products.findIndex((p) => p.id === req.params.id);
    if (idx === -1) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const existing = db.products[idx];
    const body = req.body as Partial<Product>;
    const updated: Product = {
      ...existing,
      ...body,
      id: existing.id,
      stock: body.stock !== undefined ? Math.max(0, Number(body.stock)) : existing.stock,
      minStock: body.minStock !== undefined ? Math.max(1, Number(body.minStock)) : existing.minStock,
      optimalStock: body.optimalStock !== undefined ? Math.max(1, Number(body.optimalStock)) : existing.optimalStock,
      costPrice: body.costPrice !== undefined ? Math.max(0.1, Number(body.costPrice)) : existing.costPrice,
      salePrice: body.salePrice !== undefined ? Math.max(0.1, Number(body.salePrice)) : existing.salePrice,
      updatedAt: new Date().toISOString(),
    };
    db.products[idx] = updated;
    store.addAudit(req.user!, 'PRODUCT_UPDATED', `Ficha actualizada de ${updated.sku} (${updated.name}).`);
    res.json({ product: updated });
  });

  app.post('/api/products/:id/adjust', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { delta, reason } = req.body as { delta?: number; reason?: string };
    const numericDelta = Number(delta);
    if (!Number.isFinite(numericDelta) || numericDelta === 0) {
      res.status(400).json({ error: 'Indica una cantidad válida distinta de cero.' });
      return;
    }
    if (!reason || reason.trim().length < 3) {
      res.status(400).json({ error: 'Ingresa un motivo para auditar el ajuste de inventario.' });
      return;
    }
    const db = store.getState();
    const product = db.products.find((p) => p.id === req.params.id);
    if (!product) {
      res.status(404).json({ error: 'Producto no encontrado.' });
      return;
    }
    const nextStock = product.stock + numericDelta;
    if (nextStock < 0) {
      res.status(400).json({ error: 'El stock resultante no puede ser negativo.' });
      return;
    }
    product.stock = nextStock;
    product.updatedAt = new Date().toISOString();
    store.addAudit(
      req.user!,
      'STOCK_ADJUSTED',
      `Ajuste ${numericDelta > 0 ? `+${numericDelta}` : numericDelta} u. en ${product.sku} (${product.name}) → Stock actual: ${nextStock}. Motivo: ${reason.trim()}`,
    );
    res.json({ product });
  });

  // Alerts & Restock
  app.get('/api/alerts', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    const alerts = store.computeAlerts();
    res.json({ alerts, restockOrders: db.restockOrders });
  });

  app.post('/api/restock-orders', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { supplier, items } = req.body as {
      supplier?: string;
      items?: { productId: string; requestedQty: number }[];
    };
    if (!supplier || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Selecciona proveedor y al menos un producto para reponer.' });
      return;
    }
    const db = store.getState();
    const orderItems: RestockOrder['items'] = [];
    let totalEstimatedCost = 0;

    for (const row of items) {
      const product = db.products.find((p) => p.id === row.productId);
      const qty = Math.max(1, Math.round(Number(row.requestedQty)));
      if (!product) continue;
      orderItems.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        requestedQty: qty,
        unitCost: product.costPrice,
      });
      totalEstimatedCost += qty * product.costPrice;
    }

    if (orderItems.length === 0) {
      res.status(400).json({ error: 'No se encontraron productos válidos en la orden.' });
      return;
    }

    db.restockCounter += 1;
    const order: RestockOrder = {
      id: `rst-${Date.now()}`,
      orderCode: `OC-2026-${String(db.restockCounter).padStart(4, '0')}`,
      supplier: supplier.trim(),
      status: 'Pendiente',
      items: orderItems,
      totalEstimatedCost: Math.round(totalEstimatedCost * 100) / 100,
      createdBy: req.user!.name,
      createdAt: new Date().toISOString(),
      receivedAt: null,
      receivedBy: null,
    };

    db.restockOrders.unshift(order);
    store.addAudit(
      req.user!,
      'RESTOCK_ORDERED',
      `Orden ${order.orderCode} emitida a ${order.supplier} (${order.items.length} líneas, S/ ${order.totalEstimatedCost.toFixed(2)}).`,
    );
    res.status(201).json({ order });
  });

  app.post('/api/restock-orders/:id/receive', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    const order = db.restockOrders.find((o) => o.id === req.params.id);
    if (!order) {
      res.status(404).json({ error: 'Orden de reposición no encontrada.' });
      return;
    }
    if (order.status === 'Recibida') {
      res.status(400).json({ error: 'Esta orden ya fue ingresada al inventario.' });
      return;
    }

    const { batchNumber, expiryDate } = (req.body || {}) as {
      batchNumber?: string;
      expiryDate?: string;
    };

    const nextExpiry =
      expiryDate || new Date(Date.now() + 540 * 86400_000).toISOString().slice(0, 10);
    const nextBatch = batchNumber?.trim() || `LOT-26R${Math.floor(10 + Math.random() * 89)}`;

    for (const item of order.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (product) {
        product.stock += item.requestedQty;
        product.batchNumber = nextBatch;
        product.expiryDate = nextExpiry;
        product.updatedAt = new Date().toISOString();
      }
      item.newBatch = nextBatch;
      item.newExpiryDate = nextExpiry;
    }

    order.status = 'Recibida';
    order.receivedAt = new Date().toISOString();
    order.receivedBy = req.user!.name;

    store.addAudit(
      req.user!,
      'RESTOCK_RECEIVED',
      `Ingreso de mercadería ${order.orderCode} confirmado (Lote ${nextBatch}, Venc. ${nextExpiry}). Stock actualizado en tiempo real.`,
    );
    res.json({ order });
  });

  // Customers
  app.get('/api/customers', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    res.json({ customers: db.customers });
  });

  app.post('/api/customers', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { documentType, documentNumber, fullName, phone, email, allergies, notes } = req.body as {
      documentType?: 'DNI' | 'RUC' | 'CE';
      documentNumber?: string;
      fullName?: string;
      phone?: string;
      email?: string;
      allergies?: string;
      notes?: string;
    };
    if (!fullName || !documentNumber) {
      res.status(400).json({ error: 'Nombre completo y número de documento son obligatorios.' });
      return;
    }
    const db = store.getState();
    if (db.customers.some((c) => c.documentNumber === documentNumber.trim())) {
      res.status(409).json({ error: 'Ya existe un cliente registrado con ese documento.' });
      return;
    }
    const customer = {
      id: `cust-${Date.now()}`,
      documentType: documentType || 'DNI',
      documentNumber: documentNumber.trim(),
      fullName: fullName.trim(),
      phone: (phone || '').trim(),
      email: (email || '').trim(),
      allergies: (allergies || 'Ninguna conocida').trim(),
      notes: (notes || '').trim(),
      visitsCount: 0,
      totalSpent: 0,
      lastVisit: new Date().toISOString(),
    };
    db.customers.unshift(customer);
    store.addAudit(
      req.user!,
      'CUSTOMER_CREATED',
      `Cliente registrado: ${customer.fullName} (${customer.documentType} ${customer.documentNumber}).`,
    );
    res.status(201).json({ customer });
  });

  // Queue
  app.get('/api/queue', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    res.json({ queue: db.queue });
  });

  app.post('/api/queue', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { customerId, customerName, documentNumber, serviceType, priority } = req.body as {
      customerId?: string | null;
      customerName?: string;
      documentNumber?: string;
      serviceType?: QueueServiceType;
      priority?: 'Normal' | 'Preferencial';
    };
    if (!customerName || customerName.trim().length < 2) {
      res.status(400).json({ error: 'Ingresa el nombre del cliente para generar el turno.' });
      return;
    }
    const db = store.getState();
    db.queueCounter += 1;
    const ticket = {
      id: `q-${Date.now()}`,
      ticketCode: `T-${String(db.queueCounter).padStart(3, '0')}`,
      customerId: customerId || null,
      customerName: customerName.trim(),
      documentNumber: (documentNumber || 'Sin documento').trim(),
      serviceType: serviceType || 'Atención Rápida',
      priority: priority || 'Normal',
      status: 'En espera' as const,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      assignedUserName: null,
    };
    db.queue.push(ticket);
    store.addAudit(
      req.user!,
      'QUEUE_UPDATED',
      `Turno ${ticket.ticketCode} generado para ${ticket.customerName} (${ticket.serviceType}).`,
    );
    res.status(201).json({ ticket });
  });

  app.patch('/api/queue/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { status } = req.body as { status?: 'En espera' | 'En atención' | 'Atendido' };
    const db = store.getState();
    const ticket = db.queue.find((q) => q.id === req.params.id);
    if (!ticket) {
      res.status(404).json({ error: 'Turno no encontrado.' });
      return;
    }
    if (status) {
      ticket.status = status;
      if (status === 'En atención') {
        ticket.startedAt = ticket.startedAt || new Date().toISOString();
        ticket.assignedUserName = req.user!.name;
      } else if (status === 'Atendido') {
        ticket.completedAt = new Date().toISOString();
        ticket.assignedUserName = ticket.assignedUserName || req.user!.name;
      }
    }
    store.save();
    res.json({ ticket });
  });

  // Sales
  app.get('/api/sales', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    res.json({ sales: db.sales });
  });

  app.post('/api/sales', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const {
      receiptType,
      customerId,
      customerName,
      customerDocument,
      items,
      discount,
      paymentMethod,
      amountTendered,
      prescriptionVerified,
      queueTicketId,
    } = req.body as {
      receiptType?: ReceiptType;
      customerId?: string | null;
      customerName?: string;
      customerDocument?: string;
      items?: { productId: string; quantity: number }[];
      discount?: number;
      paymentMethod?: PaymentMethod;
      amountTendered?: number;
      prescriptionVerified?: boolean;
      queueTicketId?: string | null;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Agrega al menos un producto al ticket de venta.' });
      return;
    }

    const db = store.getState();
    const saleItems: SaleItem[] = [];
    let grossTotal = 0;
    let needsRx = false;

    // Validate stock first atomically
    for (const line of items) {
      const product = db.products.find((p) => p.id === line.productId);
      const qty = Math.round(Number(line.quantity));
      if (!product) {
        res.status(404).json({ error: 'Uno de los productos del carrito ya no existe.' });
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        res.status(400).json({ error: `Cantidad inválida para ${product.name}.` });
        return;
      }
      if (product.stock < qty) {
        res.status(409).json({
          error: `Stock insuficiente para ${product.name}. Disponible: ${product.stock} u.`,
        });
        return;
      }
      if (product.requiresPrescription) needsRx = true;
      const lineTotal = Math.round(product.salePrice * qty * 100) / 100;
      grossTotal += lineTotal;
      saleItems.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        presentation: product.presentation,
        quantity: qty,
        unitPrice: product.salePrice,
        subtotal: lineTotal,
        requiresPrescription: product.requiresPrescription,
      });
    }

    if (needsRx && !prescriptionVerified) {
      res.status(400).json({
        error: 'Uno o más productos requieren receta médica. Confirma la verificación antes de cobrar.',
      });
      return;
    }

    const numericDiscount = Math.max(0, Math.min(grossTotal, Number(discount || 0)));
    const total = Math.round((grossTotal - numericDiscount) * 100) / 100;
    const subtotal = Math.round((total / 1.18) * 100) / 100;
    const igv = Math.round((total - subtotal) * 100) / 100;
    const method: PaymentMethod = paymentMethod || 'Efectivo';
    const tendered = method === 'Efectivo' ? Math.max(total, Number(amountTendered || total)) : total;
    const changeDue = Math.round((tendered - total) * 100) / 100;

    // Decrement stock
    for (const item of saleItems) {
      const product = db.products.find((p) => p.id === item.productId)!;
      product.stock -= item.quantity;
      product.updatedAt = new Date().toISOString();
    }

    // Update customer metrics
    if (customerId) {
      const cust = db.customers.find((c) => c.id === customerId);
      if (cust) {
        cust.visitsCount += 1;
        cust.totalSpent = Math.round((cust.totalSpent + total) * 100) / 100;
        cust.lastVisit = new Date().toISOString();
      }
    }

    // Close linked queue ticket
    if (queueTicketId) {
      const ticket = db.queue.find((q) => q.id === queueTicketId);
      if (ticket) {
        ticket.status = 'Atendido';
        ticket.completedAt = new Date().toISOString();
        ticket.assignedUserName = req.user!.name;
      }
    }

    const docType: ReceiptType = receiptType || 'Boleta';
    let receiptNumber = '';
    if (docType === 'Factura') {
      db.facturaCounter += 1;
      receiptNumber = `F001-${String(db.facturaCounter).padStart(6, '0')}`;
    } else {
      db.receiptCounter += 1;
      receiptNumber = `B001-${String(db.receiptCounter).padStart(6, '0')}`;
    }

    const sale: Sale = {
      id: `sale-${Date.now()}`,
      receiptNumber,
      receiptType: docType,
      customerId: customerId || null,
      customerName: (customerName || 'Cliente General').trim(),
      customerDocument: (customerDocument || '00000000').trim(),
      sellerId: req.user!.id,
      sellerName: req.user!.name,
      items: saleItems,
      subtotal,
      igv,
      discount: numericDiscount,
      total,
      paymentMethod: method,
      amountTendered: tendered,
      changeDue,
      prescriptionVerified: Boolean(prescriptionVerified),
      queueTicketId: queueTicketId || null,
      status: 'Completada',
      createdAt: new Date().toISOString(),
    };

    db.sales.unshift(sale);
    store.addAudit(
      req.user!,
      'SALE_CREATED',
      `${sale.receiptType} ${sale.receiptNumber} emitida a ${sale.customerName} por S/ ${sale.total.toFixed(2)} (${sale.paymentMethod}).`,
    );

    const updatedAlerts = store.computeAlerts();
    res.status(201).json({ sale, alertCount: updatedAlerts.length });
  });

  app.post('/api/sales/:id/void', requireAuth, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
    const { reason } = req.body as { reason?: string };
    const db = store.getState();
    const sale = db.sales.find((s) => s.id === req.params.id);
    if (!sale) {
      res.status(404).json({ error: 'Venta no encontrada.' });
      return;
    }
    if (sale.status === 'Anulada') {
      res.status(400).json({ error: 'Esta venta ya fue anulada previamente.' });
      return;
    }

    // Restore stock atomically
    for (const item of sale.items) {
      const product = db.products.find((p) => p.id === item.productId);
      if (product) {
        product.stock += item.quantity;
        product.updatedAt = new Date().toISOString();
      }
    }

    sale.status = 'Anulada';
    sale.voidReason = (reason || 'Anulación autorizada por Química Farmacéutica').trim();
    store.addAudit(
      req.user!,
      'SALE_VOIDED',
      `Comprobante ${sale.receiptNumber} anulado (S/ ${sale.total.toFixed(2)}). Stock restituido. Motivo: ${sale.voidReason}`,
    );
    res.json({ sale });
  });

  // Audit logs
  app.get('/api/audit', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = store.getState();
    res.json({ auditLogs: db.auditLogs });
  });

  // Vite / Static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Nova Salud Fullstack Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
