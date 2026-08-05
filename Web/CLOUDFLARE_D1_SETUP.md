# Guía de Configuración de Base de Datos Cloudflare D1 (SQL)

Para evitar la pérdida de datos cuando despliegas tu aplicación en **Cloudflare Pages** o **Cloudflare Workers**, debes usar **Cloudflare D1** (la base de datos SQL integrada en Cloudflare).

---

## 🚀 Pasos para Vincular Cloudflare D1

### 1️⃣ Crear la Base de Datos en Cloudflare
Ejecuta en tu terminal local con Wrangler o entra al panel de Cloudflare:
```bash
npx wrangler d1 create multiverso_db
```
Copia el `database_id` que te devuelve la consola y pégalo en el archivo `wrangler.toml` de este proyecto:

```toml
[[d1_databases]]
binding = "DB"
database_name = "multiverso_db"
database_id = "TU_DATABASE_ID_AQUÍ"
```

---

## 2️⃣ Cargar el Esquema y los Datos en Cloudflare D1

### Opción A: Desde la Consola de Comandos (Recomendado)
Ejecuta este comando para crear las tablas e insertar todos tus usuarios y datos de la wiki actuales:

```bash
npx wrangler d1 execute multiverso_db --file=schema.sql
```

### Opción B: Copiar y Pegar en el Dashboard de Cloudflare
1. Entra a **Cloudflare Console** > **Workers & Pages** > **D1**.
2. Selecciona tu base de datos `multiverso_db` y abre la pestaña **Console / SQL**.
3. Abre la ruta `/api/export-d1` en tu navegador web o copia el contenido del archivo `schema.sql`.
4. Pégalo en la consola de Cloudflare y haz clic en **Execute**.

---

## 3️⃣ Exportar Datos Actualizados en Cualquier Momento

Cada vez que agregues nuevos usuarios o artículos desde la aplicación y quieras generar una copia de seguridad en SQL lista para Cloudflare D1, solo abre en tu navegador:

👉 **`http://tu-dominio/api/export-d1`**

Te generará un script SQL con todas las sentencias `INSERT OR REPLACE` de tus usuarios y artículos actuales.
