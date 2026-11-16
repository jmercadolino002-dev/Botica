# Botica Nova Salud — Sistema Web de Gestión de Inventario y Venta

Aplicación web full-stack para la gestión centralizada de inventario farmacéutico, punto de venta ágil (POS), alertas automáticas de reposición, cola de atención al cliente y registro de ventas con trazabilidad y control de acceso por roles.

## Funcionalidades principales

- **Resumen Operativo**: Indicadores diarios de facturación, comprobantes emitidos, alertas de stock, espera promedio en cola y gráfico de ventas por tramo horario.
- **Punto de Venta Rápido (POS)**: Búsqueda por nombre, principio activo, SKU o código de barras; ubicación en anaquel; verificación de receta médica; cálculo de IGV (18%), descuentos y vuelto; emisión de Boleta o Factura imprimible.
- **Atención en Cola y Clientes**: Gestión de turnos en mostrador (`Atención Rápida`, `Receta Médica`, `Consulta Farmacéutica`) con prioridad y pase directo al POS, además de directorio de clientes con registro de alergias.
- **Inventario Centralizado**: Control en tiempo real de stock, lote, fecha de vencimiento y stock mínimo, con ajustes auditados y exportación a CSV.
- **Alertas de Reposición**: Detección automática de productos agotados, con stock bajo o próximos a vencer, generación de órdenes de reposición y confirmación de ingreso a almacén.
- **Registro de Ventas**: Historial de comprobantes, visualización/impresión, exportación a CSV y anulación autorizada con restitución automática de stock.
- **Seguridad y Auditoría**: Contraseñas cifradas con `scrypt`, tokens de sesión firmados con `HMAC-SHA256`, control de acceso por roles (`Química Farmacéutica` / `Técnico en Farmacia`) y bitácora de auditoría.

## Stack tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons
- **Backend**: Node.js, Express 4, TSX
- **Persistencia**: Archivo transaccional local en `data/novasalud-db.json` (autogenerado con datos iniciales al arrancar)

## Instalación y ejecución local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. (Opcional) Configurar variables de entorno copiando `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

3. Ejecutar en modo desarrollo (servidor Express + Vite):
   ```bash
   npm run dev
   ```
   Abrir en el navegador: `http://localhost:3000`

4. Compilar y ejecutar en producción:
   ```bash
   npm run build
   npm start
   ```

## Cuentas de acceso (demo)

- **Química Farmacéutica (Admin)**: `admin@novasalud.pe` / `NovaAdmin2026!`
- **Técnico en Farmacia (Vendedor)**: `ventas@novasalud.pe` / `NovaVentas2026!`
