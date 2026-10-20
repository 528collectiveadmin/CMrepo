import { describe, expect, it } from 'vitest';

import masterLyricsFile from '../../public/assets/music/Lyrics.txt?raw';

import {
  extractLyricsForTrack,
  fetchPublishedSongs,
  getTotalMusicSizeBytes,
  mapSongRow,
  orderSongs,
  SongsClientLike,
  songs,
} from './music';

function createSongsClient(options: { data?: unknown[]; error?: string } = {}) {
  const calls: unknown[] = [];
  const client = {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: boolean) => ({
          order: async (orderColumn: string, orderOptions: { ascending: boolean }) => {
            calls.push({ table, columns, column, value, orderColumn, orderOptions });
            return {
              data: options.data ?? [],
              error: options.error ? { message: options.error } : null,
            };
          },
        }),
      }),
    }),
  };

  return { client, calls };
}

describe('music data', () => {
  it('loads the 10 source MP3 tracks in the source-document order with the theme song first', () => {
    expect(songs).toHaveLength(10);
    expect(songs.map((song) => song.title)).toEqual([
      'Collective Manifestation Theme Song',
      'Vivid Rise',
      'The Awakening',
      'Flow',
      'Global Song',
      'Unity',
      'Wave',
      'The Unity',
      'The Rising Tide',
      'Vibe',
    ]);
    expect(songs.every((song) => song.audioPath.startsWith('/assets/music/'))).toBe(true);
    expect(songs.every((song) => song.artworkPath.startsWith('/assets/artwork/'))).toBe(true);
    expect(songs.every((song) => song.artworkPath.endsWith('.webp'))).toBe(true);
    expect(songs[0]).toMatchObject({ isThemeSong: true, trackNumber: 1 });
    expect(getTotalMusicSizeBytes()).toBeGreaterThan(32 * 1024 * 1024);
  });

  it('maps Supabase song rows to public song cards', () => {
    expect(
      mapSongRow({
        id: 'row-1',
        slug: 'new-song',
        title: 'New Song',
        track_number: 11,
        audio_path: '/assets/music/New%20Song.mp3',
        artwork_path: '/assets/artwork/new-song.webp',
        is_theme_song: false,
      }),
    ).toEqual({
      id: 'new-song',
      title: 'New Song',
      trackNumber: 11,
      audioPath: '/assets/music/New%20Song.mp3',
      artworkPath: '/assets/artwork/new-song.webp',
      sourceFilename: 'New Song.mp3',
      sizeBytes: 0,
      isThemeSong: false,
    });
  });

  it('extracts lyrics from the master lyrics file by track number', () => {
    const masterLyrics = `Intro line\n\n1. Collective Manifestation (theme song)\n[Verse]\nTheme words\n\n2. Vivid Rise\n[Verse]\nRise words\n`;

    expect(extractLyricsForTrack(masterLyrics, 2, 'Vivid Rise')).toBe('Vivid Rise\n\n[Verse]\nRise words');
  });

  it('prefers a title match over the track number', () => {
    const masterLyrics = `2. Vibe\nVibe words\n\n3. Vivid Rise\nRise words\n`;

    expect(extractLyricsForTrack(masterLyrics, 2, 'Vivid Rise')).toBe('Vivid Rise\n\nRise words');
  });

  it('does not confuse "Unity" with "The Unity"', () => {
    const masterLyrics = `8. The Unity\nThe Unity words\n`;

    expect(extractLyricsForTrack(masterLyrics, 6, 'Unity')).toBe('Unity\n\nLyrics are not available yet.');
  });

  it('gives every published song its own lyrics from public/assets/music/Lyrics.txt', () => {
    const masterLyrics = masterLyricsFile;
    const bodies = new Map<string, string>();

    for (const song of songs) {
      const lyrics = extractLyricsForTrack(masterLyrics, song.trackNumber, song.title);
      const body = lyrics.slice(song.title.length).trim();

      if (body === 'Lyrics are not available yet.') {
        continue;
      }

      const owner = [...bodies.entries()].find(([, existing]) => existing === body)?.[0];
      expect(owner, `${song.title} shows the same lyrics as ${owner}`).toBeUndefined();
      bodies.set(song.title, body);
    }

    expect([...bodies.keys()]).toEqual(
      expect.arrayContaining(['Vivid Rise', 'The Awakening', 'Flow', 'The Unity', 'Vibe']),
    );
    expect(extractLyricsForTrack(masterLyrics, 8, 'The Unity')).toContain('5:28, we congregate, vibrations elevatin');
    expect(extractLyricsForTrack(masterLyrics, 2, 'Vivid Rise')).toContain("We need love, we need love, we need love instead");
  });

  it('keeps the theme song first even when Supabase order is wrong', () => {
    const ordered = orderSongs([
      { id: 'second', title: 'Second', trackNumber: 2, audioPath: '/b.mp3', artworkPath: '/b.jpg', sourceFilename: 'b.mp3', sizeBytes: 0 },
      {
        id: 'theme',
        title: 'Theme',
        trackNumber: 10,
        audioPath: '/a.mp3',
        artworkPath: '/a.jpg',
        sourceFilename: 'a.mp3',
        sizeBytes: 0,
        isThemeSong: true,
      },
    ]);

    expect(ordered.map((song) => song.id)).toEqual(['theme', 'second']);
  });

  it('fetches published songs from Supabase when rows exist', async () => {
    const { client, calls } = createSongsClient({
      data: [
        {
          id: 'row-1',
          slug: 'db-theme',
          title: 'DB Theme',
          track_number: 1,
          audio_path: '/assets/music/db-theme.mp3',
          artwork_path: '/assets/artwork/db-theme.webp',
          is_theme_song: true,
        },
      ],
    });

    await expect(fetchPublishedSongs(client as SongsClientLike)).resolves.toMatchObject({
      ok: true,
      source: 'supabase',
      songs: [{ id: 'db-theme', title: 'DB Theme', isThemeSong: true }],
    });
    expect(calls[0]).toEqual({
      table: 'songs',
      columns: 'id, slug, title, track_number, audio_path, artwork_path, is_theme_song',
      column: 'is_published',
      value: true,
      orderColumn: 'track_number',
      orderOptions: { ascending: true },
    });
  });

  it('falls back to local songs when Supabase is missing, empty, or errors', async () => {
    await expect(fetchPublishedSongs(null)).resolves.toMatchObject({ ok: true, source: 'local', songs });

    const empty = createSongsClient({ data: [] });
    await expect(fetchPublishedSongs(empty.client as SongsClientLike)).resolves.toMatchObject({ ok: true, source: 'local', songs });

    const failing = createSongsClient({ error: 'column does not exist' });
    await expect(fetchPublishedSongs(failing.client as SongsClientLike)).resolves.toMatchObject({
      ok: false,
      source: 'local',
      songs,
      error: 'column does not exist',
    });
  });
});
