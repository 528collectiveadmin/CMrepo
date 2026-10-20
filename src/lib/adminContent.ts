import { BlogPostRow } from './blog';

export type AdminSongRow = {
  id: string;
  slug: string;
  title: string;
  track_number: number | null;
  audio_path: string | null;
  artwork_path: string | null;
  lyrics: string | null;
  description: string | null;
  is_published: boolean;
  is_theme_song?: boolean;
};

export type AdminSongForm = {
  id?: string;
  slug: string;
  title: string;
  trackNumber: number;
  audioPath: string;
  artworkPath: string;
  lyrics: string;
  description: string;
  isPublished: boolean;
  isThemeSong: boolean;
};

export type AdminSiteContentRow = {
  key: string;
  label: string;
  section: string;
  value: string;
  is_published: boolean;
};

export type AdminSiteContentForm = {
  key: string;
  label: string;
  section: string;
  value: string;
  isPublished: boolean;
};

type SupabaseError = { message?: string };

type AdminListResult<Row> = {
  data: Row[] | null;
  error: SupabaseError | null;
};

type AdminSingleResult<Row> = {
  data: Row | null;
  error: SupabaseError | null;
};

type AdminMutationResult = {
  error: SupabaseError | null;
};

export type AdminContentClientLike = {
  from(table: string): {
    select(columns: string): {
      order(column: string, options: { ascending: boolean }): PromiseLike<AdminListResult<unknown>>;
    };
    upsert(payload: Record<string, unknown>, options: { onConflict: string }): {
      select(columns: string): {
        single(): PromiseLike<AdminSingleResult<unknown>>;
      };
    };
    delete(): {
      eq(column: string, value: string): PromiseLike<AdminMutationResult>;
    };
  };
};

export type AdminRowsResult<Row> =
  | { ok: true; rows: Row[] }
  | { ok: false; rows: []; error: string };

export type AdminRowResult<Row> = { ok: true; row: Row } | { ok: false; error: string };
export type AdminDeleteResult = { ok: true } | { ok: false; error: string };

const songColumns = 'id, slug, title, track_number, audio_path, artwork_path, lyrics, description, is_published, is_theme_song';
const blogColumns = 'id, slug, title, excerpt, body, status, published_at, hero_image_path';
const siteContentColumns = 'key, label, section, value, is_published';

function getErrorMessage(error: SupabaseError | null, fallback: string): string {
  return error?.message || fallback;
}

function missingClientRows<Row>(): AdminRowsResult<Row> {
  return { ok: false, rows: [], error: 'Supabase is not configured.' };
}

function missingClientRow<Row>(): AdminRowResult<Row> {
  return { ok: false, error: 'Supabase is not configured.' };
}

function missingClientDelete(): AdminDeleteResult {
  return { ok: false, error: 'Supabase is not configured.' };
}

export async function listAdminSongs(client: AdminContentClientLike | null): Promise<AdminRowsResult<AdminSongRow>> {
  if (!client) {
    return missingClientRows();
  }

  const result = await client.from('songs').select(songColumns).order('track_number', { ascending: true });
  if (result.error) {
    return { ok: false, rows: [], error: getErrorMessage(result.error, 'Could not load songs.') };
  }

  return { ok: true, rows: (result.data || []) as AdminSongRow[] };
}

export async function saveAdminSong(
  client: AdminContentClientLike | null,
  form: AdminSongForm,
): Promise<AdminRowResult<AdminSongRow>> {
  if (!client) {
    return missingClientRow();
  }

  const payload = {
    ...(form.id ? { id: form.id } : {}),
    slug: form.slug.trim(),
    title: form.title.trim(),
    track_number: form.trackNumber,
    audio_path: form.audioPath.trim(),
    artwork_path: form.artworkPath.trim(),
    lyrics: form.lyrics.trim(),
    description: form.description.trim(),
    is_published: form.isPublished,
    is_theme_song: form.isThemeSong,
  };

  const result = await client.from('songs').upsert(payload, { onConflict: 'slug' }).select(songColumns).single();
  if (result.error || !result.data) {
    return { ok: false, error: getErrorMessage(result.error, 'Could not save song.') };
  }

  return { ok: true, row: result.data as AdminSongRow };
}

export async function deleteAdminSong(
  client: AdminContentClientLike | null,
  songId: string,
): Promise<AdminDeleteResult> {
  if (!client) {
    return missingClientDelete();
  }

  const result = await client.from('songs').delete().eq('id', songId);
  if (result.error) {
    return { ok: false, error: getErrorMessage(result.error, 'Could not delete song.') };
  }

  return { ok: true };
}

export async function listAdminBlogPosts(
  client: AdminContentClientLike | null,
): Promise<AdminRowsResult<BlogPostRow[] extends Array<infer Row> ? Row & { hero_image_path?: string | null } : never>> {
  if (!client) {
    return missingClientRows();
  }

  const result = await client.from('blog_posts').select(blogColumns).order('published_at', { ascending: false });
  if (result.error) {
    return { ok: false, rows: [], error: getErrorMessage(result.error, 'Could not load blog posts.') };
  }

  return { ok: true, rows: result.data as never };
}

export async function deleteAdminBlogPost(
  client: AdminContentClientLike | null,
  postId: string,
): Promise<AdminDeleteResult> {
  if (!client) {
    return missingClientDelete();
  }

  const result = await client.from('blog_posts').delete().eq('id', postId);
  if (result.error) {
    return { ok: false, error: getErrorMessage(result.error, 'Could not delete blog post.') };
  }

  return { ok: true };
}

export async function listAdminSiteContent(
  client: AdminContentClientLike | null,
): Promise<AdminRowsResult<AdminSiteContentRow>> {
  if (!client) {
    return missingClientRows();
  }

  const result = await client.from('site_content').select(siteContentColumns).order('section', { ascending: true });
  if (result.error) {
    return { ok: false, rows: [], error: getErrorMessage(result.error, 'Could not load site content.') };
  }

  return { ok: true, rows: (result.data || []) as AdminSiteContentRow[] };
}

export async function saveAdminSiteContent(
  client: AdminContentClientLike | null,
  form: AdminSiteContentForm,
): Promise<AdminRowResult<AdminSiteContentRow>> {
  if (!client) {
    return missingClientRow();
  }

  const payload = {
    key: form.key.trim(),
    label: form.label.trim(),
    section: form.section.trim(),
    value: form.value.trim(),
    is_published: form.isPublished,
  };

  const result = await client
    .from('site_content')
    .upsert(payload, { onConflict: 'key' })
    .select(siteContentColumns)
    .single();
  if (result.error || !result.data) {
    return { ok: false, error: getErrorMessage(result.error, 'Could not save site content.') };
  }

  return { ok: true, row: result.data as AdminSiteContentRow };
}

export async function deleteAdminSiteContent(
  client: AdminContentClientLike | null,
  contentKey: string,
): Promise<AdminDeleteResult> {
  if (!client) {
    return missingClientDelete();
  }

  const result = await client.from('site_content').delete().eq('key', contentKey);
  if (result.error) {
    return { ok: false, error: getErrorMessage(result.error, 'Could not delete site content.') };
  }

  return { ok: true };
}
