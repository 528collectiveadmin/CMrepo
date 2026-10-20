import { BlogPostRow } from './blog';

export type AdminBlogRow = BlogPostRow & { hero_image_path?: string | null };

export type BlogSaveAction = 'publish' | 'draft';

export type BlogEditorInput = {
  /** Set when editing an existing post. */
  id?: string;
  title: string;
  summary: string;
  body: string;
};

type SupabaseError = { message?: string; code?: string };
type SingleResult = PromiseLike<{ data: unknown; error: SupabaseError | null }>;

export type AdminBlogClientLike = {
  from(table: 'blog_posts'): {
    insert(row: Record<string, unknown>): { select(columns: string): { single(): SingleResult } };
    update(row: Record<string, unknown>): {
      eq(column: 'id', value: string): { select(columns: string): { single(): SingleResult } };
    };
  };
};

export type BlogSaveResult = { ok: true; row: AdminBlogRow } | { ok: false; error: string };

export const adminBlogColumns = 'id, slug, title, excerpt, body, status, published_at, hero_image_path';

const SUMMARY_LENGTH = 220;
// These match the database's rules for blog_posts (see supabase/migrations/0003_create_blog_posts.sql).
export const TITLE_MIN_LENGTH = 3;
export const TITLE_MAX_LENGTH = 140;
const SUMMARY_MIN_LENGTH = 10;
const FALLBACK_SUMMARY = 'A new note from Collective Manifestation.';

/** Titles are a single line; pasted line breaks become spaces. */
export function cleanTitle(title: string): string {
  return title.replace(/\s+/g, ' ').trim();
}

/** "The Shift Begins Here!" -> "the-shift-begins-here" */
export function slugifyTitle(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');

  return slug || 'post';
}

/** Adds -2, -3, … so a new post never takes another post's web address. */
export function makeUniqueSlug(base: string, takenSlugs: Iterable<string>): string {
  const taken = new Set(takenSlugs);
  if (!taken.has(base)) {
    return base;
  }

  let n = 2;
  while (taken.has(`${base}-${n}`)) {
    n += 1;
  }

  return `${base}-${n}`;
}

/** The first sentence or two of the post, for the blog card. */
export function makeSummaryFromBody(body: string): string {
  const text = body.replace(/\s+/g, ' ').trim();
  if (text.length < SUMMARY_MIN_LENGTH) {
    return FALLBACK_SUMMARY;
  }

  if (text.length <= SUMMARY_LENGTH) {
    return text;
  }

  const cut = text.slice(0, SUMMARY_LENGTH);
  const sentenceEnd = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (sentenceEnd > 60) {
    return cut.slice(0, sentenceEnd + 1);
  }

  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}

export function validateBlogEditorInput(input: BlogEditorInput): string | null {
  const title = cleanTitle(input.title);
  if (!title) {
    return 'Please give the post a title.';
  }

  if (title.length < TITLE_MIN_LENGTH) {
    return `The title needs at least ${TITLE_MIN_LENGTH} characters.`;
  }

  if (title.length > TITLE_MAX_LENGTH) {
    return `The title is ${title.length} characters; the limit is ${TITLE_MAX_LENGTH}. Please shorten it and put the rest at the start of the post.`;
  }

  if (!input.body.trim()) {
    return 'Please write or paste the post text.';
  }

  return null;
}

export function buildBlogPostRow(
  input: BlogEditorInput,
  action: BlogSaveAction,
  existing: AdminBlogRow | undefined,
  allRows: AdminBlogRow[],
  now: Date = new Date(),
): Record<string, unknown> {
  const body = input.body.replace(/\r\n/g, '\n').trim();
  const summary = input.summary.replace(/\s+/g, ' ').trim();
  const row: Record<string, unknown> = {
    title: cleanTitle(input.title),
    excerpt:
      summary.length >= SUMMARY_MIN_LENGTH && summary.length <= 280 ? summary : makeSummaryFromBody(body),
    body,
  };

  if (!existing) {
    row.slug = makeUniqueSlug(
      slugifyTitle(input.title),
      allRows.map((post) => post.slug),
    );
  }

  if (action === 'publish') {
    row.status = 'published';
    // Keep the original publish date when updating a post that's already live.
    row.published_at =
      existing?.status === 'published' && existing.published_at ? existing.published_at : now.toISOString();
  } else {
    row.status = 'draft';
    row.published_at = null;
  }

  return row;
}

export async function saveBlogPost(
  client: AdminBlogClientLike | null,
  input: BlogEditorInput,
  action: BlogSaveAction,
  allRows: AdminBlogRow[],
): Promise<BlogSaveResult> {
  if (!client) {
    return { ok: false, error: 'The site isn’t connected to the database, so posts can’t be saved right now.' };
  }

  const problem = validateBlogEditorInput(input);
  if (problem) {
    return { ok: false, error: problem };
  }

  const existing = input.id ? allRows.find((post) => post.id === input.id) : undefined;
  if (input.id && !existing) {
    return { ok: false, error: 'That post no longer exists. Reload the page and try again.' };
  }

  const row = buildBlogPostRow(input, action, existing, allRows);
  const table = client.from('blog_posts');
  const result = existing
    ? await table.update(row).eq('id', existing.id).select(adminBlogColumns).single()
    : await table.insert(row).select(adminBlogColumns).single();

  if (result.error || !result.data) {
    if (result.error?.code === '23505') {
      return { ok: false, error: 'Another post already uses that web address. Try a slightly different title.' };
    }

    return {
      ok: false,
      error: `The post wasn’t saved${result.error?.message ? ` (${result.error.message})` : ''}. Your text is still in the editor.`,
    };
  }

  return { ok: true, row: result.data as AdminBlogRow };
}
