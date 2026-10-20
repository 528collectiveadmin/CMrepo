import { describe, expect, it } from 'vitest';

import {
  AdminBlogClientLike,
  AdminBlogRow,
  buildBlogPostRow,
  makeSummaryFromBody,
  makeUniqueSlug,
  saveBlogPost,
  slugifyTitle,
} from './adminBlog';

const welcomePost: AdminBlogRow = {
  id: 'welcome-id',
  slug: 'my-post-slug',
  title: 'The Shift Begins Here',
  excerpt: 'Welcome home',
  body: 'Welcome home.',
  status: 'draft',
  published_at: null,
  hero_image_path: null,
};

const livePost: AdminBlogRow = {
  ...welcomePost,
  id: 'live-id',
  slug: 'already-live',
  status: 'published',
  published_at: '2026-10-01T12:00:00.000Z',
};

function createFakeClient(error: { message?: string; code?: string } | null = null) {
  const calls: { action: string; row: Record<string, unknown>; id?: string }[] = [];
  const respond = (row: Record<string, unknown>, id?: string) => ({
    single: async () => ({ data: error ? null : { id: id ?? 'new-id', ...row }, error }),
  });
  const client: AdminBlogClientLike = {
    from: () => ({
      insert: (row) => {
        calls.push({ action: 'insert', row });
        return { select: () => respond(row) };
      },
      update: (row) => ({
        eq: (_column, id) => {
          calls.push({ action: 'update', row, id });
          return { select: () => respond(row, id) };
        },
      }),
    }),
  };

  return { client, calls };
}

describe('blog editor helpers', () => {
  it('turns a title into a web-address slug', () => {
    expect(slugifyTitle('The Shift Begins Here: A Welcome from Our Founder')).toBe(
      'the-shift-begins-here-a-welcome-from-our-founder',
    );
    expect(slugifyTitle("Rick's 5:28 Notes!")).toBe('ricks-5-28-notes');
    expect(slugifyTitle('!!!')).toBe('post');
  });

  it('never reuses a slug another post already has', () => {
    expect(makeUniqueSlug('my-post-slug', ['my-post-slug'])).toBe('my-post-slug-2');
    expect(makeUniqueSlug('my-post-slug', ['my-post-slug', 'my-post-slug-2'])).toBe('my-post-slug-3');
    expect(makeUniqueSlug('fresh', ['my-post-slug'])).toBe('fresh');
  });

  it('never makes a summary the database would reject (10-280 characters)', () => {
    expect(makeSummaryFromBody('Hi')).toBe('A new note from Collective Manifestation.');
    expect(makeSummaryFromBody('x'.repeat(1000)).length).toBeLessThanOrEqual(280);
  });

  it('makes a short summary from the first sentences', () => {
    const body = 'Welcome home. '.repeat(30);
    const summary = makeSummaryFromBody(body);

    expect(summary.length).toBeLessThanOrEqual(220);
    expect(summary.endsWith('.')).toBe(true);
    expect(makeSummaryFromBody('Short post.')).toBe('Short post.');
  });

  it('publishing a new post sets status, date, slug and summary automatically', () => {
    const now = new Date('2026-10-20T02:30:00.000Z');
    const row = buildBlogPostRow(
      { title: 'My Post Slug', summary: '', body: 'First line.\r\nSecond line.' },
      'publish',
      undefined,
      [welcomePost],
      now,
    );

    expect(row).toEqual({
      title: 'My Post Slug',
      excerpt: 'First line. Second line.',
      body: 'First line.\nSecond line.',
      slug: 'my-post-slug-2',
      status: 'published',
      published_at: '2026-10-20T02:30:00.000Z',
    });
  });

  it('keeps the original date and web address when updating a live post', () => {
    const row = buildBlogPostRow(
      { id: livePost.id, title: 'New title', summary: 'Custom summary', body: 'Updated.' },
      'publish',
      livePost,
      [livePost],
    );

    expect(row).not.toHaveProperty('slug');
    expect(row).toMatchObject({ status: 'published', published_at: '2026-10-01T12:00:00.000Z', excerpt: 'Custom summary' });
  });

  it('saving as a draft takes a post off the site', () => {
    const row = buildBlogPostRow({ id: livePost.id, title: 'T', summary: '', body: 'B' }, 'draft', livePost, [livePost]);

    expect(row).toMatchObject({ status: 'draft', published_at: null });
  });
});

describe('saveBlogPost', () => {
  it('inserts new posts instead of overwriting one with the same slug', async () => {
    const { client, calls } = createFakeClient();

    const result = await saveBlogPost(client, { title: 'my post slug', summary: '', body: 'Hello' }, 'draft', [welcomePost]);

    expect(result.ok).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].action).toBe('insert');
    expect(calls[0].row.slug).toBe('my-post-slug-2');
  });

  it('updates an existing post by its id', async () => {
    const { client, calls } = createFakeClient();

    await saveBlogPost(client, { id: 'welcome-id', title: 'Welcome', summary: '', body: 'Hi' }, 'publish', [welcomePost]);

    expect(calls[0]).toMatchObject({ action: 'update', id: 'welcome-id', row: { status: 'published' } });
  });

  it('explains what is missing instead of saving an empty post', async () => {
    const { client, calls } = createFakeClient();

    await expect(saveBlogPost(client, { title: ' ', summary: '', body: 'Body text here.' }, 'publish', [])).resolves.toEqual({
      ok: false,
      error: 'Please give the post a title.',
    });
    await expect(saveBlogPost(client, { title: 'Test post', summary: '', body: ' ' }, 'publish', [])).resolves.toEqual({
      ok: false,
      error: 'Please write or paste the post text.',
    });
    expect(calls).toHaveLength(0);
  });

  it('checks the title length before saving, matching the database rule', async () => {
    const { client, calls } = createFakeClient();
    const longTitle = 'The Shift Begins Here: '.repeat(8);

    const tooLong = await saveBlogPost(client, { title: longTitle, summary: '', body: 'Body text here.' }, 'publish', []);
    const tooShort = await saveBlogPost(client, { title: 'Hi', summary: '', body: 'Body text here.' }, 'publish', []);

    expect(tooLong).toMatchObject({ ok: false });
    expect(tooLong.ok ? '' : tooLong.error).toMatch(/limit is 140/);
    expect(tooShort).toEqual({ ok: false, error: 'The title needs at least 3 characters.' });
    expect(calls).toHaveLength(0);
  });

  it('turns line breaks pasted into the title into spaces', () => {
    const row = buildBlogPostRow({ title: 'Line one\nline two ', summary: '', body: 'Body text here.' }, 'draft', undefined, []);

    expect(row.title).toBe('Line one line two');
  });

  it('reports database errors and reassures that the text is kept', async () => {
    const { client } = createFakeClient({ message: 'permission denied' });

    const result = await saveBlogPost(client, { title: 'Test post', summary: '', body: 'Body text here.' }, 'publish', []);

    expect(result).toEqual({
      ok: false,
      error: 'The post wasn’t saved (permission denied). Your text is still in the editor.',
    });
  });
});
