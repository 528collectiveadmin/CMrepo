import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProtectedMemberDashboard } from './ProtectedMemberDashboard';
import { SupabaseMemberSession } from '../lib/supabaseAuth';

const adminSession: SupabaseMemberSession = {
  id: 'user-123',
  username: 'rick_admin',
  email: 'cmadmin528@gmail.com',
  country: 'United States',
  role: 'member',
  source: 'supabase-auth',
  startedAt: '2026-09-25T00:00:00.000Z',
};

describe('ProtectedMemberDashboard sign-out access', () => {
  it('renders sign-out actions at the top and bottom of the dashboard', () => {
    const html = renderToStaticMarkup(
      createElement(ProtectedMemberDashboard, {
        session: adminSession,
        onSignOut: () => undefined,
      }),
    );

    expect(html.match(/Sign out/g) || []).toHaveLength(2);
    expect(html).toContain('dashboard-footer-actions');
  });
});
