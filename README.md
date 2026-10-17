# Collective Manifestation

Source for [collectivemanifestation.org](https://collectivemanifestation.org): the home of Collective Manifestation and the ManifestWave, a daily 5:28 PM intention practice that travels around the world one time zone at a time.

## How it's hosted

| Piece | Where |
| --- | --- |
| Code | GitHub — `528collectiveadmin/CMrepo` (`main` is production) |
| Hosting | Netlify — project `lovely-torte-14f684`, deploys automatically on every push to `main` |
| Database, auth | Supabase — project `collective-manifestation` (`wmbjrfmmcgidllmnjnar`, us-east-1), **Free** plan; see `docs/supabase-pro-upgrade-checklist.md` |
| Domain | `collectivemanifestation.org` → Netlify |

There's no custom server. The site is a static single-page app that talks to Supabase directly from the browser, with row-level security on every table.

## Stack

- Vite + React 19 + TypeScript
- `@supabase/supabase-js` for data and member sign-in
- Vitest for tests

## Running it locally

```bash
npm install
cp .env.example .env.local   # then fill in the two values below
npm run dev                  # http://127.0.0.1:5173
npm test
npm run build
```

### Environment variables

Set these in `.env.local` for local work, and in **Netlify → Project configuration → Environment variables** for the live site:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://wmbjrfmmcgidllmnjnar.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | The project's publishable (anon) key from Supabase → Project Settings → API |

The anon key is safe to ship to browsers; row-level security is what protects the data. Never put the `service_role` key in this repo or in Netlify.

If the variables are missing, the site still loads using the local fallback content (songs, blog posts), but sign-in, the contact form and wave check-ins won't work.

## What's on the site

- **Hero + live wave** — shows which time zone is in its 5 PM hour right now and a scrolling ticker of its flags.
- **ManifestWave** — 24 time-zone cards. Countries are assigned to a slot from their real IANA time zone, so daylight-saving shifts are handled automatically (`src/lib/manifestwave.ts`, data in `src/data/manifestwave-zones.json`).
- **Intention practice** — the five-minute 5:28 practice.
- **Music library** — songs from the `songs` table, with local MP3s and artwork in `public/assets`.
- **Members** — sign up / sign in with Supabase Auth, profile settings (display name, time zone, country), and wave check-ins.
- **Admin dashboard** — signed-in admins can edit songs, blog posts and site text.
- **Community, blog, about, contact, support** sections.
- **Contact form** — saves to `contact_messages`; people who opt in are added to `waitlist_members`.

## Database

Tables (all in `public`, all with RLS on): `songs`, `blog_posts`, `site_content`, `profiles`, `wave_participation_events`, `contact_messages`, `waitlist_members`, `manifestwave_zones`, `manifestwave_countries`.

- A new auth user automatically gets a `profiles` row (trigger `create_profile_after_auth_user_insert`).
- Admin rights come from `profiles.role = 'admin'`, checked by `private.current_user_is_admin()`. To make someone an admin, set their `role` to `admin` in the Supabase table editor.
- `manifestwave_zones` / `manifestwave_countries` are currently unused. They describe a fixed country→slot model that doesn't handle daylight saving; the app uses the JSON dataset instead.
- Contact messages and the update list are read in the Supabase dashboard (Table editor → `contact_messages` / `waitlist_members`).

### Migrations

SQL changes live in `supabase/migrations/` and every one of them has been applied to the live project. Supabase's migration history matches this folder.

To change the schema, add a new file named `YYYYMMDDHHMMSS_description.sql` (UTC timestamp), apply it to the project (Supabase SQL editor, CLI, or an AI assistant with the Supabase connector), and commit the file. Don't edit migrations that have already been applied.

## Project layout

```text
src/
  App.tsx              page layout and sections
  components/          admin dashboard, member panels, forms, blog
  lib/                 data + logic (one module per feature, each with tests)
  data/                time-zone dataset, local song metadata
public/assets/         music, artwork, flags, maps, time-zone cards
supabase/migrations/   database schema history
scripts/               Python scripts that regenerate the time-zone dataset/cards
docs/                  original brief, asset inventory, time-zone spreadsheets
```

`docs/` and `.hermes/` are planning notes from the original build and describe an earlier Vercel-based plan; this README is the current source of truth.

## Known gaps / next up

- Supabase is on the Free plan: no automatic daily backups, and leaked-password protection isn't available. Steps for after upgrading are in `docs/supabase-pro-upgrade-checklist.md`.
- Contact form has no spam protection beyond validation; add a honeypot or captcha if spam shows up.
- No email notification for new contact messages yet; they're only visible in Supabase.
- Some time-zone card map outlines still need cleanup (see `docs/manifestwave-card-build-report.md`).
- Main JS bundle is ~530 KB; code-splitting the admin dashboard would trim it.

## Ground rules

- `main` deploys straight to the live site, so run `npm test && npm run build` before pushing.
- Don't change DNS without the site owner's say-so.
