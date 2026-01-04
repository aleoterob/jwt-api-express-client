'use server';

import { clearAuthCookies, getRefreshToken } from '@/lib/auth';

export async function logout() {
  const refreshToken = await getRefreshToken();

  if (refreshToken) {
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: `refresh_token=${refreshToken}`,
        },
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
  }

  await clearAuthCookies();
}
