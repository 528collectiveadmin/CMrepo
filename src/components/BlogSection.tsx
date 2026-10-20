import { useEffect, useState } from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  BlogClientLike,
  BlogPost,
  blogPosts,
  fetchPublishedBlogPosts,
  getPublishedBlogPosts,
  splitIntoParagraphs,
} from '../lib/blog';

const fallbackPosts = getPublishedBlogPosts(blogPosts);

function formatPostDate(date: string | null): string {
  if (!date) {
    return 'Draft';
  }

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

export function BlogSection() {
  const [posts, setPosts] = useState<BlogPost[]>(fallbackPosts);
  const [openPostId, setOpenPostId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    if (!isSupabaseConfigured || !supabase) {
      return () => {
        isMounted = false;
      };
    }

    fetchPublishedBlogPosts(supabase as unknown as BlogClientLike)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setPosts(result.posts);
      })
      .catch((error: unknown) => {
        if (!isMounted) {
          return;
        }

        console.info(error instanceof Error ? error.message : 'Could not load remote blog posts.');
        setPosts(fallbackPosts);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <section className="section blog-section" id="blog">
      <div className="blog-header">
        <div>
          <p className="eyebrow">Blog</p>
          <h2>Notes from the ManifestWave.</h2>
        </div>
      </div>

      {posts.length ? (
        <div className="blog-grid" aria-label="Published blog posts">
          {posts.map((post) => {
            const isOpen = openPostId === post.id;

            return (
              <article className={`blog-card${isOpen ? ' is-open' : ''}`} id={`blog-${post.slug}`} key={post.id}>
                <div>
                  <span>{formatPostDate(post.publishedAt)}</span>
                  <span aria-hidden="true"> · </span>
                  <span>{post.readTimeMinutes} min read</span>
                </div>
                <h3>{post.title}</h3>
                {isOpen ? (
                  <div className="blog-body">
                    {splitIntoParagraphs(post.body).map((paragraph, index) => (
                      <p key={index}>{paragraph}</p>
                    ))}
                  </div>
                ) : (
                  <p>{post.excerpt}</p>
                )}
                <button
                  aria-expanded={isOpen}
                  className="blog-read-toggle"
                  type="button"
                  onClick={() => {
                    setOpenPostId(isOpen ? null : post.id);
                    if (isOpen) {
                      document.getElementById(`blog-${post.slug}`)?.scrollIntoView({ block: 'nearest' });
                    }
                  }}
                >
                  {isOpen ? 'Show less' : 'Read more'}
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="blog-empty">The first notes are on their way. Check back soon.</p>
      )}
    </section>
  );
}
