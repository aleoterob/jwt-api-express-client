import { cookies } from 'next/headers';

// Extrae el token JWT del header Set-Cookie del backend y lo guarda en las cookies de Next.js
// Esto es necesario porque las Server Actions se ejecutan en el servidor de Next.js,
// no en el navegador. Cuando el backend Express responde con Set-Cookie, Next.js no
// guarda automáticamente esa cookie, por lo que debemos capturarla manualmente y
// almacenarla en el contexto de Next.js para que esté disponible en futuras Server Actions
export async function extractAndSetCookie(setCookieHeader: string) {
  const accessTokenMatch = setCookieHeader.match(/access_token=([^;]+)/);
  if (accessTokenMatch) {
    const cookieStore = await cookies();
    cookieStore.set('access_token', accessTokenMatch[1], {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });
  }
}

// Obtiene el token JWT de las cookies almacenadas en el contexto de Next.js
// Retorna undefined si no existe el token
export async function getAuthToken(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get('access_token')?.value;
}

// Genera los headers HTTP necesarios para hacer requests autenticados al backend
// Incluye el token JWT en el header Cookie si existe
// Las Server Actions necesitan pasar manualmente las cookies porque cuando Next.js
// hace fetch al backend de Express, no tiene acceso automático a las cookies del navegador
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAuthToken();

  if (!token) {
    return {
      'Content-Type': 'application/json',
    };
  }

  return {
    'Content-Type': 'application/json',
    Cookie: `access_token=${token}`,
  };
}

// Valida que existe un token de autenticación en las cookies
// Lanza un error si no hay token (usuario no autenticado)
// Retorna el token si existe
// Útil para proteger Server Actions que requieren autenticación
export async function requireAuth(): Promise<string> {
  const token = await getAuthToken();

  if (!token) {
    throw new Error('No authentication token found');
  }

  return token;
}
