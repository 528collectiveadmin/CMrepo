import { describe, expect, it } from 'vitest';

import {
  ContactClientLike,
  ContactWaitlistPayload,
  createContactWaitlistPayload,
  initialContactWaitlistForm,
  submitContactWaitlist,
  validateContactWaitlistForm,
} from './contactForm';

describe('contact/waitlist form helpers', () => {
  it('requires a name, valid email, interest, and message', () => {
    const result = validateContactWaitlistForm(initialContactWaitlistForm);

    expect(result.isValid).toBe(false);
    expect(result.errors).toEqual({
      name: 'Please enter your name.',
      email: 'Please enter a valid email address.',
      interest: 'Please choose the reason you are reaching out.',
      message: 'Please add a short message.',
    });
  });

  it('accepts a complete contact message with update and volunteer preferences', () => {
    const result = validateContactWaitlistForm({
      name: ' Rick ',
      email: 'rick@example.com ',
      interest: 'volunteer',
      message: ' I would like to help with launch review. ',
      wantsUpdates: true,
      wantsToVolunteer: true,
    });

    expect(result).toEqual({ isValid: true, errors: {} });
  });

  it('trims the payload before it is submitted', () => {
    const payload = createContactWaitlistPayload({
      name: ' Rick ',
      email: 'RICK@EXAMPLE.COM ',
      interest: 'question',
      message: ' Can I join any hour? ',
      wantsUpdates: true,
      wantsToVolunteer: false,
    });

    expect(payload).toMatchObject({
      name: 'Rick',
      email: 'rick@example.com',
      interest: 'question',
      message: 'Can I join any hour?',
      wantsUpdates: true,
      wantsToVolunteer: false,
    });
    expect(payload.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

type FakeError = { message?: string; code?: string } | null;

function createFakeContactClient(errors: Partial<Record<'contact_messages' | 'waitlist_members', FakeError>> = {}) {
  const calls: { table: string; row: Record<string, unknown> }[] = [];
  const client: ContactClientLike = {
    from: (table) => ({
      insert: (row) => {
        calls.push({ table, row });
        return Promise.resolve({ error: errors[table] ?? null });
      },
    }),
  };

  return { client, calls };
}

const basePayload: ContactWaitlistPayload = {
  name: 'Rick',
  email: 'rick@example.com',
  interest: 'question',
  message: 'Can I join any hour?',
  wantsUpdates: false,
  wantsToVolunteer: false,
  createdAt: '2026-10-16T00:00:00.000Z',
};

describe('submitContactWaitlist', () => {
  it('saves the message to contact_messages', async () => {
    const { client, calls } = createFakeContactClient();

    await expect(submitContactWaitlist(client, basePayload)).resolves.toEqual({ ok: true, joinedUpdateList: false });
    expect(calls).toEqual([
      {
        table: 'contact_messages',
        row: {
          name: 'Rick',
          email: 'rick@example.com',
          subject: 'Question',
          message: 'Can I join any hour?',
          source: 'website-contact-form',
        },
      },
    ]);
  });

  it('adds the sender to the update list when they opt in, and notes it in the subject', async () => {
    const { client, calls } = createFakeContactClient();

    const result = await submitContactWaitlist(client, { ...basePayload, wantsUpdates: true, wantsToVolunteer: true });

    expect(result).toEqual({ ok: true, joinedUpdateList: true });
    expect(calls.map((call) => call.table)).toEqual(['contact_messages', 'waitlist_members']);
    expect(calls[0].row.subject).toBe('Question · wants updates · may volunteer');
    expect(calls[1].row).toMatchObject({ email: 'rick@example.com', name: 'Rick', intention: null });
  });

  it('always adds waitlist requests to the update list, keeping their message as the intention', async () => {
    const { client, calls } = createFakeContactClient();

    await submitContactWaitlist(client, { ...basePayload, interest: 'waitlist' });

    expect(calls[1]).toMatchObject({ table: 'waitlist_members', row: { intention: 'Can I join any hour?' } });
  });

  it('treats an email already on the update list as success', async () => {
    const { client } = createFakeContactClient({ waitlist_members: { code: '23505', message: 'duplicate key' } });

    await expect(submitContactWaitlist(client, { ...basePayload, wantsUpdates: true })).resolves.toEqual({
      ok: true,
      joinedUpdateList: true,
    });
  });

  it('reports a failure instead of claiming the message was sent', async () => {
    const { client, calls } = createFakeContactClient({ contact_messages: { message: 'network down' } });

    const result = await submitContactWaitlist(client, { ...basePayload, wantsUpdates: true });

    expect(result.ok).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('reports a failure when Supabase is not configured', async () => {
    await expect(submitContactWaitlist(null, basePayload)).resolves.toMatchObject({ ok: false });
  });
});
