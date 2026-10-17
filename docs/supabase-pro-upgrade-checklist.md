# Supabase Pro upgrade checklist

The `collective-manifestation` Supabase project is on the **Free** plan as of Oct 16, 2026. Work through this list after upgrading the organization to **Pro**.

## Until the upgrade

- [ ] **Keep the project active.** Free projects are paused after about a week of low database activity, and that would take sign-in, the contact form and wave check-ins offline. Normal site traffic usually prevents this; Supabase emails a warning first.
- [ ] **Take an occasional manual backup.** Free projects get no automatic daily backups. Ask Claude to export the database (members, messages, wave check-ins) and keep a copy off-site.

## Right after upgrading

1. [ ] **Turn on leaked-password protection.** Authentication → Attack Protection (or Sign In / Providers → Email) → "Prevent use of leaked passwords". This clears the last Supabase security warning.
2. [ ] **Check backups are running.** Database → Backups should start showing daily backups (Pro keeps 7 days). They may take a day to appear.
3. [ ] **Review the spend cap.** Organization → Billing. Leave the spend cap on unless there's a reason to allow overage charges.
4. [ ] **Re-run the Supabase advisors** (Advisors → Security and Performance) and fix anything new.
5. [ ] **Update the README** to say the project is on Pro, and tick this file off.

## Optional, once on Pro

- [ ] **Move music and artwork to Supabase Storage.** MP3s currently live in `public/assets` in the repo. Storage would let the admin dashboard upload new songs without a code change.
- [ ] **Point-in-time recovery.** Paid add-on (needs the Small compute add-on or larger). Only worth it once there's a lot of member data.
- [ ] **Branching.** Lets schema changes be tested on a copy of the database before they reach the live site. Billed per branch while it runs.

Sources: [Project pausing](https://supabase.com/docs/guides/platform/free-project-pausing), [Database backups](https://supabase.com/docs/guides/platform/backups), [Password security](https://supabase.com/docs/guides/auth/password-security).
