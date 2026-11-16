import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditActionType,
  AuditLog,
  Customer,
  InventoryAlert,
  Product,
  QueueTicket,
  RestockOrder,
  Sale,
  UserProfile,
} from '../src/shared/types';

export interface StoredUser extends UserProfile {
  passwordHash: string;
  passwordSalt: string;
}

export interface DatabaseState {
  users: StoredUser[];
  products: Product[];
  customers: Customer[];
  queue: QueueTicket[];
  sales: Sale[];
  restockOrders: RestockOrder[];
  auditLogs: AuditLog[];
  receiptCounter: number;
  facturaCounter: number;
  queueCounter: number;
  restockCounter: number;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'novasalud-db.json');

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, actualSalt, 64).toString('hex');
  return { hash, salt: actualSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isoTimestampMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function createInitialState(): DatabaseState {
  const adminCreds = hashPassword('NovaAdmin2026!');
  const sellerCreds = hashPassword('NovaVentas2026!');
  const nowIso = new Date().toISOString();

  const users: StoredUser[] = [
    {
      id: 'usr-admin',
      name: 'Dra. Rosa Mamani',
      email: 'admin@novasalud.pe',
      role: 'admin',
      title: 'Química Farmacéutica',
      cmpOrCode: 'CQFP-24819',
      passwordHash: adminCreds.hash,
      passwordSalt: adminCreds.salt,
    },
    {
      id: 'usr-seller',
      name: 'Carlos Mendoza',
      email: 'ventas@novasalud.pe',
      role: 'seller',
      title: 'Técnico en Farmacia',
      cmpOrCode: 'TF-09412',
      passwordHash: sellerCreds.hash,
      passwordSalt: sellerCreds.salt,
    },
  ];

  const products: Product[] = [
    {
      id: 'prod-1',
      sku: 'MED-001',
      barcode: '7750182001014',
      name: 'Panadol Forte 500mg / 50mg',
      activeIngredient: 'Paracetamol + Cafeína',
      laboratory: 'GSK',
      category: 'Analgésicos',
      presentation: 'Caja x 20 tabletas',
      batchNumber: 'LOT-26A14',
      expiryDate: isoDateDaysFromNow(340),
      stock: 46,
      minStock: 15,
      optimalStock: 60,
      costPrice: 12.4,
      salePrice: 18.5,
      requiresPrescription: false,
      location: 'Estante A-01',
      updatedAt: nowIso,
    },
    {
      id: 'prod-2',
      sku: 'MED-002',
      barcode: '7750182001021',
      name: 'Amoxicilina + Ácido Clavulánico 875/125mg',
      activeIngredient: 'Amoxicilina / Ác. Clavulánico',
      laboratory: 'Genfar',
      category: 'Antibióticos',
      presentation: 'Caja x 14 comprimidos',
      batchNumber: 'LOT-26B09',
      expiryDate: isoDateDaysFromNow(280),
      stock: 6,
      minStock: 12,
      optimalStock: 36,
      costPrice: 22.0,
      salePrice: 34.9,
      requiresPrescription: true,
      location: 'Estante B-03',
      updatedAt: nowIso,
    },
    {
      id: 'prod-3',
      sku: 'MED-003',
      barcode: '7750182001038',
      name: 'Ibuprofeno 400mg',
      activeIngredient: 'Ibuprofeno',
      laboratory: 'Portugal',
      category: 'Analgésicos',
      presentation: 'Blíster x 10 cápsulas blandas',
      batchNumber: 'LOT-25N88',
      expiryDate: isoDateDaysFromNow(42),
      stock: 32,
      minStock: 15,
      optimalStock: 50,
      costPrice: 5.2,
      salePrice: 9.5,
      requiresPrescription: false,
      location: 'Estante A-02',
      updatedAt: nowIso,
    },
    {
      id: 'prod-4',
      sku: 'MED-004',
      barcode: '7750182001045',
      name: 'Azitromicina 500mg',
      activeIngredient: 'Azitromicina',
      laboratory: 'Farmindustria',
      category: 'Antibióticos',
      presentation: 'Caja x 3 tabletas',
      batchNumber: 'LOT-26C21',
      expiryDate: isoDateDaysFromNow(410),
      stock: 0,
      minStock: 10,
      optimalStock: 30,
      costPrice: 8.5,
      salePrice: 14.8,
      requiresPrescription: true,
      location: 'Estante B-01',
      updatedAt: nowIso,
    },
    {
      id: 'prod-5',
      sku: 'MED-005',
      barcode: '7750182001052',
      name: 'Loratadina 10mg',
      activeIngredient: 'Loratadina',
      laboratory: 'Medrock',
      category: 'Respiratorio',
      presentation: 'Caja x 10 tabletas',
      batchNumber: 'LOT-26D04',
      expiryDate: isoDateDaysFromNow(510),
      stock: 28,
      minStock: 12,
      optimalStock: 40,
      costPrice: 4.1,
      salePrice: 7.9,
      requiresPrescription: false,
      location: 'Estante C-04',
      updatedAt: nowIso,
    },
    {
      id: 'prod-6',
      sku: 'MED-006',
      barcode: '7750182001069',
      name: 'Salbutamol Inhalador 100mcg',
      activeIngredient: 'Salbutamol sulfato',
      laboratory: 'GSK',
      category: 'Respiratorio',
      presentation: 'Aerosol 200 dosis',
      batchNumber: 'LOT-26A77',
      expiryDate: isoDateDaysFromNow(220),
      stock: 4,
      minStock: 8,
      optimalStock: 24,
      costPrice: 18.0,
      salePrice: 28.5,
      requiresPrescription: true,
      location: 'Estante C-01',
      updatedAt: nowIso,
    },
    {
      id: 'prod-7',
      sku: 'MED-007',
      barcode: '7750182001076',
      name: 'Omeprazol 20mg',
      activeIngredient: 'Omeprazol',
      laboratory: 'La Santé',
      category: 'Digestivo',
      presentation: 'Caja x 14 cápsulas',
      batchNumber: 'LOT-26E12',
      expiryDate: isoDateDaysFromNow(390),
      stock: 35,
      minStock: 14,
      optimalStock: 45,
      costPrice: 6.8,
      salePrice: 12.0,
      requiresPrescription: false,
      location: 'Estante D-02',
      updatedAt: nowIso,
    },
    {
      id: 'prod-8',
      sku: 'MED-008',
      barcode: '7750182001083',
      name: 'Bismutol Suspensión Oral 262mg',
      activeIngredient: 'Subsalicilato de bismuto',
      laboratory: 'Teva',
      category: 'Digestivo',
      presentation: 'Frasco x 150 ml',
      batchNumber: 'LOT-25M15',
      expiryDate: isoDateDaysFromNow(28),
      stock: 14,
      minStock: 10,
      optimalStock: 25,
      costPrice: 14.5,
      salePrice: 22.9,
      requiresPrescription: false,
      location: 'Estante D-05',
      updatedAt: nowIso,
    },
    {
      id: 'prod-9',
      sku: 'MED-009',
      barcode: '7750182001090',
      name: 'Redoxon Triple Acción Vitamina C + Zinc',
      activeIngredient: 'Ácido ascórbico + Vit. D + Zinc',
      laboratory: 'Bayer',
      category: 'Vitaminas',
      presentation: 'Tubo x 10 comp. efervescentes',
      batchNumber: 'LOT-26F18',
      expiryDate: isoDateDaysFromNow(460),
      stock: 21,
      minStock: 12,
      optimalStock: 40,
      costPrice: 15.0,
      salePrice: 24.0,
      requiresPrescription: false,
      location: 'Estante E-01',
      updatedAt: nowIso,
    },
    {
      id: 'prod-10',
      sku: 'MED-010',
      barcode: '7750182001106',
      name: 'Neurobión DC 10000',
      activeIngredient: 'Complejo B (B1 + B6 + B12)',
      laboratory: 'P&G Health',
      category: 'Vitaminas',
      presentation: 'Caja x 30 tabletas',
      batchNumber: 'LOT-26G03',
      expiryDate: isoDateDaysFromNow(315),
      stock: 5,
      minStock: 10,
      optimalStock: 25,
      costPrice: 28.0,
      salePrice: 42.5,
      requiresPrescription: false,
      location: 'Estante E-03',
      updatedAt: nowIso,
    },
    {
      id: 'prod-11',
      sku: 'MED-011',
      barcode: '7750182001113',
      name: 'La Roche-Posay Anthelios UVMune 400 FPS 50+',
      activeIngredient: 'Mexoryl 400 + Agua Termal',
      laboratory: 'La Roche-Posay',
      category: 'Dermocosmética',
      presentation: 'Fluido invisible x 50 ml',
      batchNumber: 'LOT-26H22',
      expiryDate: isoDateDaysFromNow(520),
      stock: 11,
      minStock: 6,
      optimalStock: 18,
      costPrice: 68.0,
      salePrice: 98.0,
      requiresPrescription: false,
      location: 'Vitrina F-01',
      updatedAt: nowIso,
    },
    {
      id: 'prod-12',
      sku: 'MED-012',
      barcode: '7750182001120',
      name: 'Bepanthen Crema Regeneradora',
      activeIngredient: 'Dexpantenol 5%',
      laboratory: 'Bayer',
      category: 'Dermocosmética',
      presentation: 'Tubo x 30 g',
      batchNumber: 'LOT-26J09',
      expiryDate: isoDateDaysFromNow(400),
      stock: 16,
      minStock: 8,
      optimalStock: 24,
      costPrice: 21.0,
      salePrice: 32.0,
      requiresPrescription: false,
      location: 'Vitrina F-04',
      updatedAt: nowIso,
    },
    {
      id: 'prod-13',
      sku: 'MED-013',
      barcode: '7750182001137',
      name: 'Alcohol Medicinal 70° Alkofarma',
      activeIngredient: 'Etanol 70% v/v',
      laboratory: 'Alkofarma',
      category: 'Primeros Auxilios',
      presentation: 'Frasco x 500 ml',
      batchNumber: 'LOT-26K11',
      expiryDate: isoDateDaysFromNow(640),
      stock: 3,
      minStock: 12,
      optimalStock: 36,
      costPrice: 5.5,
      salePrice: 9.8,
      requiresPrescription: false,
      location: 'Estante G-01',
      updatedAt: nowIso,
    },
    {
      id: 'prod-14',
      sku: 'MED-014',
      barcode: '7750182001144',
      name: 'Gasa Estéril Hidrofila 10x10 cm',
      activeIngredient: 'Algodón quirúrgico estéril',
      laboratory: 'Tagumedica',
      category: 'Primeros Auxilios',
      presentation: 'Caja x 10 sobres',
      batchNumber: 'LOT-26L02',
      expiryDate: isoDateDaysFromNow(700),
      stock: 22,
      minStock: 10,
      optimalStock: 30,
      costPrice: 7.2,
      salePrice: 12.5,
      requiresPrescription: false,
      location: 'Estante G-02',
      updatedAt: nowIso,
    },
    {
      id: 'prod-15',
      sku: 'MED-015',
      barcode: '7750182001151',
      name: 'Losartán Potásico 50mg',
      activeIngredient: 'Losartán potásico',
      laboratory: 'Farmindustria',
      category: 'Analgésicos',
      presentation: 'Caja x 30 tabletas',
      batchNumber: 'LOT-26A45',
      expiryDate: isoDateDaysFromNow(365),
      stock: 19,
      minStock: 12,
      optimalStock: 40,
      costPrice: 9.4,
      salePrice: 16.5,
      requiresPrescription: true,
      location: 'Estante B-06',
      updatedAt: nowIso,
    },
    {
      id: 'prod-16',
      sku: 'MED-016',
      barcode: '7750182001168',
      name: 'Cetirizina 10mg',
      activeIngredient: 'Cetirizina diclorhidrato',
      laboratory: 'Portugal',
      category: 'Respiratorio',
      presentation: 'Caja x 10 tabletas',
      batchNumber: 'LOT-26B31',
      expiryDate: isoDateDaysFromNow(430),
      stock: 0,
      minStock: 12,
      optimalStock: 35,
      costPrice: 3.8,
      salePrice: 7.0,
      requiresPrescription: false,
      location: 'Estante C-05',
      updatedAt: nowIso,
    },
  ];

  const customers: Customer[] = [
    {
      id: 'cust-1',
      documentType: 'DNI',
      documentNumber: '45821904',
      fullName: 'María Elena Quispe Torres',
      phone: '987654321',
      email: 'maria.quispe@gmail.com',
      allergies: 'Penicilina',
      notes: 'Paciente hipertensa · Prefiere genéricos certificados.',
      visitsCount: 8,
      totalSpent: 342.8,
      lastVisit: isoTimestampMinutesAgo(95),
    },
    {
      id: 'cust-2',
      documentType: 'DNI',
      documentNumber: '72194032',
      fullName: 'Jorge Luis Paredes Vega',
      phone: '954120884',
      email: 'jparedes@outlook.com',
      allergies: 'Ninguna conocida',
      notes: 'Compra frecuente de dermocosmética.',
      visitsCount: 4,
      totalSpent: 289.0,
      lastVisit: isoTimestampMinutesAgo(180),
    },
    {
      id: 'cust-3',
      documentType: 'DNI',
      documentNumber: '09412875',
      fullName: 'Lucía Fernanda Salazar Ríos',
      phone: '991234011',
      email: 'lucia.salazar@gmail.com',
      allergies: 'Sulfa',
      notes: 'Atención preferencial · Adulto mayor.',
      visitsCount: 12,
      totalSpent: 518.4,
      lastVisit: isoTimestampMinutesAgo(310),
    },
    {
      id: 'cust-4',
      documentType: 'RUC',
      documentNumber: '20548912341',
      fullName: 'Clínica Dental Sonrisa E.I.R.L.',
      phone: '014421900',
      email: 'compras@clinicasonrisa.pe',
      allergies: 'No aplica',
      notes: 'Facturación mensual de insumos y primeros auxilios.',
      visitsCount: 6,
      totalSpent: 840.5,
      lastVisit: isoTimestampMinutesAgo(1440),
    },
  ];

  const queue: QueueTicket[] = [
    {
      id: 'q-101',
      ticketCode: 'T-041',
      customerId: 'cust-1',
      customerName: 'María Elena Quispe Torres',
      documentNumber: '45821904',
      serviceType: 'Receta Médica',
      priority: 'Normal',
      status: 'En atención',
      createdAt: isoTimestampMinutesAgo(6),
      startedAt: isoTimestampMinutesAgo(2),
      completedAt: null,
      assignedUserName: 'Dra. Rosa Mamani',
    },
    {
      id: 'q-102',
      ticketCode: 'T-042',
      customerId: 'cust-3',
      customerName: 'Lucía Fernanda Salazar Ríos',
      documentNumber: '09412875',
      serviceType: 'Consulta Farmacéutica',
      priority: 'Preferencial',
      status: 'En espera',
      createdAt: isoTimestampMinutesAgo(4),
      startedAt: null,
      completedAt: null,
      assignedUserName: null,
    },
    {
      id: 'q-103',
      ticketCode: 'T-043',
      customerId: null,
      customerName: 'Mateo Díaz Castro',
      documentNumber: '74129805',
      serviceType: 'Atención Rápida',
      priority: 'Normal',
      status: 'En espera',
      createdAt: isoTimestampMinutesAgo(2),
      startedAt: null,
      completedAt: null,
      assignedUserName: null,
    },
  ];

  const sales: Sale[] = [
    {
      id: 'sale-101',
      receiptNumber: 'B001-000101',
      receiptType: 'Boleta',
      customerId: 'cust-1',
      customerName: 'María Elena Quispe Torres',
      customerDocument: '45821904',
      sellerId: 'usr-seller',
      sellerName: 'Carlos Mendoza',
      items: [
        {
          productId: 'prod-1',
          sku: 'MED-001',
          name: 'Panadol Forte 500mg / 50mg',
          presentation: 'Caja x 20 tabletas',
          quantity: 2,
          unitPrice: 18.5,
          subtotal: 37.0,
          requiresPrescription: false,
        },
        {
          productId: 'prod-7',
          sku: 'MED-007',
          name: 'Omeprazol 20mg',
          presentation: 'Caja x 14 cápsulas',
          quantity: 1,
          unitPrice: 12.0,
          subtotal: 12.0,
          requiresPrescription: false,
        },
      ],
      subtotal: 41.53,
      igv: 7.47,
      discount: 0,
      total: 49.0,
      paymentMethod: 'Yape / Plin',
      amountTendered: 49.0,
      changeDue: 0,
      prescriptionVerified: false,
      queueTicketId: null,
      status: 'Completada',
      createdAt: isoTimestampMinutesAgo(240),
    },
    {
      id: 'sale-102',
      receiptNumber: 'B001-000102',
      receiptType: 'Boleta',
      customerId: 'cust-2',
      customerName: 'Jorge Luis Paredes Vega',
      customerDocument: '72194032',
      sellerId: 'usr-admin',
      sellerName: 'Dra. Rosa Mamani',
      items: [
        {
          productId: 'prod-11',
          sku: 'MED-011',
          name: 'La Roche-Posay Anthelios UVMune 400 FPS 50+',
          presentation: 'Fluido invisible x 50 ml',
          quantity: 1,
          unitPrice: 98.0,
          subtotal: 98.0,
          requiresPrescription: false,
        },
        {
          productId: 'prod-9',
          sku: 'MED-009',
          name: 'Redoxon Triple Acción Vitamina C + Zinc',
          presentation: 'Tubo x 10 comp. efervescentes',
          quantity: 1,
          unitPrice: 24.0,
          subtotal: 24.0,
          requiresPrescription: false,
        },
      ],
      subtotal: 103.39,
      igv: 18.61,
      discount: 0,
      total: 122.0,
      paymentMethod: 'Tarjeta',
      amountTendered: 122.0,
      changeDue: 0,
      prescriptionVerified: false,
      queueTicketId: null,
      status: 'Completada',
      createdAt: isoTimestampMinutesAgo(155),
    },
    {
      id: 'sale-103',
      receiptNumber: 'B001-000103',
      receiptType: 'Boleta',
      customerId: 'cust-3',
      customerName: 'Lucía Fernanda Salazar Ríos',
      customerDocument: '09412875',
      sellerId: 'usr-admin',
      sellerName: 'Dra. Rosa Mamani',
      items: [
        {
          productId: 'prod-15',
          sku: 'MED-015',
          name: 'Losartán Potásico 50mg',
          presentation: 'Caja x 30 tabletas',
          quantity: 2,
          unitPrice: 16.5,
          subtotal: 33.0,
          requiresPrescription: true,
        },
        {
          productId: 'prod-5',
          sku: 'MED-005',
          name: 'Loratadina 10mg',
          presentation: 'Caja x 10 tabletas',
          quantity: 1,
          unitPrice: 7.9,
          subtotal: 7.9,
          requiresPrescription: false,
        },
      ],
      subtotal: 34.66,
      igv: 6.24,
      discount: 0,
      total: 40.9,
      paymentMethod: 'Efectivo',
      amountTendered: 50.0,
      changeDue: 9.1,
      prescriptionVerified: true,
      queueTicketId: null,
      status: 'Completada',
      createdAt: isoTimestampMinutesAgo(82),
    },
    {
      id: 'sale-104',
      receiptNumber: 'F001-000018',
      receiptType: 'Factura',
      customerId: 'cust-4',
      customerName: 'Clínica Dental Sonrisa E.I.R.L.',
      customerDocument: '20548912341',
      sellerId: 'usr-seller',
      sellerName: 'Carlos Mendoza',
      items: [
        {
          productId: 'prod-14',
          sku: 'MED-014',
          name: 'Gasa Estéril Hidrofila 10x10 cm',
          presentation: 'Caja x 10 sobres',
          quantity: 4,
          unitPrice: 12.5,
          subtotal: 50.0,
          requiresPrescription: false,
        },
        {
          productId: 'prod-13',
          sku: 'MED-013',
          name: 'Alcohol Medicinal 70° Alkofarma',
          presentation: 'Frasco x 500 ml',
          quantity: 3,
          unitPrice: 9.8,
          subtotal: 29.4,
          requiresPrescription: false,
        },
      ],
      subtotal: 67.29,
      igv: 12.11,
      discount: 0,
      total: 79.4,
      paymentMethod: 'Tarjeta',
      amountTendered: 79.4,
      changeDue: 0,
      prescriptionVerified: false,
      queueTicketId: null,
      status: 'Completada',
      createdAt: isoTimestampMinutesAgo(35),
    },
  ];

  const restockOrders: RestockOrder[] = [
    {
      id: 'rst-101',
      orderCode: 'OC-2026-0041',
      supplier: 'Droguería Química Suiza S.A.',
      status: 'Pendiente',
      items: [
        {
          productId: 'prod-4',
          sku: 'MED-004',
          productName: 'Azitromicina 500mg',
          requestedQty: 30,
          unitCost: 8.5,
        },
        {
          productId: 'prod-16',
          sku: 'MED-016',
          productName: 'Cetirizina 10mg',
          requestedQty: 35,
          unitCost: 3.8,
        },
      ],
      totalEstimatedCost: 388.0,
      createdBy: 'Dra. Rosa Mamani',
      createdAt: isoTimestampMinutesAgo(190),
      receivedAt: null,
      receivedBy: null,
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-1',
      timestamp: isoTimestampMinutesAgo(245),
      userId: 'usr-admin',
      userName: 'Dra. Rosa Mamani',
      userRole: 'admin',
      action: 'AUTH_LOGIN',
      detail: 'Inicio de sesión verificado para turno mañana en mostrador principal.',
    },
    {
      id: 'aud-2',
      timestamp: isoTimestampMinutesAgo(190),
      userId: 'usr-admin',
      userName: 'Dra. Rosa Mamani',
      userRole: 'admin',
      action: 'RESTOCK_ORDERED',
      detail: 'Orden OC-2026-0041 generada a Droguería Química Suiza S.A. por 2 productos agotados.',
    },
    {
      id: 'aud-3',
      timestamp: isoTimestampMinutesAgo(82),
      userId: 'usr-admin',
      userName: 'Dra. Rosa Mamani',
      userRole: 'admin',
      action: 'SALE_CREATED',
      detail: 'Venta B001-000103 emitida por S/ 40.90 (Receta médica verificada).',
    },
    {
      id: 'aud-4',
      timestamp: isoTimestampMinutesAgo(35),
      userId: 'usr-seller',
      userName: 'Carlos Mendoza',
      userRole: 'seller',
      action: 'SALE_CREATED',
      detail: 'Factura F001-000018 emitida a Clínica Dental Sonrisa E.I.R.L. por S/ 79.40.',
    },
  ];

  return {
    users,
    products,
    customers,
    queue,
    sales,
    restockOrders,
    auditLogs,
    receiptCounter: 104,
    facturaCounter: 18,
    queueCounter: 43,
    restockCounter: 41,
  };
}

class PharmacyStore {
  private state: DatabaseState;

  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        this.state = JSON.parse(raw) as DatabaseState;
      } catch {
        this.state = createInitialState();
        this.persist();
      }
    } else {
      this.state = createInitialState();
      this.persist();
    }
  }

  private persist(): void {
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(this.state, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public getState(): DatabaseState {
    return this.state;
  }

  public save(): void {
    this.persist();
  }

  public addAudit(user: UserProfile, action: AuditActionType, detail: string): void {
    this.state.auditLogs.unshift({
      id: `aud-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      detail,
    });
    if (this.state.auditLogs.length > 250) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 250);
    }
    this.persist();
  }

  public computeAlerts(): InventoryAlert[] {
    const today = new Date();
    const alerts: InventoryAlert[] = [];

    for (const p of this.state.products) {
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
}

export const store = new PharmacyStore();
