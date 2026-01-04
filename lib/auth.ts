import { cookies } from 'next/headers';

// Extrae AMBOS tokens (access y refresh) del header Set-Cookie del backend y los guarda en las cookies de Next.js
// Esto es necesario porque las Server Actions se ejecutan en el servidor de Next.js,
// no en el navegador. Cuando el backend Express responde con Set-Cookie, Next.js no
// guarda automáticamente esas cookies, por lo que debemos capturarlas manualmente y
// almacenarlas en el contexto de Next.js para que estén disponibles en futuras Server Actions
// El access_token tiene una expiración corta (2 minutos) y el refresh_token dura 7 días
export async function extractAndSetCookies(setCookieHeader: string) {
  // Obtiene el store de cookies de Next.js para poder manipularlas
  const cookieStore = await cookies();

  // Extrae el access token del header Set-Cookie usando regex
  const accessTokenMatch = setCookieHeader.match(/access_token=([^;]+)/);
  if (accessTokenMatch) {
    // Guarda el access token con configuración segura y expiración de 2 minutos
    cookieStore.set('access_token', accessTokenMatch[1], {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 2 * 60,
    });
  }

  // Extrae el refresh token del header Set-Cookie usando regex
  const refreshTokenMatch = setCookieHeader.match(/refresh_token=([^;]+)/);
  if (refreshTokenMatch) {
    // Guarda el refresh token con configuración segura y expiración de 7 días
    cookieStore.set('refresh_token', refreshTokenMatch[1], {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }
}

// Obtiene el access token (JWT) de las cookies almacenadas en el contexto de Next.js
// Retorna undefined si no existe el token
// Este token tiene una duración corta (2 minutos) para mayor seguridad
export async function getAuthToken(): Promise<string | undefined> {
  // Obtiene el store de cookies de Next.js
  const cookieStore = await cookies();
  // Retorna el valor del access token (undefined si no existe)
  return cookieStore.get('access_token')?.value;
}

// Obtiene el refresh token de las cookies almacenadas en el contexto de Next.js
// Retorna undefined si no existe el token
// Este token tiene una duración larga (7 días) y se usa para renovar el access token cuando expira
export async function getRefreshToken(): Promise<string | undefined> {
  // Obtiene el store de cookies de Next.js
  const cookieStore = await cookies();
  // Retorna el valor del refresh token (undefined si no existe)
  return cookieStore.get('refresh_token')?.value;
}

// Genera los headers HTTP necesarios para hacer requests autenticados al backend
// Incluye AMBOS tokens (access y refresh) en el header Cookie si existen
// Las Server Actions necesitan pasar manualmente las cookies porque cuando Next.js
// hace fetch al backend de Express, no tiene acceso automático a las cookies del navegador
export async function getAuthHeaders(): Promise<Record<string, string>> {
  // Obtiene el access token de las cookies (puede ser undefined)
  const accessToken = await getAuthToken();
  // Obtiene el refresh token de las cookies (puede ser undefined)
  const refreshToken = await getRefreshToken();

  // Array para construir el header Cookie con ambos tokens
  const cookieHeader = [];
  if (accessToken) cookieHeader.push(`access_token=${accessToken}`);
  if (refreshToken) cookieHeader.push(`refresh_token=${refreshToken}`);

  // Retorna headers con Content-Type y Cookie (si hay tokens)
  return {
    'Content-Type': 'application/json',
    ...(cookieHeader.length > 0 && { Cookie: cookieHeader.join('; ') }),
  };
}

// Valida que existe un access token de autenticación en las cookies
// Lanza un error si no hay token (usuario no autenticado)
// Retorna el token si existe
// Útil para proteger Server Actions que requieren autenticación
export async function requireAuth(): Promise<string> {
  // Intenta obtener el access token de las cookies
  const token = await getAuthToken();

  // Si no hay token, lanza error indicando que el usuario no está autenticado
  if (!token) {
    throw new Error('No authentication token found');
  }

  // Retorna el token si existe
  return token;
}

// Elimina ambos tokens (access y refresh) de las cookies de Next.js
// Se usa al cerrar sesión para limpiar completamente el estado de autenticación
// Esto previene que tokens antiguos queden en el navegador después del logout
export async function clearAuthCookies(): Promise<void> {
  // Obtiene el store de cookies de Next.js
  const cookieStore = await cookies();
  // Elimina el access token
  cookieStore.delete('access_token');
  // Elimina el refresh token
  cookieStore.delete('refresh_token');
}

// Opciones extendidas para fetchWithAuth
// skipRefresh: permite desactivar el refresh automático para casos especiales
interface FetchWithAuthOptions extends RequestInit {
  skipRefresh?: boolean;
}

// 🌟 FUNCIÓN MÁGICA que hace fetch autenticado con refresh automático TRANSPARENTE
// Esta es la clave del sistema: si el access token expiró (401), automáticamente:
// 1. Usa el refresh token para obtener nuevos tokens del backend
// 2. Guarda los nuevos tokens en cookies
// 3. REINTENTA el request original con el nuevo access token
// El usuario NUNCA se da cuenta de que el token expiró - experiencia totalmente transparente
//
// Uso: Simplemente reemplaza fetch() por fetchWithAuth() en tus Server Actions
// Ejemplo: const response = await fetchWithAuth('/api/user/stats', { method: 'GET' })
//
// Si el refresh token también expiró o es inválido:
// - Limpia todas las cookies
// - Lanza error "Session expired. Please login again."
// - El componente puede redirigir al login
export async function fetchWithAuth(
  url: string,
  options: FetchWithAuthOptions = {}
): Promise<Response> {
  // Extrae skipRefresh de las opciones y mantiene el resto en fetchOptions
  const { skipRefresh, ...fetchOptions } = options;

  // Obtiene los headers con ambos tokens (access y refresh)
  const headers = await getAuthHeaders();

  // Hace el request inicial con los tokens actuales
  const response = await fetch(url, {
    ...fetchOptions,
    headers: {
      ...headers,
      ...fetchOptions.headers,
    },
  });

  // Si recibe 401 (Unauthorized) y el refresh automático está habilitado
  if (response.status === 401 && !skipRefresh) {
    // Obtiene el refresh token para renovar la sesión
    const refreshToken = await getRefreshToken();

    // Si no hay refresh token, no se puede renovar la sesión
    if (!refreshToken) {
      throw new Error('Unauthorized: No refresh token available');
    }

    try {
      // Llama al endpoint de refresh para obtener nuevos tokens
      const refreshResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `refresh_token=${refreshToken}`,
          },
        }
      );

      // Si el refresh falló (refresh token expirado/inválido), limpia cookies y lanza error
      if (!refreshResponse.ok) {
        await clearAuthCookies();
        throw new Error('Session expired. Please login again.');
      }

      // Extrae los nuevos tokens del header Set-Cookie de la respuesta
      const setCookieHeader = refreshResponse.headers.get('set-cookie');
      if (setCookieHeader) {
        // Guarda los nuevos tokens en las cookies de Next.js
        await extractAndSetCookies(setCookieHeader);
      }

      // Obtiene los headers actualizados con los nuevos tokens
      const newHeaders = await getAuthHeaders();
      // REINTENTA el request original con los nuevos tokens
      const retryResponse = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...newHeaders,
          ...fetchOptions.headers,
        },
      });

      // Retorna la respuesta del retry (el usuario nunca supo que el token expiró)
      return retryResponse;
    } catch (error) {
      // Si algo falló en el proceso de refresh, limpia las cookies
      await clearAuthCookies();
      throw error;
    }
  }

  // Retorna la respuesta original si no hubo 401 o si skipRefresh está activo
  return response;
}
