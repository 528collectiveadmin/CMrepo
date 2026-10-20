import {
  LoginForm,
  SignupForm,
  normalizeCountry,
  normalizeEmail,
  normalizeUsername,
  validateLoginForm,
  validateSignupForm,
} from './memberAuth';

type SupabaseError = {
  message: string;
};

type SupabaseUserLike = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

type SupabaseSessionLike = {
  user: SupabaseUserLike;
};

type SupabaseAuthClientLike = {
  auth: {
    signUp(payload: {
      email: string;
      password: string;
      options: { data: { username: string; country: string }; emailRedirectTo?: string };
    }): PromiseLike<{
      data: { user: SupabaseUserLike | null; session?: SupabaseSessionLike | null };
      error: SupabaseError | null;
    }>;
    signInWithPassword(payload: {
      email: string;
      password: string;
    }): PromiseLike<{ data: { session: SupabaseSessionLike | null }; error: SupabaseError | null }>;
    signOut(): PromiseLike<{ error: SupabaseError | null }>;
    getSession(): PromiseLike<{ data: { session: SupabaseSessionLike | null }; error: SupabaseError | null }>;
  };
  from(table: string): {
    insert(rows: ProfileInsert[]): PromiseLike<{ error: SupabaseError | null }>;
  };
};

type ProfileInsert = {
  id: string;
  username: string;
  display_name: string;
  role: 'member';
};

export type SupabaseMemberSession = {
  id: string;
  username: string;
  email: string;
  country: string;
  role: 'member';
  source: 'supabase-auth';
  startedAt: string;
};

export type SupabaseAuthResult<T extends object | undefined = undefined> = T extends undefined
  ? { ok: true } | { ok: false; error: string }
  : ({ ok: true } & T) | { ok: false; error: string };

export type MemberAuthRuntimeCopy = {
  modeLabel: 'Local preview mode' | 'Supabase Auth mode';
  idleStatus: string;
  signupButton: string;
  loginButton: string;
};

const notConfiguredResult = { ok: false, error: 'Supabase is not configured yet.' } as const;

export function getMemberAuthRuntimeCopy(isConfigured: boolean): MemberAuthRuntimeCopy {
  if (isConfigured) {
    return {
      modeLabel: 'Supabase Auth mode',
      idleStatus: 'Supabase Auth is configured — signup and login will create real authenticated sessions.',
      signupButton: 'Create member account',
      loginButton: 'Log in securely',
    };
  }

  return {
    modeLabel: 'Local preview mode',
    idleStatus: 'Local preview only — passwords are not saved and Supabase Auth is not called yet.',
    signupButton: 'Preview member signup',
    loginButton: 'Preview member login',
  };
}

function getErrorMessage(error: SupabaseError | null, fallback: string): string {
  return error?.message || fallback;
}

function getUsernameFromUser(user: SupabaseUserLike): string {
  const metadataUsername = user.user_metadata?.username;
  if (typeof metadataUsername === 'string' && metadataUsername.trim()) {
    return normalizeUsername(metadataUsername);
  }

  return normalizeUsername((user.email || 'member').split('@')[0]);
}

function getCountryFromUser(user: SupabaseUserLike): string {
  const metadataCountry = user.user_metadata?.country;
  return typeof metadataCountry === 'string' ? normalizeCountry(metadataCountry) : '';
}

function mapUserToMemberSession(user: SupabaseUserLike): SupabaseMemberSession {
  return {
    id: user.id,
    username: getUsernameFromUser(user),
    email: normalizeEmail(user.email || ''),
    country: getCountryFromUser(user),
    role: 'member',
    source: 'supabase-auth',
    startedAt: new Date().toISOString(),
  };
}

export type SignupOutcome =
  /** Signed in straight away (email confirmation is turned off in Supabase). */
  | { session: SupabaseMemberSession; needsEmailConfirmation: false; email: string }
  /** Account created, but the member must click the link in their email before they can sign in. */
  | { session: null; needsEmailConfirmation: true; email: string };

export async function signUpMemberWithSupabase(
  client: SupabaseAuthClientLike | null,
  form: SignupForm,
  emailRedirectTo?: string,
): Promise<SupabaseAuthResult<SignupOutcome>> {
  if (!client) {
    return notConfiguredResult;
  }

  const validation = validateSignupForm(form);
  if (!validation.isValid) {
    return { ok: false, error: 'Invalid signup form.' };
  }

  const email = normalizeEmail(form.email);
  const username = normalizeUsername(form.username);
  const country = normalizeCountry(form.country);
  const signup = await client.auth.signUp({
    email,
    password: form.password,
    options: { data: { username, country }, ...(emailRedirectTo ? { emailRedirectTo } : {}) },
  });

  if (signup.error) {
    return { ok: false, error: getErrorMessage(signup.error, 'Signup failed.') };
  }

  if (!signup.data.user) {
    return { ok: false, error: 'Signup did not return a Supabase user.' };
  }

  if (!signup.data.session) {
    return { ok: true, session: null, needsEmailConfirmation: true, email };
  }

  return {
    ok: true,
    needsEmailConfirmation: false,
    email,
    session: mapUserToMemberSession({ ...signup.data.session.user, email, user_metadata: { username, country } }),
  };
}

export async function signInMemberWithSupabase(
  client: SupabaseAuthClientLike | null,
  form: LoginForm,
): Promise<SupabaseAuthResult<{ session: SupabaseMemberSession }>> {
  if (!client) {
    return notConfiguredResult;
  }

  const validation = validateLoginForm(form);
  if (!validation.isValid) {
    return { ok: false, error: 'Invalid login form.' };
  }

  const email = normalizeEmail(form.email);
  const login = await client.auth.signInWithPassword({
    email,
    password: form.password,
  });

  if (login.error) {
    return { ok: false, error: getErrorMessage(login.error, 'Login failed.') };
  }

  if (!login.data.session) {
    return { ok: false, error: 'Login did not return a Supabase session.' };
  }

  return { ok: true, session: mapUserToMemberSession(login.data.session.user) };
}

export async function getSupabaseMemberSession(
  client: SupabaseAuthClientLike | null,
): Promise<SupabaseAuthResult<{ session: SupabaseMemberSession | null }>> {
  if (!client) {
    return notConfiguredResult;
  }

  const currentSession = await client.auth.getSession();
  if (currentSession.error) {
    return { ok: false, error: getErrorMessage(currentSession.error, 'Could not read current session.') };
  }

  return {
    ok: true,
    session: currentSession.data.session ? mapUserToMemberSession(currentSession.data.session.user) : null,
  };
}

export async function signOutMemberWithSupabase(
  client: SupabaseAuthClientLike | null,
): Promise<SupabaseAuthResult> {
  if (!client) {
    return notConfiguredResult;
  }

  const signOut = await client.auth.signOut();
  if (signOut.error) {
    return { ok: false, error: getErrorMessage(signOut.error, 'Sign out failed.') };
  }

  return { ok: true };
}
