'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverAnchor,
} from '@/components/ui/popover';
import { getUsersStats } from '@/server/get-users-stats-action';

interface UserData {
  id: string;
  email: string;
  role: string | null;
}

interface ProfileData {
  id: string;
  full_name: string | null;
  email: string | null;
  bio: string | null;
  avatar_url: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface LoginResponse {
  success: boolean;
  data: {
    user: UserData;
    profile: ProfileData;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [loginData, setLoginData] = useState<LoginResponse | null>(() => {
    if (typeof window === 'undefined') return null;
    const storedData = sessionStorage.getItem('loginData');
    if (storedData) {
      try {
        return JSON.parse(storedData);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [stats, setStats] = useState<unknown>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState<string | null>(null);

  useEffect(() => {
    if (!loginData) {
      router.push('/');
    }
  }, [loginData, router]);

  const handleLogout = () => {
    sessionStorage.removeItem('loginData');
    router.push('/');
  };

  const handleShowStats = async () => {
    setIsLoadingStats(true);
    setStatsError(null);
    try {
      const data = await getUsersStats();
      setStats(data);
      setIsStatsOpen(true);
    } catch (err) {
      setStatsError(
        err instanceof Error ? err.message : 'Failed to fetch stats'
      );
      setIsStatsOpen(true);
    } finally {
      setIsLoadingStats(false);
    }
  };

  if (!loginData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  const { user, profile } = loginData.data;

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black p-4">
      {isStatsOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setIsStatsOpen(false)}
        />
      )}
      <div className="w-full max-w-4xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <Button onClick={handleLogout} variant="outline">
            Logout
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>Account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">ID</p>
                <p className="text-sm font-mono">{user.id}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <p className="text-sm">{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Role
                </p>
                <p className="text-sm">{user.role || 'Not assigned'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>User profile details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Full Name
                </p>
                <p className="text-sm">{profile.full_name || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <p className="text-sm">{profile.email || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bio</p>
                <p className="text-sm">{profile.bio || 'Not set'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                <p className="text-sm">{profile.status || 'Not set'}</p>
              </div>
              {profile.avatar_url && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Avatar URL
                  </p>
                  <p className="text-sm break-all">{profile.avatar_url}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Timestamps</CardTitle>
              <CardDescription>
                Account creation and update dates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Created At
                </p>
                <p className="text-sm">
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleString()
                    : 'Not available'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Updated At
                </p>
                <p className="text-sm">
                  {profile.updated_at
                    ? new Date(profile.updated_at).toLocaleString()
                    : 'Not available'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Raw Response Data</CardTitle>
            <CardDescription>Complete login response</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
              {JSON.stringify(loginData, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <Popover open={isStatsOpen} onOpenChange={setIsStatsOpen}>
          <PopoverTrigger asChild>
            <Button onClick={handleShowStats} disabled={isLoadingStats}>
              {isLoadingStats ? 'Loading...' : 'Show users stats'}
            </Button>
          </PopoverTrigger>
          <PopoverAnchor asChild>
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
          </PopoverAnchor>
          <PopoverContent
            className="w-[90vw] max-w-2xl max-h-[80vh] overflow-auto z-50"
            align="center"
            side="top"
            sideOffset={0}
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Users Stats</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsStatsOpen(false)}
                >
                  ×
                </Button>
              </div>
              {statsError ? (
                <div className="text-destructive">{statsError}</div>
              ) : (
                <pre className="bg-muted p-4 rounded-md overflow-auto text-xs">
                  {JSON.stringify(stats, null, 2)}
                </pre>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
