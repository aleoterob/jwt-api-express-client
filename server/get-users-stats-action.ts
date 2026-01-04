'use server';

import { requireAuth, getAuthHeaders } from '@/lib/auth';

export async function getUsersStats() {
  await requireAuth();

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/user/stats`,
    {
      method: 'GET',
      headers: await getAuthHeaders(),
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
