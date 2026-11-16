# Botica Nova Salud — Sistema Web de Gestión de Inventario y Venta

Aplicación web para la gestión centralizada de inventario farmacéutico, punto de venta ágil (POS), alertas automáticas de reposición, cola de atención al cliente y registro de ventas con **Firebase Authentication** y **Cloud Firestore** en tiempo real.

Compatible con despliegue estático en **GitHub Pages** sin necesidad de servidor backend propio.

## Funcionalidades principales

- **Resumen Operativo**: Indicadores diarios de facturación, comprobantes emitidos, alertas de stock, espera promedio en cola y gráfico de ventas por tramo horario.
- **Punto de Venta Rápido (POS)**: Búsqueda por nombre, principio activo, SKU o código de barras; ubicación en anaquel; verificación de receta médica; cálculo de IGV (18%), descuentos y vuelto; emisión de Boleta o Factura imprimible.
- **Atención en Cola y Clientes**: Gestión de turnos en mostrador (`Atención Rápida`, `Receta Médica`, `Consulta Farmacéutica`) con prioridad y pase directo al POS, además de directorio de clientes con registro de alergias.
- **Inventario Centralizado**: Control en tiempo real de stock, lote, fecha de vencimiento y stock mínimo, con ajustes auditados y exportación a CSV.
- **Alertas de Reposición**: Detección automática de productos agotados, con stock bajo o próximos a vencer, generación de órdenes de reposición y confirmación de ingreso a almacén.
- **Registro de Ventas**: Historial de comprobantes, visualización/impresión, exportación a CSV y anulación autorizada con restitución automática de stock.
- **Seguridad y Auditoría**: Inicio de sesión con Google (Firebase Auth), reglas de seguridad Firestore (`firestore.rules`) y bitácora inmutable de auditoría.

## Stack tecnológico

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Vite
- **Backend / Nube**: Firebase Authentication (Google Sign-In) + Cloud Firestore

## Ejecución local

```bash
npm install
npm run dev
```

## Publicación en GitHub Pages

El repositorio incluye el workflow `.github/workflows/deploy.yml`.
1. Sube los cambios a la rama `main` de tu repositorio en GitHub.
2. En GitHub, ve a **Settings → Pages → Build and deployment → Source** y selecciona **GitHub Actions**.
3. En **Firebase Console → Authentication → Settings → Authorized domains**, agrega tu dominio `TU_USUARIO.github.io` para permitir el inicio de sesión con Google desde GitHub Pages.
