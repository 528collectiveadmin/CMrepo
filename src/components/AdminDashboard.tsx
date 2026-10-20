import { FormEvent, useEffect, useMemo, useState } from 'react';

import { isSupabaseConfigured, supabase } from '../lib/supabase';
import {
  AdminContentClientLike,
  AdminSiteContentForm,
  AdminSiteContentRow,
  AdminSongForm,
  AdminSongRow,
  deleteAdminBlogPost,
  deleteAdminSiteContent,
  deleteAdminSong,
  listAdminBlogPosts,
  listAdminSiteContent,
  listAdminSongs,
  saveAdminSiteContent,
  saveAdminSong,
} from '../lib/adminContent';
import {
  AdminBlogClientLike,
  AdminBlogRow,
  BlogSaveAction,
  TITLE_MAX_LENGTH,
  cleanTitle,
  saveBlogPost,
} from '../lib/adminBlog';
import { BlogPostStatus } from '../lib/blog';
import {
  WaveParticipationClientLike,
  WaveParticipationStats,
  getWaveParticipationStats,
} from '../lib/waveParticipation';

type AdminDashboardProps = {
  username: string;
};

type AdminTab = 'blog' | 'songs' | 'text' | 'wave';

const initialSongForm: AdminSongForm = {
  slug: '',
  title: '',
  trackNumber: 1,
  audioPath: '',
  artworkPath: '',
  lyrics: '',
  description: '',
  isPublished: false,
  isThemeSong: false,
};

const initialTextForm: AdminSiteContentForm = {
  key: '',
  label: '',
  section: 'general',
  value: '',
  isPublished: true,
};

function getAdminClient(): AdminContentClientLike | null {
  return supabase as AdminContentClientLike | null;
}

function getWaveStatsClient(): WaveParticipationClientLike | null {
  return supabase as WaveParticipationClientLike | null;
}

function formatStatusLabel(status: BlogPostStatus | boolean): string {
  if (typeof status === 'boolean') {
    return status ? 'published' : 'draft';
  }

  return status;
}

function songRowToForm(row: AdminSongRow): AdminSongForm {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    trackNumber: row.track_number || 1,
    audioPath: row.audio_path || '',
    artworkPath: row.artwork_path || '',
    lyrics: row.lyrics || '',
    description: row.description || '',
    isPublished: row.is_published,
    isThemeSong: Boolean(row.is_theme_song),
  };
}

function textRowToForm(row: AdminSiteContentRow): AdminSiteContentForm {
  return {
    key: row.key,
    label: row.label,
    section: row.section,
    value: row.value,
    isPublished: row.is_published,
  };
}

export function AdminDashboard({ username }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>('blog');
  const tabs = useMemo(
    () => [
      { id: 'blog' as const, label: 'Blog posts' },
      { id: 'songs' as const, label: 'Songs' },
      { id: 'text' as const, label: 'Site text' },
      { id: 'wave' as const, label: 'Wave stats' },
    ],
    [],
  );

  return (
    <section className="admin-dashboard" aria-label="Admin content tools">
      <div className="admin-dashboard-header">
        <div>
          <span>Admin content tools</span>
          <h4>Website editor for {username}</h4>
          <p>Admin writes are protected by Supabase Auth + RLS. No service-role key is used in the browser.</p>
        </div>
      </div>

      <div className="admin-tabs" aria-label="Admin editor sections">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab.id ? 'is-active' : ''}
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'blog' ? <AdminBlogPanel /> : null}
      {activeTab === 'songs' ? <AdminSongsPanel /> : null}
      {activeTab === 'text' ? <AdminSiteTextPanel /> : null}
      {activeTab === 'wave' ? <AdminWaveStatsPanel /> : null}
    </section>
  );
}

function formatBlogDate(iso: string | null): string {
  if (!iso) {
    return '';
  }

  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function describeBlogRow(row: AdminBlogRow): string {
  if (row.status === 'published') {
    return `Published ${formatBlogDate(row.published_at)} · visible on the site`;
  }

  if (row.status === 'archived') {
    return 'Archived · not visible on the site';
  }

  return 'Draft · only admins can see it';
}

function AdminBlogPanel() {
  const [rows, setRows] = useState<AdminBlogRow[]>([]);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState('Loading your posts…');
  const [isSaving, setIsSaving] = useState(false);

  const editingRow = rows.find((row) => row.id === editingId);
  const titleLength = cleanTitle(title).length;
  const isLive = editingRow?.status === 'published';

  async function loadRows() {
    if (!isSupabaseConfigured) {
      setStatus('The site isn’t connected to the database, so posts can’t be edited right now.');
      return;
    }

    const result = await listAdminBlogPosts(getAdminClient());
    if (result.ok) {
      setRows(result.rows as AdminBlogRow[]);
      setStatus('');
    } else {
      setStatus(result.error);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  function startNewPost() {
    setEditingId(undefined);
    setTitle('');
    setBody('');
    setStatus('');
  }

  function startEditing(row: AdminBlogRow) {
    setEditingId(row.id);
    setTitle(row.title);
    setBody(row.body || '');
    setStatus(`Editing “${row.title}”.`);
    document.getElementById('admin-blog-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function save(action: BlogSaveAction) {
    if (isSaving) {
      return;
    }

    setIsSaving(true);
    setStatus('Saving…');
    const result = await saveBlogPost(
      supabase as unknown as AdminBlogClientLike | null,
      { id: editingId, title, summary: '', body },
      action,
      rows,
    );
    setIsSaving(false);

    if (!result.ok) {
      setStatus(result.error);
      return;
    }

    startNewPost();
    setStatus(
      action === 'publish'
        ? `Published! “${result.row.title}” is now in the Blog section of the site.`
        : `Saved “${result.row.title}” as a draft. It won’t appear on the site until you publish it.`,
    );
    await loadRows();
  }

  async function handleDelete(row: AdminBlogRow) {
    if (!window.confirm(`Delete “${row.title}”? This can’t be undone.`)) {
      return;
    }

    const result = await deleteAdminBlogPost(getAdminClient(), row.id);
    if (result.ok) {
      if (row.id === editingId) {
        startNewPost();
      }
      setStatus(`Deleted “${row.title}”.`);
      await loadRows();
    } else {
      setStatus(result.error);
    }
  }

  return (
    <div className="admin-panel">
      <form
        className="admin-form"
        id="admin-blog-editor"
        noValidate
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void save('publish');
        }}
      >
        <h5>{editingRow ? 'Edit post' : 'Write a new post'}</h5>
        <label>
          <span>Title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Give your post a title" />
          <small className={titleLength > TITLE_MAX_LENGTH ? 'field-hint field-hint-error' : 'field-hint'}>
            {titleLength} / {TITLE_MAX_LENGTH} characters
            {titleLength > TITLE_MAX_LENGTH ? ' (too long; please shorten it)' : ''}
          </small>
        </label>
        <label>
          <span>Post</span>
          <textarea
            className="admin-blog-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write or paste your post here. Each new line starts a new paragraph."
            rows={14}
          />
        </label>
        <div className="form-actions">
          <button className="button primary" disabled={isSaving} type="submit">
            {isLive ? 'Update post' : 'Publish'}
          </button>
          <button className="button secondary" disabled={isSaving} type="button" onClick={() => void save('draft')}>
            {isLive ? 'Unpublish (move to drafts)' : 'Save as draft'}
          </button>
          {editingRow ? (
            <button className="button secondary" disabled={isSaving} type="button" onClick={startNewPost}>
              Cancel
            </button>
          ) : null}
        </div>
        <p className="admin-save-status" aria-live="polite">
          {status}
        </p>
      </form>

      <h5 className="admin-list-heading">Your posts</h5>
      <AdminRowsList
        emptyLabel="No posts yet. Write your first one above."
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          meta: describeBlogRow(row),
          onEdit: () => startEditing(row),
          onDelete: () => void handleDelete(row),
        }))}
      />
    </div>
  );
}

function AdminSongsPanel() {
  const [rows, setRows] = useState<AdminSongRow[]>([]);
  const [form, setForm] = useState<AdminSongForm>(initialSongForm);
  const [status, setStatus] = useState('Loading songs…');

  async function loadRows() {
    if (!isSupabaseConfigured) {
      setStatus('Supabase is not configured, so admin song editing is disabled.');
      return;
    }

    const result = await listAdminSongs(getAdminClient());
    if (result.ok) {
      setRows(result.rows);
      setStatus(result.rows.length ? 'Songs loaded.' : 'No Supabase song rows yet. Seed songs before managing live music.');
    } else {
      setStatus(result.error);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  function updateField<Field extends keyof AdminSongForm>(field: Field, value: AdminSongForm[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await saveAdminSong(getAdminClient(), form);
    if (result.ok) {
      setForm(initialSongForm);
      setStatus('Song metadata saved.');
      await loadRows();
    } else {
      setStatus(result.error);
    }
  }

  async function handleDelete(row: AdminSongRow) {
    if (!window.confirm(`Delete song metadata for "${row.title}"? This does not delete audio/artwork files.`)) {
      return;
    }

    const result = await deleteAdminSong(getAdminClient(), row.id);
    if (result.ok) {
      setStatus('Song metadata deleted.');
      await loadRows();
    } else {
      setStatus(result.error);
    }
  }

  return (
    <div className="admin-panel">
      <form className="admin-form" onSubmit={handleSubmit} noValidate>
        <h5>{form.id ? 'Edit song metadata' : 'Add song metadata'}</h5>
        <div className="form-grid">
          <label>
            <span>Slug</span>
            <input value={form.slug} onChange={(event) => updateField('slug', event.target.value)} placeholder="song-slug" />
          </label>
          <label>
            <span>Track number</span>
            <input
              type="number"
              min="1"
              value={form.trackNumber}
              onChange={(event) => updateField('trackNumber', Number(event.target.value))}
            />
          </label>
        </div>
        <label>
          <span>Title</span>
          <input value={form.title} onChange={(event) => updateField('title', event.target.value)} placeholder="Song title" />
        </label>
        <label>
          <span>Audio path</span>
          <input value={form.audioPath} onChange={(event) => updateField('audioPath', event.target.value)} placeholder="/assets/music/song.mp3" />
        </label>
        <label>
          <span>Artwork path</span>
          <input
            value={form.artworkPath}
            onChange={(event) => updateField('artworkPath', event.target.value)}
            placeholder="/assets/artwork/song.webp"
          />
        </label>
        <label>
          <span>Description</span>
          <textarea value={form.description} onChange={(event) => updateField('description', event.target.value)} rows={3} />
        </label>
        <label>
          <span>Lyrics</span>
          <textarea value={form.lyrics} onChange={(event) => updateField('lyrics', event.target.value)} rows={6} />
        </label>
        <label className="admin-checkbox">
          <input
            checked={form.isPublished}
            onChange={(event) => updateField('isPublished', event.target.checked)}
            type="checkbox"
          />
          <span>Published</span>
        </label>
        <label className="admin-checkbox">
          <input
            checked={form.isThemeSong}
            onChange={(event) => updateField('isThemeSong', event.target.checked)}
            type="checkbox"
          />
          <span>Theme Song highlight</span>
        </label>
        <button className="button primary" type="submit">Save song</button>
      </form>

      <AdminRowsList
        emptyLabel="No Supabase song rows loaded."
        rows={rows.map((row) => ({
          id: row.id,
          title: row.title,
          meta: `Track ${row.track_number || '—'} · ${formatStatusLabel(row.is_published)}${row.is_theme_song ? ' · Theme Song' : ''}`,
          onEdit: () => setForm(songRowToForm(row)),
          onDelete: () => void handleDelete(row),
        }))}
      />
      <p className="auth-status">{status}</p>
    </div>
  );
}

function AdminSiteTextPanel() {
  const [rows, setRows] = useState<AdminSiteContentRow[]>([]);
  const [form, setForm] = useState<AdminSiteContentForm>(initialTextForm);
  const [status, setStatus] = useState('Loading site text…');

  async function loadRows() {
    if (!isSupabaseConfigured) {
      setStatus('Supabase is not configured, so admin site text editing is disabled.');
      return;
    }

    const result = await listAdminSiteContent(getAdminClient());
    if (result.ok) {
      setRows(result.rows);
      setStatus(result.rows.length ? 'Site text keys loaded.' : 'No site text keys yet.');
    } else {
      setStatus(result.error);
    }
  }

  useEffect(() => {
    void loadRows();
  }, []);

  function updateField<Field extends keyof AdminSiteContentForm>(field: Field, value: AdminSiteContentForm[Field]) {
    setForm((current) => ({ ...current, [field]: value }));
    setStatus('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await saveAdminSiteContent(getAdminClient(), form);
    if (result.ok) {
      setForm(initialTextForm);
      setStatus('Site text saved. Public UI wiring is a separate step per approved text keys.');
      await loadRows();
    } else {
      setStatus(result.error);
    }
  }

  async function handleDelete(row: AdminSiteContentRow) {
    if (!window.confirm(`Delete site text key "${row.key}"?`)) {
      return;
    }

    const result = await deleteAdminSiteContent(getAdminClient(), row.key);
    if (result.ok) {
      setStatus('Site text deleted.');
      await loadRows();
    } else {
      setStatus(result.error);
    }
  }

  return (
    <div className="admin-panel">
      <form className="admin-form" onSubmit={handleSubmit} noValidate>
        <h5>{rows.some((row) => row.key === form.key) ? 'Edit site text' : 'Add site text key'}</h5>
        <div className="form-grid">
          <label>
            <span>Key</span>
            <input value={form.key} onChange={(event) => updateField('key', event.target.value)} placeholder="hero.headline" />
          </label>
          <label>
            <span>Section</span>
            <input value={form.section} onChange={(event) => updateField('section', event.target.value)} placeholder="hero" />
          </label>
        </div>
        <label>
          <span>Label</span>
          <input value={form.label} onChange={(event) => updateField('label', event.target.value)} placeholder="Hero headline" />
        </label>
        <label>
          <span>Value</span>
          <textarea value={form.value} onChange={(event) => updateField('value', event.target.value)} rows={6} />
        </label>
        <label className="admin-checkbox">
          <input
            checked={form.isPublished}
            onChange={(event) => updateField('isPublished', event.target.checked)}
            type="checkbox"
          />
          <span>Published</span>
        </label>
        <button className="button primary" type="submit">Save site text</button>
      </form>

      <AdminRowsList
        emptyLabel="No site text keys loaded."
        rows={rows.map((row) => ({
          id: row.key,
          title: row.label,
          meta: `${row.key} · ${row.section} · ${formatStatusLabel(row.is_published)}`,
          onEdit: () => setForm(textRowToForm(row)),
          onDelete: () => void handleDelete(row),
        }))}
      />
      <p className="auth-status">{status}</p>
    </div>
  );
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function StatBucketList({ emptyLabel, rows }: { emptyLabel: string; rows: { label: string; count: number }[] }) {
  if (!rows.length) {
    return <p className="admin-empty">{emptyLabel}</p>;
  }

  return (
    <div className="admin-stat-list">
      {rows.map((row) => (
        <div key={row.label}>
          <span>{row.label}</span>
          <strong>{row.count}</strong>
        </div>
      ))}
    </div>
  );
}

function AdminWaveStatsPanel() {
  const [stats, setStats] = useState<WaveParticipationStats | null>(null);
  const [status, setStatus] = useState('Loading wave participation stats…');

  async function loadStats() {
    if (!isSupabaseConfigured) {
      setStatus('Supabase is not configured, so wave stats are disabled.');
      return;
    }

    const result = await getWaveParticipationStats(getWaveStatsClient());
    if (result.ok) {
      setStats(result.stats);
      setStatus(result.stats.totalEvents ? 'Wave participation stats loaded.' : 'No wave participation events recorded yet.');
    } else {
      setStatus(result.error);
    }
  }

  useEffect(() => {
    void loadStats();
  }, []);

  return (
    <div className="admin-panel admin-wave-panel">
      <div className="admin-wave-header">
        <div>
          <h5>ManifestWave participation stats</h5>
          <p>
            Counts are created when a signed-in member clicks the public watch-video bar. Stats are admin-only through RLS.
          </p>
        </div>
        <button className="button secondary" type="button" onClick={() => void loadStats()}>
          Refresh stats
        </button>
      </div>

      {stats ? (
        <>
          <div className="admin-stat-cards" aria-label="Wave participation totals">
            <article>
              <span>Total events</span>
              <strong>{stats.totalEvents}</strong>
            </article>
            <article>
              <span>Video starts</span>
              <strong>{stats.startedCount}</strong>
            </article>
            <article>
              <span>Completed</span>
              <strong>{stats.completedCount}</strong>
            </article>
          </div>

          <div className="admin-stat-grid">
            <section>
              <h6>By country</h6>
              <StatBucketList emptyLabel="No country data yet." rows={stats.byCountry} />
            </section>
            <section>
              <h6>By browser timezone</h6>
              <StatBucketList emptyLabel="No timezone data yet." rows={stats.byTimezone} />
            </section>
            <section>
              <h6>By active wave zone</h6>
              <StatBucketList emptyLabel="No wave zone data yet." rows={stats.bySlot} />
            </section>
          </div>

          <section className="admin-recent-events">
            <h6>Recent events</h6>
            {stats.recentEvents.length ? (
              <div className="admin-row-list">
                {stats.recentEvents.map((event) => (
                  <article key={event.id}>
                    <div>
                      <strong>
                        {event.country || 'Unknown country'} · UTC{event.active_manifestwave_slot >= 0 ? '+' : ''}{event.active_manifestwave_slot}
                      </strong>
                      <span>
                        {event.browser_timezone || 'Unknown timezone'} · {event.ritual_action_type.replace('_', ' ')} · {formatEventTime(event.created_at)}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="admin-empty">No recent wave participation events.</p>
            )}
          </section>
        </>
      ) : null}
      <p className="auth-status">{status}</p>
    </div>
  );
}

function AdminRowsList({
  emptyLabel,
  rows,
}: {
  emptyLabel: string;
  rows: { id: string; title: string; meta: string; onEdit: () => void; onDelete: () => void }[];
}) {
  if (!rows.length) {
    return <p className="admin-empty">{emptyLabel}</p>;
  }

  return (
    <div className="admin-row-list">
      {rows.map((row) => (
        <article key={row.id}>
          <div>
            <strong>{row.title}</strong>
            <span>{row.meta}</span>
          </div>
          <div className="admin-row-actions">
            <button className="button secondary" type="button" onClick={row.onEdit}>Edit</button>
            <button className="button danger" type="button" onClick={row.onDelete}>Delete</button>
          </div>
        </article>
      ))}
    </div>
  );
}
