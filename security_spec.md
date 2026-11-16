# Security Specification — Botica Nova Salud (Firestore Rules)

## 1. Data Invariants
1. Every document inside `/pharmacies/{pharmacyId}/...` belongs to a single parent `/pharmacies/{pharmacyId}` whose `ownerId` matches `request.auth.uid` (or the bootstrapped admin `jmercadolino002@gmail.com` with `email_verified == true`).
2. User PII (`email`) is strictly isolated in `/users/{userId}/private/{docId}` and never readable by other non-admin users.
3. All document IDs (`pharmacyId`, `productId`, `customerId`, `ticketId`, `saleId`, `orderId`, `logId`) match `^[a-zA-Z0-9_-]+$` and length <= 128.
4. `ownerId`, `pharmacyId`, and `createdAt` are immutable once created (`incoming().field == existing().field`).
5. Temporal integrity: `createdAt == request.time` on create; `updatedAt == request.time` on update.
6. Terminal state locking: `Sale` (`status == 'Anulada'`) and `RestockOrder` (`status == 'Recibida'`) cannot be modified after reaching terminal state except by verified Admin override. `AuditLog` is strictly append-only (no `update` or `delete`).
7. Every `allow list` rule evaluates `resource.data.ownerId == request.auth.uid` (or verified bootstrapped admin email) directly without `get()` or `exists()` lookups.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Unauthenticated read/write**: `get(/pharmacies/nova-salud-central/products/prod-1)` with `auth == null`.
2. **Unverified email spoofing**: `create(/pharmacies/p1)` with `auth.token.email == 'jmercadolino002@gmail.com'` and `email_verified == false`.
3. **Self-assigned admin privilege escalation**: `create(/users/u2/public/profile)` with `role: 'admin'` by non-bootstrapped user.
4. **PII leak across users**: `get(/users/u1/private/info)` by authenticated user `u2`.
5. **Cross-tenant product hijack**: `create(/pharmacies/p1/products/prod-x)` by `u2` where `p1.ownerId == u1`.
6. **Shadow/ghost field injection**: `create(/pharmacies/u1/products/prod-x)` containing extra field `isFree: true`.
7. **ID poisoning (Denial of Wallet)**: `create(/pharmacies/u1/products/<1500-char-id>)` or invalid characters `../bad`.
8. **Negative stock / negative price**: `create(/pharmacies/u1/products/prod-x)` with `stock: -5` or `salePrice: -1`.
9. **Client-forged timestamp**: `create(/pharmacies/u1/sales/sale-x)` with `createdAt` != `request.time`.
10. **Immutable field tampering**: `update(/pharmacies/u1/products/prod-1)` attempting to change `ownerId` or `createdAt`.
11. **Terminal state bypass**: `update(/pharmacies/u1/restockOrders/rst-1)` when `existing.status == 'Recibida'` attempting to revert to `'Pendiente'` as non-admin.
12. **Audit log tampering**: `update` or `delete` on `/pharmacies/u1/auditLogs/aud-1`.
