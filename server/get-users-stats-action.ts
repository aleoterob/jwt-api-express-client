'use server';

import { fetchWithAuth } from '@/lib/auth';

export async function getUsersStats() {
  const response = await fetchWithAuth(
    `${process.env.NEXT_PUBLIC_API_URL}/api/user/stats`,
    {
      method: 'GET',
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.error?.message ||
        `Failed to fetch stats: ${response.statusText}`
    );
  }

  return response.json();
}
