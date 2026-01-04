'use server';

import { extractAndSetCookies } from '@/lib/auth';

export async function login(email: string, password: string) {
  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message || `Login failed: ${response.statusText}`
    );
  }

  const setCookieHeader = response.headers.get('set-cookie');
  if (setCookieHeader) {
    await extractAndSetCookies(setCookieHeader);
  }

  return response.json();
}
