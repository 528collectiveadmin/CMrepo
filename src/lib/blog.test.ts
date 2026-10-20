import { describe, expect, it } from 'vitest';

import {
  BlogPost,
  BlogPostRow,
  calculateReadTimeMinutes,
  fetchPublishedBlogPosts,
  getPublishedBlogPosts,
  mapBlogPostRow,
  splitIntoParagraphs,
} from './blog';

const posts: BlogPost[] = [
  {
    id: 'draft',
    slug: 'draft-post',
    title: 'Draft Post',
    excerpt: 'Hidden draft.',
    body: 'Draft body.',
    status: 'draft',
    publishedAt: null,
    readTimeMinutes: 1,
  },
  {
    id: 'older',
    slug: 'older-post',
    title: 'Older Published Post',
    excerpt: 'Older published excerpt.',
    body: 'Older body.',
    status: 'published',
    publishedAt: '2026-08-01T12:00:00.000Z',
    readTimeMinutes: 2,
  },
  {
    id: 'newer',
    slug: 'newer-post',
    title: 'Newer Published Post',
    excerpt: 'Newer published excerpt.',
    body: 'Newer body.',
    status: 'published',
    publishedAt: '2026-08-10T12:00:00.000Z',
    readTimeMinutes: 3,
  },
];

function createFakeBlogClient(options: { rows?: BlogPostRow[]; error?: string } = {}) {
  const calls: Record<string, unknown[]> = {
    from: [],
    select: [],
    eq: [],
    order: [],
  };

  return {
    calls,
    client: {
      from: (table: string) => {
        calls.from.push(table);
        return {
          select: (columns: string) => {
            calls.select.push(columns);
            return {
              eq: (column: string, value: string) => {
                calls.eq.push({ column, value });
                return {
                  order: async (column: string, optionsArg: { ascending: boolean }) => {
                    calls.order.push({ column, options: optionsArg });
                    return {
                      data: options.rows ?? [],
                      error: options.error ? { message: options.error } : null,
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

describe('blog helpers', () => {
  it('shows only published blog posts sorted newest first', () => {
    expect(getPublishedBlogPosts(posts).map((post) => post.slug)).toEqual(['newer-post', 'older-post']);
  });

  it('calculates a minimum one-minute reading time', () => {
    expect(calculateReadTimeMinutes('short post')).toBe(1);
  });

  it('rounds longer reading time based on 220 words per minute', () => {
    const body = Array.from({ length: 441 }, (_, index) => `word${index}`).join(' ');
    expect(calculateReadTimeMinutes(body)).toBe(3);
  });

  it('maps Supabase blog rows into public blog posts with calculated read time', () => {
    const body = Array.from({ length: 221 }, () => 'word').join(' ');

    expect(
      mapBlogPostRow({
        id: 'post-1',
        slug: 'hello-wave',
        title: 'Hello Wave',
        excerpt: 'A short excerpt for the public blog.',
        body,
        status: 'published',
        published_at: '2026-08-18T12:00:00.000Z',
      }),
    ).toEqual({
      id: 'post-1',
      slug: 'hello-wave',
      title: 'Hello Wave',
      excerpt: 'A short excerpt for the public blog.',
      body,
      status: 'published',
      publishedAt: '2026-08-18T12:00:00.000Z',
      readTimeMinutes: 2,
    });
  });

  it('fetches published blog posts from Supabase ordered newest first', async () => {
    const { client, calls } = createFakeBlogClient({
      rows: [
        {
          id: 'post-1',
          slug: 'hello-wave',
          title: 'Hello Wave',
          excerpt: 'A short excerpt for the public blog.',
          body: 'Published post body',
          status: 'published',
          published_at: '2026-08-18T12:00:00.000Z',
        },
      ],
    });

    await expect(fetchPublishedBlogPosts(client)).resolves.toMatchObject({
      ok: true,
      source: 'supabase',
      posts: [
        {
          slug: 'hello-wave',
          publishedAt: '2026-08-18T12:00:00.000Z',
          readTimeMinutes: 1,
        },
      ],
    });
    expect(calls.from).toEqual(['blog_posts']);
    expect(calls.eq).toEqual([{ column: 'status', value: 'published' }]);
    expect(calls.order).toEqual([{ column: 'published_at', options: { ascending: false } }]);
  });

  it('falls back to local published posts when Supabase fetch fails', async () => {
    const { client } = createFakeBlogClient({ error: 'network unavailable' });

    await expect(fetchPublishedBlogPosts(client)).resolves.toMatchObject({
      ok: false,
      source: 'local',
      error: 'network unavailable',
      posts: [
        { slug: 'manifestwave-start-here' },
        { slug: 'why-the-wave-moves' },
      ],
    });
  });
});

describe('splitIntoParagraphs', () => {
  it('turns each line into a paragraph and skips blank lines', () => {
    expect(splitIntoParagraphs('Welcome home.\nSecond line.\r\n\n\n•\tA bullet\n  ')).toEqual([
      'Welcome home.',
      'Second line.',
      '•\tA bullet',
    ]);
  });
});
