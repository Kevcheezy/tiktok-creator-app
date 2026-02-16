import { createClient } from '@/lib/supabase/server';
import { AppShellClient } from './app-shell-client';

export async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Skip shell for unauthenticated pages (login, auth callbacks)
  if (!user) {
    return <>{children}</>;
  }

  return (
    <AppShellClient user={{ email: user.email ?? '' }}>
      {children}
    </AppShellClient>
  );
}
