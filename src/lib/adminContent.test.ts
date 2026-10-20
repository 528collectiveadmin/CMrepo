import { describe, expect, it } from 'vitest';

import {
  AdminSiteContentForm,
  AdminSongForm,
  deleteAdminBlogPost,
  deleteAdminSiteContent,
  deleteAdminSong,
  listAdminBlogPosts,
  listAdminSiteContent,
  listAdminSongs,
  saveAdminSiteContent,
  saveAdminSong,
} from './adminContent';

function createAdminContentClient(options: { data?: unknown[]; row?: unknown; error?: string } = {}) {
  const calls: unknown[] = [];
  const client = {
    from: (table: string) => ({
      select: (columns: string) => ({
        order: async (column: string, optionsArg: { ascending: boolean }) => {
          calls.push({ action: 'select.order', table, columns, column, options: optionsArg });
          return { data: options.data ?? [], error: options.error ? { message: options.error } : null };
        },
      }),
      upsert: (payload: unknown, optionsArg: { onConflict: string }) => ({
        select: (columns: string) => ({
          single: async () => {
            calls.push({ action: 'upsert.select.single', table, payload, options: optionsArg, columns });
            return { data: options.row ?? payload, error: options.error ? { message: options.error } : null };
          },
        }),
      }),
      delete: () => ({
        eq: async (column: string, value: string) => {
          calls.push({ action: 'delete.eq', table, column, value });
          return { error: options.error ? { message: options.error } : null };
        },
      }),
    }),
  };

  return { client, calls };
}

describe('admin content helpers', () => {
  it('lists admin songs ordered by track number', async () => {
    const { client, calls } = createAdminContentClient({ data: [] });

    await expect(listAdminSongs(client)).resolves.toEqual({ ok: true, rows: [] });
    expect(calls[0]).toEqual({
      action: 'select.order',
      table: 'songs',
      columns: 'id, slug, title, track_number, audio_path, artwork_path, lyrics, description, is_published, is_theme_song',
      column: 'track_number',
      options: { ascending: true },
    });
  });

  it('saves song metadata without touching files', async () => {
    const form: AdminSongForm = {
      slug: 'new-song',
      title: 'New Song',
      trackNumber: 11,
      audioPath: '/assets/music/new-song.mp3',
      artworkPath: '/assets/artwork/new-song.webp',
      lyrics: 'Lyrics here',
      description: 'Short description',
      isPublished: true,
      isThemeSong: false,
    };
    const { client, calls } = createAdminContentClient();

    await expect(saveAdminSong(client, form)).resolves.toMatchObject({ ok: true });
    expect(calls[0]).toMatchObject({
      action: 'upsert.select.single',
      table: 'songs',
      options: { onConflict: 'slug' },
      payload: {
        slug: 'new-song',
        title: 'New Song',
        track_number: 11,
        audio_path: '/assets/music/new-song.mp3',
        artwork_path: '/assets/artwork/new-song.webp',
        lyrics: 'Lyrics here',
        description: 'Short description',
        is_published: true,
        is_theme_song: false,
      },
    });
  });

  it('saves structured site text by key', async () => {
    const form: AdminSiteContentForm = {
      key: 'hero.headline',
      label: 'Hero headline',
      section: 'hero',
      value: 'A 24-hour global wave of focused intention.',
      isPublished: true,
    };
    const { client, calls } = createAdminContentClient();

    await expect(saveAdminSiteContent(client, form)).resolves.toMatchObject({ ok: true });
    expect(calls[0]).toMatchObject({
      table: 'site_content',
      options: { onConflict: 'key' },
      payload: {
        key: 'hero.headline',
        label: 'Hero headline',
        section: 'hero',
        value: 'A 24-hour global wave of focused intention.',
        is_published: true,
      },
    });
  });

  it('deletes admin content rows by their safe identifier', async () => {
    const { client, calls } = createAdminContentClient();

    await expect(deleteAdminSong(client, 'song-id')).resolves.toEqual({ ok: true });
    await expect(deleteAdminBlogPost(client, 'post-id')).resolves.toEqual({ ok: true });
    await expect(deleteAdminSiteContent(client, 'hero.headline')).resolves.toEqual({ ok: true });

    expect(calls).toEqual([
      { action: 'delete.eq', table: 'songs', column: 'id', value: 'song-id' },
      { action: 'delete.eq', table: 'blog_posts', column: 'id', value: 'post-id' },
      { action: 'delete.eq', table: 'site_content', column: 'key', value: 'hero.headline' },
    ]);
  });

  it('returns RLS errors without pretending writes succeeded', async () => {
    const { client } = createAdminContentClient({ error: 'new row violates row-level security policy' });

    await expect(listAdminBlogPosts(client)).resolves.toEqual({
      ok: false,
      rows: [],
      error: 'new row violates row-level security policy',
    });
  });

  it('lists site content ordered by section', async () => {
    const { client, calls } = createAdminContentClient({ data: [] });

    await expect(listAdminSiteContent(client)).resolves.toEqual({ ok: true, rows: [] });
    expect(calls[0]).toMatchObject({ table: 'site_content', column: 'section' });
  });
});
