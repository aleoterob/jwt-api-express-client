# Sistema de Refresh Tokens - Cliente (Next.js)

## Resumen

Este cliente Next.js implementa un sistema **transparente** de refresh tokens que renueva automáticamente el access token cuando expira, sin que el usuario se dé cuenta.

## Características Implementadas

### 1. **Gestión Automática de Tokens** (`lib/auth.ts`)

#### Funciones principales:

- `extractAndSetCookies(setCookieHeaders: string[])` - Extrae y guarda ambos tokens del backend
- `getAuthToken()` - Obtiene el access token de las cookies
- `getRefreshToken()` - Obtiene el refresh token de las cookies
- `clearAuthCookies()` - Limpia ambos tokens al cerrar sesión
- **`fetchWithAuth()`** - 🌟 **Función mágica** que maneja refresh automático

**IMPORTANTE:** `extractAndSetCookies()` ahora recibe un **array** de headers, no un string individual.

### 2. **Función `fetchWithAuth()` - El Corazón del Sistema**

Esta función hace que el sistema sea completamente transparente:

```typescript
fetchWithAuth(url, options);
```

**Flujo automático:**

1. Hace el request con el access token actual
2. **Si recibe 401 (Unauthorized)**:
   - Automáticamente llama a `/api/auth/refresh`
   - Obtiene nuevos tokens
   - Actualiza las cookies
   - **Reintenta el request original** con el nuevo token
3. Si el refresh falla → limpia cookies y lanza error
4. El usuario **nunca ve el error 401** si hay refresh token válido

**Ventajas:**

- ✅ Transparente para el usuario
- ✅ No requiere cambios en los componentes
- ✅ Maneja la renovación automáticamente
- ✅ Solo se hace refresh cuando es necesario

### 3. **Server Actions Actualizadas**

#### `login-action.ts`

```typescript
const setCookieHeaders = response.headers.getSetCookie(); // Array!
await extractAndSetCookies(setCookieHeaders);
```

- Guarda **ambos** tokens (access + refresh)
- maxAge de access_token: 15 minutos
- maxAge de refresh_token: 7 días
- **Usa `getSetCookie()`** para obtener TODOS los headers (el backend envía 2)

#### `get-users-stats-action.ts`

```typescript
const response = await fetchWithAuth(url, { method: 'GET' });
```

- Usa `fetchWithAuth` en lugar de `fetch` directo
- Refresh automático si el token expiró

#### `logout-action.ts` (NUEVO)

```typescript
await logout();
```

- Llama al endpoint `/api/auth/logout` del backend
- Limpia ambas cookies del cliente
- Maneja errores gracefully

### 4. **Actualización del Dashboard**

El botón de logout ahora:

- Llama a la Server Action `logout()`
- Espera la respuesta
- Limpia sessionStorage
- Redirige al login

## Ejemplo de Uso

### Para cualquier request autenticado:

```typescript
'use server';

import { fetchWithAuth } from '@/lib/auth';

export async function myProtectedAction() {
  // fetchWithAuth maneja TODA la autenticación y refresh automáticamente
  // NO necesitas llamar requireAuth() antes
  const response = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_API_URL}/api/my-endpoint`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    throw new Error('Request failed');
  }

  return response.json();
}
```

**Nota:** Si el access token expiró (después de 15 minutos de inactividad), `fetchWithAuth()` lo renueva automáticamente usando el refresh token (válido por 7 días).

**⚠️ IMPORTANTE**: NO uses `requireAuth()` cuando uses `fetchWithAuth()`.

- `requireAuth()` verifica el access token (que puede haber expirado)
- Si el access token expiró, `requireAuth()` lanza error ANTES de que `fetchWithAuth()` pueda hacer el refresh
- `fetchWithAuth()` maneja todo el flujo de autenticación y refresh automáticamente

### Si el access token expiró:

```
1. Usuario hace click en "Show users stats"
2. fetchWithAuth intenta GET /api/user/stats
3. Backend responde 401 (token expiró)
4. fetchWithAuth detecta 401:
   a) POST /api/auth/refresh con refresh_token
   b) Guarda nuevos tokens
   c) Reintenta GET /api/user/stats con nuevo access_token
5. Backend responde 200 OK
6. Usuario ve sus estadísticas
```

**El usuario nunca supo que el token expiró!** ✨

## Flujo Completo

### Login

```
User → LoginForm
  ↓
Server Action: login()
  ↓
Backend: POST /api/auth/login
  ↓
Backend envía DOS Set-Cookie headers: access_token (15min), refresh_token (7días)
  ↓
getSetCookie() extrae AMBOS headers
  ↓
extractAndSetCookies() guarda ambos
  ↓
Redirect a /dashboard
```

### Request Protegido (Token Válido)

```
User → Click "Show Stats"
  ↓
Server Action: getUsersStats()
  ↓
fetchWithAuth(url)
  ↓
Backend: GET /api/user/stats
  ↓
Backend responde 200 OK
  ↓
Muestra datos
```

### Request Protegido (Token Expirado)

```
User → Click "Show Stats"
  ↓
Server Action: getUsersStats()
  ↓
fetchWithAuth(url) con access_token expirado
  ↓
Backend: 401 Unauthorized
  ↓
fetchWithAuth detecta 401:
  ├─ POST /api/auth/refresh
  ├─ Backend envía nuevos tokens
  ├─ extractAndSetCookies()
  └─ REINTENTA request original
  ↓
Backend: GET /api/user/stats (con nuevo token)
  ↓
Backend responde 200 OK
  ↓
Muestra datos (usuario no notó nada)
```

### Logout

```
User → Click "Logout"
  ↓
Server Action: logout()
  ↓
Backend: POST /api/auth/logout
  ↓
Backend revoca refresh_token en BD
  ↓
clearAuthCookies() limpia cookies
  ↓
Redirect a login
```

## Seguridad

### HttpOnly Cookies

```typescript
httpOnly: true; // No accesibles desde JavaScript del navegador
secure: process.env.NODE_ENV === 'production'; // Solo HTTPS en producción
sameSite: 'lax'; // Protección CSRF
```

### Manejo de Errores

Si el refresh token también expiró o fue revocado:

1. `fetchWithAuth()` limpia las cookies
2. Lanza error: "Session expired. Please login again."
3. El componente puede redirigir al login

## Ventajas de Esta Implementación

1. ✅ **Transparencia Total** - Usuario nunca se entera de la renovación
2. ✅ **Centralizado** - Toda la lógica en `fetchWithAuth()`
3. ✅ **Automático** - No requiere timers o polling
4. ✅ **Eficiente** - Solo se hace refresh cuando es necesario
5. ✅ **Seguro** - Tokens httpOnly, rotación automática
6. ✅ **DRY** - Reutilizable en todas las Server Actions
7. ✅ **Manejo de Errores** - Limpia estado si el refresh falla

## Migración de Server Actions Existentes

### Antes:

```typescript
const response = await fetch(url, {
  method: 'GET',
  headers: await getAuthHeaders(),
});
```

### Después:

```typescript
const response = await fetchWithAuth(url, {
  method: 'GET',
});
```

**Solo cambia `fetch` por `fetchWithAuth`** y todo el manejo de refresh es automático!

## Testing

### 1. Probar Flujo Normal

- Login
- Click en "Show users stats"
- Debería funcionar inmediatamente

### 2. Probar Refresh Automático

- Login
- Espera 20 minutos (access token expira a los 15 min)
- Click en "Show users stats"
- Debería funcionar sin problemas (refresh automático)

### 3. Probar Session Expirada

- Login
- Espera 7+ días (refresh token expira)
- Click en "Show users stats"
- Debería redirigir al login con mensaje de sesión expirada

## Variables de Entorno

Asegúrate de tener en `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NODE_ENV=development
```

**⚠️ IMPORTANTE**: NO uses comillas alrededor de la URL. Next.js las incluirá en el valor.

❌ **Incorrecto:** `NEXT_PUBLIC_API_URL='http://localhost:3001'`  
✅ **Correcto:** `NEXT_PUBLIC_API_URL=http://localhost:3001`

## Próximos Pasos Opcionales

1. **Interceptor Global**: Crear un hook `useFetch()` para usar en client components
2. **Error Boundary**: Capturar errores de sesión expirada y mostrar modal
3. **Retry Logic**: Agregar reintentos con backoff exponencial
4. **Token Preemptivo**: Renovar token antes de que expire (ej: 30s antes)
5. **Indicador Visual**: Mostrar spinner cuando se hace refresh

## Comparación con Otras Soluciones

### ❌ Solución Manual (Mala)

```typescript
if (response.status === 401) {
  await refreshTokens();
  response = await fetch(url);
}
```

Problema: Hay que repetir esto en CADA request

### ❌ Timer/Polling (Ineficiente)

```typescript
setInterval(() => refreshTokens(), 60000);
```

Problema: Refresh innecesarios, desperdicia recursos

### ✅ `fetchWithAuth()` (Óptima)

- Refresh solo cuando es necesario (401)
- Centralizado y reutilizable
- Transparente para el desarrollador
- Sesiones de hasta 7 días sin reautenticación

## Problemas Comunes y Soluciones

### ❌ "No refresh token available"

**Causa:** El frontend no está guardando el refresh token del backend.

**Solución:**
1. Verifica que uses `getSetCookie()` (NO `get('set-cookie')`)
2. El backend envía DOS headers separados - necesitas capturar ambos
3. Revisa los logs para confirmar que ambos tokens se guardan

### ❌ ".env.local con comillas"

**Causa:** `NEXT_PUBLIC_API_URL='http://localhost:3001'` incluye las comillas en la URL.

**Solución:**
```env
# Incorrecto
NEXT_PUBLIC_API_URL='http://localhost:3001'

# Correcto
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### ❌ "Session expired" inmediatamente

**Causa:** Refresh token expira muy rápido (configurado en minutos en lugar de días).

**Solución:**
Verifica `REFRESH_TOKEN_EXPIRATION_MINUTES` en el backend:
```typescript
// Backend: src/config/constants.ts
export const REFRESH_TOKEN_EXPIRATION_MINUTES = 10080; // 7 días

// Frontend: lib/auth.ts
maxAge: 10080 * 60, // 7 días en segundos
```
