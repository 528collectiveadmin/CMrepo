import { useEffect, useState } from 'react';

import { AdminDashboard } from './AdminDashboard';
import { LocalMemberSession } from '../lib/memberAuth';
import { AdminProfileClientLike, checkAdminAccess } from '../lib/adminAuth';
import { memberDashboardCopy } from '../lib/memberDashboardCopy';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { SupabaseMemberSession } from '../lib/supabaseAuth';
import { ProfileSettingsEditor } from './ProfileSettingsEditor';

export type MemberDashboardSession = LocalMemberSession | SupabaseMemberSession;

type ProtectedMemberDashboardProps = {
  session: MemberDashboardSession;
  onSignOut: () => void;
};

function getSessionLabel(session: MemberDashboardSession): string {
  if (session.source === 'supabase-auth') {
    return 'Member session';
  }

  return session.source === 'signup-preview' ? 'Signup session' : 'Login session';
}

function getProtectionNote(session: MemberDashboardSession): string {
  if (session.source === 'supabase-auth') {
    return 'Profile and member data remain protected.';
  }

  return 'Member features are available after sign-in.';
}

const dashboardItems = [
  {
    title: 'Music downloads',
    description: 'Member-only music downloads appear here.',
  },
  {
    title: 'ManifestWave check-in',
    description: 'Your participation stays connected to your member account.',
  },
];

export function ProtectedMemberDashboard({ session, onSignOut }: ProtectedMemberDashboardProps) {
  const [adminStatus, setAdminStatus] = useState<
    | { state: 'checking' }
    | { state: 'ready'; isAdmin: boolean; username: string | null }
    | { state: 'error'; message: string }
  >({ state: 'checking' });

  useEffect(() => {
    let isMounted = true;

    async function loadAdminStatus() {
      if (!isSupabaseConfigured || session.source !== 'supabase-auth') {
        setAdminStatus({ state: 'ready', isAdmin: false, username: null });
        return;
      }

      const result = await checkAdminAccess(supabase as AdminProfileClientLike | null, session.id);
      if (!isMounted) {
        return;
      }

      if (result.ok) {
        setAdminStatus({
          state: 'ready',
          isAdmin: result.isAdmin,
          username: result.profile?.username || null,
        });
      } else {
        setAdminStatus({ state: 'error', message: result.error });
      }
    }

    void loadAdminStatus();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const effectiveRole = adminStatus.state === 'ready' && adminStatus.isAdmin ? 'admin' : session.role;

  return (
    <section className="protected-dashboard" aria-label="Protected member dashboard">
      <div className="dashboard-header">
        <div>
          <span>Member dashboard</span>
          <h3>Welcome, {session.username}</h3>
          <p>{session.email}</p>
        </div>
        <button className="button secondary" onClick={onSignOut} type="button">
          {memberDashboardCopy.signOutButton}
        </button>
      </div>

      <div className="dashboard-meta" aria-label="Local session details">
        <span>Role: {effectiveRole}</span>
        <span>{getSessionLabel(session)}</span>
        <span>
          Admin: {adminStatus.state === 'checking' ? 'checking' : adminStatus.state === 'ready' && adminStatus.isAdmin ? 'enabled' : 'off'}
        </span>
      </div>

      <ProfileSettingsEditor session={session} />

      {adminStatus.state === 'ready' && adminStatus.isAdmin ? (
        <AdminDashboard username={adminStatus.username || session.username} />
      ) : null}

      {adminStatus.state === 'error' ? <p className="dashboard-note">Admin check failed: {adminStatus.message}</p> : null}

      <div className="dashboard-grid">
        {dashboardItems.map((item) => (
          <article key={item.title}>
            <h4>{item.title}</h4>
            <p>{item.description}</p>
          </article>
        ))}
      </div>

      <p className="dashboard-note">
        {getProtectionNote(session)}
      </p>

      <div className="dashboard-footer-actions" aria-label="Member dashboard actions">
        <button className="button secondary" onClick={onSignOut} type="button">
          {memberDashboardCopy.signOutButton}
        </button>
      </div>
    </section>
  );
}
