> **Historical planning note (Aug 2026).** The site now runs on Netlify + Supabase from `528collectiveadmin/CMrepo`, and the schema is live. See the README for the current setup.

# Hosting and Supabase Architecture

## Decision

Collective Manifestation will use:

- **Hosting/deploy:** Vercel
- **Source control:** GitHub — `https://github.com/528manifestation/collective-manifestation`
- **Backend/database:** Supabase
- **Old platform:** Replit is historical only and should not be used for the rebuild

Rick confirmed he has a paid/premium Supabase plan, so Supabase limits should not block the first production path.

## Recommended v1 architecture

```text
GitHub repo
   ↓ push
Vercel build/deploy
   ↓ serves
Public web app
   ↓ reads/writes only where needed
Supabase database/storage/auth
```

## App stack recommendation

Use **Vite + React + TypeScript** unless a Next.js-only feature becomes necessary.

Reasoning:

- The public site can be fast and mostly static.
- ManifestWave time-zone tracker is client-side logic.
- Music library can read metadata from Supabase while static assets can start local or move to Supabase Storage.
- Vercel handles deploy previews cleanly.
- Supabase covers the dynamic parts without running our own server.

## Supabase responsibilities

### Use Supabase now for

- Music library metadata:
  - title
  - artist
  - description
  - featured/theme-song flag
  - lyrics
  - artwork path
  - audio path
  - sort order
  - published/unpublished status
- Contact form submissions
- Optional community/member signup waitlist
- Optional donation/support metadata if needed later

### Use Supabase Storage for

- MP3 music files if we do not want them committed into GitHub
- Track artwork
- Future video thumbnails or downloadable assets

### Delay until needed

- Full member login
- User profiles
- In-site forum/message board
- Admin CMS/dashboard

For v1, avoid building an admin dashboard. Content can be managed directly in Supabase or through code/AI-assisted updates until the need is proven.

## Suggested Supabase tables

### `songs`

Purpose: drive the music library.

Fields:

- `id` UUID primary key
- `title` text not null
- `slug` text unique not null
- `artist` text default `Collective Manifestation`
- `description` text
- `lyrics` text
- `audio_url` text
- `artwork_url` text
- `is_featured` boolean default false
- `is_published` boolean default true
- `sort_order` integer default 0
- `created_at` timestamptz default now()
- `updated_at` timestamptz default now()

### `contact_messages`

Purpose: capture contact form messages.

Fields:

- `id` UUID primary key
- `name` text not null
- `email` text not null
- `subject` text
- `message` text not null
- `status` text default `new`
- `created_at` timestamptz default now()

### `waitlist_members`

Purpose: lightweight community/member interest list before full auth/forum.

Fields:

- `id` UUID primary key
- `email` text unique not null
- `name` text
- `country` text
- `time_zone` text
- `source` text default `website`
- `created_at` timestamptz default now()

## Environment variables for Vercel

Expected public client variables:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Do **not** commit real Supabase keys into GitHub. Vercel should store them as project environment variables.

If we later add server-only operations, use a separate server-side key only in Vercel protected environment variables, never in client code.

## Security posture

- Enable Row Level Security on Supabase tables.
- Public visitors can read only published songs.
- Public visitors can insert contact/waitlist records, but cannot read all submissions.
- Keep admin/service role keys out of the browser.
- Do not expose private storage buckets publicly unless intended.

## Deployment path

1. Build local app.
2. Commit and push to GitHub.
3. Connect GitHub repo to Vercel.
4. Add Supabase environment variables in Vercel.
5. Deploy preview.
6. Validate site and Supabase reads/writes.
7. Only after Rick approves, update Squarespace DNS.

## Open setup items

- Create/select Supabase project for Collective Manifestation.
- Decide whether MP3s live in GitHub `public/assets/music/` for v1 or Supabase Storage from day one.
- Decide whether contact form should email Rick, store in Supabase, or both.
- Decide if member signup is a simple waitlist first or full Supabase Auth.
