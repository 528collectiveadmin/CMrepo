import { FormEvent, useState } from 'react';

import {
  ContactInterest,
  ContactWaitlistErrors,
  ContactWaitlistForm as ContactWaitlistFormState,
  createContactWaitlistPayload,
  initialContactWaitlistForm,
  submitContactWaitlist,
  validateContactWaitlistForm,
} from '../lib/contactForm';
import { supabase } from '../lib/supabase';

type InterestOption = {
  value: Exclude<ContactInterest, ''>;
  label: string;
};

const interestOptions: InterestOption[] = [
  { value: 'waitlist', label: 'Join the early update list' },
  { value: 'question', label: 'Ask a question' },
  { value: 'volunteer', label: 'Volunteer or collaborate' },
  { value: 'support', label: 'Support / donation question' },
];

export function ContactWaitlistForm() {
  const [form, setForm] = useState<ContactWaitlistFormState>(initialContactWaitlistForm);
  const [errors, setErrors] = useState<ContactWaitlistErrors>({});
  const [statusMessage, setStatusMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  function updateField<Field extends keyof ContactWaitlistFormState>(
    field: Field,
    value: ContactWaitlistFormState[Field],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatusMessage('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSending) {
      return;
    }

    const validation = validateContactWaitlistForm(form);
    setErrors(validation.errors);

    if (!validation.isValid) {
      setStatusMessage('Please fix the highlighted fields before sending.');
      return;
    }

    setIsSending(true);
    setStatusMessage('Sending…');

    const result = await submitContactWaitlist(supabase, createContactWaitlistPayload(form));

    setIsSending(false);

    if (!result.ok) {
      setStatusMessage(result.error);
      return;
    }

    setForm(initialContactWaitlistForm);
    setStatusMessage(
      result.joinedUpdateList
        ? 'Thank you — your message was sent and you’re on the update list.'
        : 'Thank you — your message was sent.',
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit} noValidate>
      <div className="form-grid">
        <label>
          <span>Name</span>
          <input
            autoComplete="name"
            name="name"
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="Your name"
            type="text"
            value={form.name}
          />
          {errors.name ? <small className="field-error">{errors.name}</small> : null}
        </label>

        <label>
          <span>Email</span>
          <input
            autoComplete="email"
            name="email"
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="you@example.com"
            type="email"
            value={form.email}
          />
          {errors.email ? <small className="field-error">{errors.email}</small> : null}
        </label>
      </div>

      <label>
        <span>Reason for reaching out</span>
        <select
          name="interest"
          onChange={(event) => updateField('interest', event.target.value as ContactInterest)}
          value={form.interest}
        >
          <option value="">Choose one</option>
          {interestOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.interest ? <small className="field-error">{errors.interest}</small> : null}
      </label>

      <label>
        <span>Message</span>
        <textarea
          name="message"
          onChange={(event) => updateField('message', event.target.value)}
          placeholder="Tell us what you are interested in, what question you have, or how you may want to help."
          rows={5}
          value={form.message}
        />
        {errors.message ? <small className="field-error">{errors.message}</small> : null}
      </label>

      <div className="checkbox-stack">
        <label>
          <input
            checked={form.wantsUpdates}
            onChange={(event) => updateField('wantsUpdates', event.target.checked)}
            type="checkbox"
          />
          <span>Send me Collective Manifestation launch updates.</span>
        </label>
        <label>
          <input
            checked={form.wantsToVolunteer}
            onChange={(event) => updateField('wantsToVolunteer', event.target.checked)}
            type="checkbox"
          />
          <span>I may be interested in volunteering or helping review the site.</span>
        </label>
      </div>

      <div className="form-actions">
        <button className="button primary" disabled={isSending} type="submit">
          {isSending ? 'Sending…' : 'Send message'}
        </button>
        <p aria-live="polite">{statusMessage || 'Questions and offers to help are welcome.'}</p>
      </div>
    </form>
  );
}
