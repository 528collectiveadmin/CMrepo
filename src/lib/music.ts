import songsData from '../data/songs.json';

export type Song = {
  id: string;
  title: string;
  trackNumber: number;
  audioPath: string;
  artworkPath: string;
  sourceFilename: string;
  sizeBytes: number;
  isThemeSong?: boolean;
};

export type SongRow = {
  id: string;
  slug: string;
  title: string;
  track_number: number | null;
  audio_path: string | null;
  artwork_path: string | null;
  is_theme_song?: boolean | null;
};

type SongsQueryResult = {
  data: SongRow[] | null;
  error: { message?: string } | null;
};

export type SongsClientLike = {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: boolean): {
        order(column: string, options: { ascending: boolean }): PromiseLike<SongsQueryResult>;
      };
    };
  };
};

export type SongsFetchResult = {
  ok: boolean;
  source: 'supabase' | 'local';
  songs: Song[];
  error?: string;
};

const songColumns = 'id, slug, title, track_number, audio_path, artwork_path, is_theme_song';

export const MASTER_LYRICS_PATH = '/assets/music/Lyrics.txt';
export const songs = songsData as Song[];

export function getTotalMusicSizeBytes(songList: Song[] = songs): number {
  return songList.reduce((total, song) => total + song.sizeBytes, 0);
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Finds a song's lyrics in the master lyrics file. Sections start with a
 * "N. Title" line. The title is matched first, so renumbering tracks in the
 * admin dashboard can't show one song's lyrics under another; the number is
 * only a fallback.
 */
export function extractLyricsForTrack(masterLyrics: string, trackNumber: number, displayTitle: string): string {
  const sectionPattern = /^\s*(\d+)\.\s+(.+?)\s*$/gm;
  const sections = [...masterLyrics.matchAll(sectionPattern)];
  const wantedTitle = normalizeTitle(displayTitle);
  const titleIndex = sections.findIndex((section) => normalizeTitle(section[2]) === wantedTitle);
  const sectionIndex =
    titleIndex !== -1 ? titleIndex : sections.findIndex((section) => Number(section[1]) === trackNumber);

  if (sectionIndex === -1) {
    return `${displayTitle}\n\nLyrics are not available yet.`;
  }

  const currentSection = sections[sectionIndex];
  const start = (currentSection.index || 0) + currentSection[0].length;
  const end = sectionIndex + 1 < sections.length ? sections[sectionIndex + 1].index || masterLyrics.length : masterLyrics.length;
  const body = masterLyrics.slice(start, end).trim();

  return `${displayTitle}\n\n${body || 'Lyrics are not available yet.'}`;
}

export function mapSongRow(row: SongRow): Song {
  return {
    id: row.slug || row.id,
    title: row.title,
    trackNumber: row.track_number || 999,
    audioPath: row.audio_path || '',
    artworkPath: row.artwork_path || '',
    sourceFilename: row.audio_path ? decodeURIComponent(row.audio_path.split('/').pop() || row.title) : row.title,
    sizeBytes: 0,
    isThemeSong: Boolean(row.is_theme_song),
  };
}

export function orderSongs(songList: Song[]): Song[] {
  return [...songList].sort((a, b) => {
    if (a.isThemeSong && !b.isThemeSong) return -1;
    if (!a.isThemeSong && b.isThemeSong) return 1;
    return a.trackNumber - b.trackNumber;
  });
}

export async function fetchPublishedSongs(client: SongsClientLike | null): Promise<SongsFetchResult> {
  const fallbackSongs = orderSongs(songs);

  if (!client) {
    return { ok: true, source: 'local', songs: fallbackSongs };
  }

  const result = await client
    .from('songs')
    .select(songColumns)
    .eq('is_published', true)
    .order('track_number', { ascending: true });

  if (result.error) {
    return {
      ok: false,
      source: 'local',
      songs: fallbackSongs,
      error: result.error.message || 'Could not load songs.',
    };
  }

  const remoteSongs = orderSongs((result.data || []).map(mapSongRow)).filter((song) => song.audioPath && song.artworkPath);

  return {
    ok: true,
    source: remoteSongs.length ? 'supabase' : 'local',
    songs: remoteSongs.length ? remoteSongs : fallbackSongs,
  };
}
