export type BlogPostStatus = 'draft' | 'published' | 'archived';

export type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: BlogPostStatus;
  publishedAt: string | null;
  readTimeMinutes: number;
};

export type BlogPostRow = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  status: BlogPostStatus;
  published_at: string | null;
};

type BlogQueryResult = {
  data: BlogPostRow[] | null;
  error: { message?: string } | null;
};

export type BlogClientLike = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => Promise<BlogQueryResult>;
      };
    };
  };
};

export type BlogFetchResult = {
  ok: boolean;
  source: 'supabase' | 'local';
  posts: BlogPost[];
  error?: string;
};

const wordsPerMinute = 220;

const blogPostColumns = 'id, slug, title, excerpt, body, status, published_at';

export function calculateReadTimeMinutes(body: string): number {
  const wordCount = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}

export function mapBlogPostRow(row: BlogPostRow): BlogPost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    body: row.body,
    status: row.status,
    publishedAt: row.published_at,
    readTimeMinutes: calculateReadTimeMinutes(row.body),
  };
}

export function getPublishedBlogPosts(posts: BlogPost[]): BlogPost[] {
  return posts
    .filter((post) => post.status === 'published' && Boolean(post.publishedAt))
    .sort((a, b) => new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
}

export async function fetchPublishedBlogPosts(client: BlogClientLike | null): Promise<BlogFetchResult> {
  const fallbackPosts = getPublishedBlogPosts(blogPosts);

  if (!client) {
    return { ok: true, source: 'local', posts: fallbackPosts };
  }

  const result = await client
    .from('blog_posts')
    .select(blogPostColumns)
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (result.error) {
    return {
      ok: false,
      source: 'local',
      posts: fallbackPosts,
      error: result.error.message || 'Could not load blog posts.',
    };
  }

  return {
    ok: true,
    source: 'supabase',
    posts: getPublishedBlogPosts((result.data || []).map(mapBlogPostRow)),
  };
}

const draftPosts: Omit<BlogPost, 'readTimeMinutes'>[] = [
  {
    id: 'manifestwave-start-here',
    slug: 'manifestwave-start-here',
    title: 'Start here: the 5:28 Manifest Call',
    excerpt:
      'A short introduction to the daily practice, the 5:28 timing, and the simple invitation behind Collective Manifestation.',
    body:
      'Collective Manifestation begins with a simple rhythm: pause, breathe, set a clear intention for a kinder world, and return to the day ready to notice practical opportunities to help. The 5:28 Manifest Call gives that practice a shared daily signal without making it complicated. Each visitor can join at 5:28 PM in their own local zone, or join at 28 minutes past any hour when the wave is active somewhere else in the world.',
    status: 'published',
    publishedAt: '2026-08-17T12:00:00.000Z',
  },
  {
    id: 'why-the-wave-moves',
    slug: 'why-the-wave-moves',
    title: 'Why the ManifestWave moves around the world',
    excerpt:
      'The 24 symbolic time-zone cards turn a daily moment into a calm global relay of focused intention.',
    body:
      'The ManifestWave is designed as a relay. Every hour, another group of countries and regions reaches the local 5 PM hour. The site uses 24 symbolic UTC cards to make that movement easy to scan. The cards are not political maps or authoritative boundary references. They are simple reminders that people in many places can carry the same intention forward in their own local time.',
    status: 'published',
    publishedAt: '2026-08-16T12:00:00.000Z',
  },
  {
    id: 'member-space-preview',
    slug: 'member-space-preview',
    title: 'What the member space is for',
    excerpt:
      'A preview of how member accounts will support profile settings, future downloads, and participation tools.',
    body:
      'The member space starts intentionally small. The first protected features are signup, login, a dashboard, and profile settings. That proves the security foundation before adding bigger community tools. Future member-only areas can include music downloads, ManifestWave check-ins, discussion prompts, and private launch-review notes.',
    status: 'draft',
    publishedAt: null,
  },
];

export const blogPosts: BlogPost[] = draftPosts.map((post) => ({
  ...post,
  readTimeMinutes: calculateReadTimeMinutes(post.body),
}));

/** Each line of the post becomes its own paragraph; blank lines are ignored. */
export function splitIntoParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Fired by the admin editor after a post is published, updated or deleted, so the public blog refreshes. */
export const BLOG_POSTS_CHANGED_EVENT = 'cm:blog-posts-changed';

export function announceBlogPostsChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(BLOG_POSTS_CHANGED_EVENT));
  }
}
