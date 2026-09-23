import { describe, expect, it } from 'vitest';

import { navigationItems } from './navigation';

describe('site navigation', () => {
  it('uses a compact sign-in call to action that links to the auth panel', () => {
    expect(navigationItems).toContainEqual({
      label: 'Sign in',
      href: '#member-auth',
    });
  });

  it('does not use the long member signup label that crowds the sticky nav', () => {
    expect(navigationItems.map((item) => item.label)).not.toContain('Members sign in / new members sign up');
  });

  it('includes the community message board anchor from the original site flow', () => {
    expect(navigationItems).toContainEqual({
      label: 'Community',
      href: '#community',
    });
  });
});
