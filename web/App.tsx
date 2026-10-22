import { useEffect, useState } from 'react';
import { RefreshCwIcon, ServerCrashIcon } from 'lucide-react';
import type { MeResponse } from '../shared/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { loadMe, logout } from './apiClient';
import { LoginPage } from './Auth/LoginPage';
import { AppHeader } from './Layout/AppHeader';
import { AdminBoard } from './PrintRequest/AdminBoard';
import { MyRequests } from './PrintRequest/MyRequests';

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; me: MeResponse | null };

export function App() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    loadMe()
      .then((me) => setState({ kind: 'ready', me }))
      .catch(() => setState({ kind: 'error' }));
  }, []);

  if (state.kind === 'loading') return <AppSkeleton />;
  if (state.kind === 'error') return <ServerError />;
  if (state.me === null) return <LoginPage onLoggedIn={(me) => setState({ kind: 'ready', me })} />;

  const me = state.me;
  const handleLogout = async () => {
    await logout().catch(() => undefined);
    setState({ kind: 'ready', me: null });
  };

  return (
    <div className="min-h-svh bg-muted/30">
      <AppHeader me={me} onLogout={handleLogout} />
      <main className={me.role === 'admin' ? 'mx-auto max-w-7xl p-4 sm:p-6' : 'mx-auto max-w-2xl p-4 sm:p-6'}>
        {me.role === 'admin' ? <AdminBoard /> : <MyRequests />}
      </main>
    </div>
  );
}

function AppSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

function ServerError() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <ServerCrashIcon className="size-10 text-muted-foreground" />
      <div>
        <p className="font-medium">Server nicht erreichbar</p>
        <p className="text-sm text-muted-foreground">Bitte in einem Moment erneut versuchen.</p>
      </div>
      <Button variant="outline" onClick={() => window.location.reload()}>
        <RefreshCwIcon /> Neu laden
      </Button>
    </div>
  );
}
