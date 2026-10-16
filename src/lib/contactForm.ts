export type ContactInterest = 'question' | 'waitlist' | 'volunteer' | 'support' | '';

export type ContactWaitlistForm = {
  name: string;
  email: string;
  interest: ContactInterest;
  message: string;
  wantsUpdates: boolean;
  wantsToVolunteer: boolean;
};

export type ContactWaitlistErrors = Partial<Record<keyof Pick<ContactWaitlistForm, 'name' | 'email' | 'interest' | 'message'>, string>>;

export type ContactWaitlistValidation = {
  isValid: boolean;
  errors: ContactWaitlistErrors;
};

export type ContactWaitlistPayload = Omit<ContactWaitlistForm, 'interest'> & {
  interest: Exclude<ContactInterest, ''>;
  createdAt: string;
};

type InsertResult = PromiseLike<{ error: { message?: string; code?: string } | null }>;

export type ContactClientLike = {
  from: (table: 'contact_messages' | 'waitlist_members') => {
    insert: (row: Record<string, unknown>) => InsertResult;
  };
};

export type ContactSubmitResult =
  | { ok: true; joinedUpdateList: boolean }
  | { ok: false; error: string };

const interestSubjects: Record<Exclude<ContactInterest, ''>, string> = {
  waitlist: 'Early update list',
  question: 'Question',
  volunteer: 'Volunteer / collaborate',
  support: 'Support / donation',
};

const UNIQUE_VIOLATION = '23505';
const SOURCE = 'website-contact-form';

export const initialContactWaitlistForm: ContactWaitlistForm = {
  name: '',
  email: '',
  interest: '',
  message: '',
  wantsUpdates: true,
  wantsToVolunteer: false,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactWaitlistForm(form: ContactWaitlistForm): ContactWaitlistValidation {
  const errors: ContactWaitlistErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Please enter your name.';
  }

  if (!emailPattern.test(form.email.trim())) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!form.interest) {
    errors.interest = 'Please choose the reason you are reaching out.';
  }

  if (!form.message.trim()) {
    errors.message = 'Please add a short message.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function createContactWaitlistPayload(form: ContactWaitlistForm): ContactWaitlistPayload {
  if (!form.interest) {
    throw new Error('Cannot create contact/waitlist payload without an interest.');
  }

  return {
    name: form.name.trim(),
    email: form.email.trim().toLowerCase(),
    interest: form.interest,
    message: form.message.trim(),
    wantsUpdates: form.wantsUpdates,
    wantsToVolunteer: form.wantsToVolunteer,
    createdAt: new Date().toISOString(),
  };
}

export function buildContactMessageRow(payload: ContactWaitlistPayload) {
  const flags = [
    payload.wantsUpdates ? 'wants updates' : null,
    payload.wantsToVolunteer ? 'may volunteer' : null,
  ].filter(Boolean);

  return {
    name: payload.name,
    email: payload.email,
    subject: [interestSubjects[payload.interest], ...flags].join(' · '),
    message: payload.message,
    source: SOURCE,
  };
}

export function shouldJoinUpdateList(payload: ContactWaitlistPayload): boolean {
  return payload.wantsUpdates || payload.interest === 'waitlist';
}

export async function submitContactWaitlist(
  client: ContactClientLike | null,
  payload: ContactWaitlistPayload,
): Promise<ContactSubmitResult> {
  if (!client) {
    return { ok: false, error: 'Messages can’t be sent right now. Please try again later.' };
  }

  const message = await client.from('contact_messages').insert(buildContactMessageRow(payload));

  if (message.error) {
    return { ok: false, error: 'Your message didn’t go through. Please try again in a moment.' };
  }

  if (!shouldJoinUpdateList(payload)) {
    return { ok: true, joinedUpdateList: false };
  }

  const waitlist = await client.from('waitlist_members').insert({
    email: payload.email,
    name: payload.name,
    intention: payload.interest === 'waitlist' ? payload.message : null,
    source: SOURCE,
  });

  // Already on the list is fine. Any other failure here shouldn't undo the saved message.
  const joinedUpdateList = !waitlist.error || waitlist.error.code === UNIQUE_VIOLATION;

  return { ok: true, joinedUpdateList };
}
