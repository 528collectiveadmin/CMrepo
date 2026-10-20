import { FormEvent, useEffect, useState } from 'react';

import {
  LocalMemberSession,
  LoginErrors,
  LoginForm,
  SignupErrors,
  SignupForm,
  createLocalMemberSession,
  createLocalLoginPayload,
  createLocalSignupPayload,
  initialLoginForm,
  initialSignupForm,
  validateLoginForm,
  validateSignupForm,
} from '../lib/memberAuth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  SupabaseMemberSession,
  getSupabaseMemberSession,
  signInMemberWithSupabase,
  signOutMemberWithSupabase,
  signUpMemberWithSupabase,
} from '../lib/supabaseAuth';
import { ProtectedMemberDashboard } from './ProtectedMemberDashboard';

type AuthMode = 'signup' | 'login';

export function MemberAuthPanel() {
  const [mode, setMode] = useState<AuthMode>('signup');
  const [signupForm, setSignupForm] = useState<SignupForm>(initialSignupForm);
  const [loginForm, setLoginForm] = useState<LoginForm>(initialLoginForm);
  const [signupErrors, setSignupErrors] = useState<SignupErrors>({});
  const [loginErrors, setLoginErrors] = useState<LoginErrors>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [memberSession, setMemberSession] = useState<LocalMemberSession | SupabaseMemberSession | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadExistingSession() {
      if (!isSupabaseConfigured) {
        return;
      }

      const result = await getSupabaseMemberSession(supabase);
      if (!isMounted) {
        return;
      }

      if (result.ok && result.session) {
        setMemberSession(result.session);
        setStatusMessage('Member session restored.');
      } else if (!result.ok) {
        setStatusMessage(result.error);
      }
    }

    void loadExistingSession();

    return () => {
      isMounted = false;
    };
  }, []);

  function updateSignup<Field extends keyof SignupForm>(field: Field, value: SignupForm[Field]) {
    setSignupForm((current) => ({ ...current, [field]: value }));
    setSignupErrors((current) => ({ ...current, [field]: undefined }));
    setStatusMessage('');
  }

  function updateLogin<Field extends keyof LoginForm>(field: Field, value: LoginForm[Field]) {
    setLoginForm((current) => ({ ...current, [field]: value }));
    setLoginErrors((current) => ({ ...current, [field]: undefined }));
    setStatusMessage('');
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateSignupForm(signupForm);
    setSignupErrors(validation.errors);

    if (!validation.isValid) {
      setStatusMessage('Please fix the highlighted signup fields.');
      return;
    }

    if (isSupabaseConfigured) {
      const result = await signUpMemberWithSupabase(supabase, signupForm, `${window.location.origin}/`);
      if (result.ok && result.needsEmailConfirmation) {
        setSignupForm(initialSignupForm);
        setLoginForm((current) => ({ ...current, email: result.email }));
        setMode('login');
        setStatusMessage(
          `Almost there! We sent a confirmation link to ${result.email}. Click it to finish setting up your account. If you don't see it, check your spam folder.`,
        );
      } else if (result.ok) {
        setMemberSession(result.session);
        setStatusMessage('Account created and member dashboard opened.');
      } else {
        setStatusMessage(result.error);
      }
      return;
    }

    const payload = createLocalSignupPayload(signupForm);
    console.info('Local-only member signup preview payload:', payload);
    setMemberSession(createLocalMemberSession(payload));
    setStatusMessage('Account created and member dashboard opened.');
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateLoginForm(loginForm);
    setLoginErrors(validation.errors);

    if (!validation.isValid) {
      setStatusMessage('Please fix the highlighted login fields.');
      return;
    }

    if (isSupabaseConfigured) {
      const result = await signInMemberWithSupabase(supabase, loginForm);
      if (result.ok) {
        setMemberSession(result.session);
        setStatusMessage('Signed in and member dashboard opened.');
      } else {
        setStatusMessage(result.error);
      }
      return;
    }

    const payload = createLocalLoginPayload(loginForm);
    console.info('Local-only member login preview payload:', payload);
    setMemberSession(createLocalMemberSession(payload));
    setStatusMessage('Signed in and member dashboard opened.');
  }

  async function handleSignOutPreview() {
    if (memberSession?.source === 'supabase-auth') {
      const result = await signOutMemberWithSupabase(supabase);
      if (!result.ok) {
        setStatusMessage(result.error);
        return;
      }
    }

    setMemberSession(null);
    setStatusMessage(
      isSupabaseConfigured ? 'Signed out.' : 'Signed out of the member dashboard.',
    );
  }

  return (
    <div className="member-auth-card">
      <div className="auth-tabs" aria-label="Member auth mode">
        <span className="auth-mode-pill">Member access</span>
        <button
          className={mode === 'signup' ? 'is-active' : ''}
          onClick={() => {
            setMode('signup');
            setStatusMessage('');
          }}
          type="button"
        >
          Sign up
        </button>
        <button
          className={mode === 'login' ? 'is-active' : ''}
          onClick={() => {
            setMode('login');
            setStatusMessage('');
          }}
          type="button"
        >
          Log in
        </button>
      </div>

      {memberSession ? (
        <ProtectedMemberDashboard session={memberSession} onSignOut={handleSignOutPreview} />
      ) : mode === 'signup' ? (
        <form className="auth-form" onSubmit={handleSignup} noValidate>
          <label>
            <span>Username</span>
            <input
              autoComplete="username"
              name="signup-username"
              onChange={(event) => updateSignup('username', event.target.value)}
              placeholder="manifest_member"
              type="text"
              value={signupForm.username}
            />
            {signupErrors.username ? <small className="field-error">{signupErrors.username}</small> : null}
          </label>

          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              name="signup-email"
              onChange={(event) => updateSignup('email', event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={signupForm.email}
            />
            {signupErrors.email ? <small className="field-error">{signupErrors.email}</small> : null}
          </label>

          <label>
            <span>Country</span>
            <input
              autoComplete="country-name"
              name="signup-country"
              onChange={(event) => updateSignup('country', event.target.value)}
              placeholder="United States"
              type="text"
              value={signupForm.country}
            />
            {signupErrors.country ? <small className="field-error">{signupErrors.country}</small> : null}
          </label>

          <div className="form-grid">
            <label>
              <span>Password</span>
              <input
                autoComplete="new-password"
                name="signup-password"
                onChange={(event) => updateSignup('password', event.target.value)}
                placeholder="8+ letters/numbers"
                type="password"
                value={signupForm.password}
              />
              {signupErrors.password ? <small className="field-error">{signupErrors.password}</small> : null}
            </label>
            <label>
              <span>Confirm password</span>
              <input
                autoComplete="new-password"
                name="signup-confirm-password"
                onChange={(event) => updateSignup('confirmPassword', event.target.value)}
                placeholder="Repeat password"
                type="password"
                value={signupForm.confirmPassword}
              />
              {signupErrors.confirmPassword ? (
                <small className="field-error">{signupErrors.confirmPassword}</small>
              ) : null}
            </label>
          </div>

          <button className="button primary" type="submit">
            Create account
          </button>
        </form>
      ) : (
        <form className="auth-form" onSubmit={handleLogin} noValidate>
          <label>
            <span>Email</span>
            <input
              autoComplete="email"
              name="login-email"
              onChange={(event) => updateLogin('email', event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={loginForm.email}
            />
            {loginErrors.email ? <small className="field-error">{loginErrors.email}</small> : null}
          </label>

          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="login-password"
              onChange={(event) => updateLogin('password', event.target.value)}
              placeholder="Your password"
              type="password"
              value={loginForm.password}
            />
            {loginErrors.password ? <small className="field-error">{loginErrors.password}</small> : null}
          </label>

          <button className="button primary" type="submit">
            Log in
          </button>
        </form>
      )}

      {statusMessage ? <p className="auth-status">{statusMessage}</p> : null}
    </div>
  );
}
