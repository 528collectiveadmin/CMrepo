import { useEffect, useMemo, useRef, useState } from 'react';

import { BlogSection } from './components/BlogSection';
import { ContactWaitlistForm } from './components/ContactWaitlistForm';
import { MemberAuthPanel } from './components/MemberAuthPanel';
import { WatchVideoBar } from './components/WatchVideoBar';
import {
  getCurrentManifestWaveSlot,
  getCountriesInFivePmWave,
  getLiveWaveCountryPreview,
  getManifestWaveHourKey,
  getZoneBySlot,
  type ManifestWaveCountry,
} from './lib/manifestwave';
import { getManifestCallAlertState } from './lib/manifestCall';
import {
  extractLyricsForTrack,
  fetchPublishedSongs,
  MASTER_LYRICS_PATH,
  Song,
  SongsClientLike,
  songs,
} from './lib/music';
import { navigationItems } from './lib/navigation';
import { supabase } from './lib/supabase';

function LiveWaveCountryRows({ countries }: { countries: ManifestWaveCountry[] }) {
  return (
    <ul className="live-wave-country-list">
      {countries.map((country) => (
        <li className="live-wave-country-row" key={country.id}>
          <img src={country.flagPath} alt="" aria-hidden="true" />
          <span>
            <strong>{country.name}</strong>
            {country.detail ? <small>{country.detail}</small> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function LiveWaveCountryCount({ count }: { count: number }) {
  return count === 1 ? (
    <p className="live-wave-count"><strong>1</strong> country or region is in their 5 PM hour right now</p>
  ) : (
    <p className="live-wave-count"><strong>{count}</strong> countries and regions are in their 5 PM hour right now</p>
  );
}

function LiveWaveCountryPanel({ countries }: { countries: ManifestWaveCountry[] }) {
  const countryPreview = getLiveWaveCountryPreview(countries);

  return (
    <section className="live-wave-panel" aria-label="Countries and regions in their 5 PM hour">
      <LiveWaveCountryCount count={countries.length} />
      <LiveWaveCountryRows countries={countryPreview.visibleCountries} />
      {countryPreview.hiddenCountryCount > 0 ? (
        <details className="live-wave-disclosure">
          <summary>Show the rest</summary>
          <LiveWaveCountryRows countries={countryPreview.hiddenCountries} />
        </details>
      ) : null}
    </section>
  );
}

function App() {
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const activeSlot = getCurrentManifestWaveSlot(currentTime);
  const manifestWaveHourKey = getManifestWaveHourKey(currentTime);
  const activeZone = useMemo(() => getZoneBySlot(activeSlot, currentTime), [activeSlot, manifestWaveHourKey]);
  const activeCountries = useMemo(() => getCountriesInFivePmWave(currentTime), [manifestWaveHourKey]);
  const alertState = getManifestCallAlertState(currentTime);
  const [musicLibrary, setMusicLibrary] = useState(songs);
  const [selectedSongId, setSelectedSongId] = useState(songs[0]?.id || '');
  const [selectedLyrics, setSelectedLyrics] = useState('Select a song to view lyrics.');
  const [isNavMenuOpen, setIsNavMenuOpen] = useState(false);
  const navToggleRef = useRef<HTMLButtonElement | null>(null);
  const navMenuRef = useRef<HTMLDivElement | null>(null);
  const navMenuWasOpenRef = useRef(false);
  const selectedSong = musicLibrary.find((song) => song.id === selectedSongId) || musicLibrary[0];
  const accountNavItem = navigationItems.find((item) => item.href === '#member-auth');
  const menuNavigationItems = navigationItems.filter((item) => item.href !== '#member-auth');

  useEffect(() => {
    if (isNavMenuOpen) {
      navMenuWasOpenRef.current = true;
      window.setTimeout(() => navMenuRef.current?.focus(), 0);
      return;
    }

    if (navMenuWasOpenRef.current) {
      navMenuWasOpenRef.current = false;
      navToggleRef.current?.focus();
    }
  }, [isNavMenuOpen]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setCurrentTime(new Date()), 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (alertState.isActive) {
      document.body.dataset.call = 'active';
    } else {
      delete document.body.dataset.call;
    }

    return () => {
      delete document.body.dataset.call;
    };
  }, [alertState.isActive]);

  useEffect(() => {
    let isMounted = true;

    async function loadSongs() {
      const result = await fetchPublishedSongs(supabase as SongsClientLike | null);
      if (!isMounted) {
        return;
      }

      setMusicLibrary(result.songs);
      if (result.songs.length) {
        setSelectedSongId((currentId) => (result.songs.some((song) => song.id === currentId) ? currentId : result.songs[0].id));
      }
    }

    void loadSongs();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function loadLyrics(song: Song) {
      setSelectedLyrics(`Loading lyrics for ${song.title}…`);

      try {
        const response = await fetch(MASTER_LYRICS_PATH);
        if (!response.ok) {
          throw new Error(`Lyrics request failed with ${response.status}`);
        }

        const masterLyrics = await response.text();
        if (isMounted) {
          setSelectedLyrics(extractLyricsForTrack(masterLyrics, song.trackNumber, song.title));
        }
      } catch {
        if (isMounted) {
          setSelectedLyrics(`${song.title}\n\nLyrics are not available yet.`);
        }
      }
    }

    if (selectedSong) {
      void loadLyrics(selectedSong);
    }

    return () => {
      isMounted = false;
    };
  }, [selectedSong]);

  return (
    <main>
      <section className="hero">
        <nav className="nav" aria-label="Primary navigation">
          <a className="brand" href="#top" aria-label="Collective Manifestation home">
            <picture className="brand-mark">
              <source srcSet="/assets/brand/collective-manifestation-logo-64.webp" type="image/webp" />
              <img
                src="/assets/brand/collective-manifestation-logo-64.png"
                alt=""
                aria-hidden="true"
                width="64"
                height="64"
              />
            </picture>
            <span>Collective Manifestation</span>
          </a>
          {accountNavItem ? (
            <a className="nav-account-link mobile-account-link" href={accountNavItem.href}>
              {accountNavItem.label}
            </a>
          ) : null}
          <button
            aria-controls="primary-menu"
            aria-expanded={isNavMenuOpen}
            className="nav-menu-toggle"
            onClick={() => setIsNavMenuOpen((isOpen) => !isOpen)}
            ref={navToggleRef}
            type="button"
          >
            Menu
          </button>
          <div
            className={`nav-links${isNavMenuOpen ? ' is-open' : ''}`}
            id="primary-menu"
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setIsNavMenuOpen(false);
              }
            }}
            ref={navMenuRef}
            role={isNavMenuOpen ? 'dialog' : undefined}
            aria-label={isNavMenuOpen ? 'Primary menu' : undefined}
            aria-modal={isNavMenuOpen ? true : undefined}
            tabIndex={-1}
          >
            <button className="nav-menu-close" onClick={() => setIsNavMenuOpen(false)} type="button">
              Close menu
            </button>
            {menuNavigationItems.map((item) => (
              <a key={item.href} href={item.href} onClick={() => setIsNavMenuOpen(false)}>
                {item.label}
              </a>
            ))}
            {accountNavItem ? (
              <a className="nav-account-link desktop-account-link" href={accountNavItem.href}>
                {accountNavItem.label}
              </a>
            ) : null}
          </div>
        </nav>

        <div className="hero-grid" id="top">
          <div className="hero-copy">
            <p className="eyebrow">ManifestWave 528</p>
            <h1>A 24-hour global wave of focused intention.</h1>
            <p className="lede">
              A calm public home for the daily 5:28 Manifest Call: five focused minutes of
              shared intention, kindness, and hope moving through the world one time zone at a time.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#manifestwave">
                View today&apos;s wave
              </a>
              <a className="button secondary" href="#music">
                Explore the music
              </a>
            </div>
            <figure className="hero-art-frame" aria-label="Global intention artwork placeholder">
              <img
                alt="A diverse circle of people holding a glowing Earth together"
                decoding="async"
                height="960"
                loading="eager"
                sizes="(min-width: 900px) 480px, calc(100vw - 40px)"
                src="/assets/hero/manifestwave-global-placeholder-960.webp"
                srcSet="/assets/hero/manifestwave-global-placeholder-640.webp 640w, /assets/hero/manifestwave-global-placeholder-960.webp 960w"
                width="960"
              />
            </figure>
          </div>

          <aside className="now-card" aria-labelledby="current-wave-title">
            <p className="eyebrow">Current 5 PM wave zone</p>
            <h2 id="current-wave-title">{activeZone.label}</h2>
            <p>5:00 PM – 5:59 PM local wave window</p>
            <strong>5:28 PM Manifest Call</strong>
            <div className={alertState.isActive ? 'call-alert is-active' : 'call-alert'}>
              {alertState.isActive
                ? 'Please start the Intention for Manifestation video now.'
                : `Next 5:28 call in about ${alertState.minutesUntilNextCall} minutes.`}
            </div>
            <LiveWaveCountryPanel countries={activeCountries} />
          </aside>
        </div>
      </section>

      <section className="section intro" id="manifestwave">
        <div>
          <p className="eyebrow">ManifestWave tracker</p>
          <h2>Every hour, another region carries the intention.</h2>
        </div>
        <p>
          The ManifestWave follows the hour where local time is 5:00–5:59 PM. At 5:28 PM,
          visitors can start the guided intention video and carry the same message with their region.
          If they miss their local call, they can join any hour at 28 minutes past — it is always
          5:28 somewhere.
        </p>
      </section>

      <section className="section intention-section" aria-labelledby="intention-title">
        <div>
          <p className="eyebrow">Setting of intentions</p>
          <h2 id="intention-title">A five-minute practice visitors can follow from anywhere.</h2>
          <p>
            Five minutes, once a day, spoken at the same moment by everyone in your time zone.
            You don&apos;t need experience, and you don&apos;t need to believe anything.
          </p>
        </div>
        <WatchVideoBar />
      </section>

      <section className="section split" id="music">
        <div>
          <p className="eyebrow">Original music</p>
          <h2>Original music library</h2>
          <p>
            Original music written for the project. Free to listen to, and free for members to download.
          </p>
          <div className="song-list" aria-label="Original music tracks">
            {musicLibrary.map((song) => (
              <article
                className={song.id === selectedSong?.id ? 'song-card selected-song-card' : song.isThemeSong ? 'song-card theme-song-card' : 'song-card'}
                key={song.id}
                onClick={() => setSelectedSongId(song.id)}
              >
                <img className="song-artwork" src={song.artworkPath} alt={`${song.title} artwork`} loading="lazy" />
                <div className="song-details">
                  <span>{song.isThemeSong ? 'Theme Song' : `Track ${song.trackNumber}`}</span>
                  {song.isThemeSong ? <em>Official Theme Song</em> : null}
                  <strong>{song.title}</strong>
                </div>
                <audio controls preload="none" src={song.audioPath} onPlay={() => setSelectedSongId(song.id)}>
                  <a href={song.audioPath}>Download {song.title}</a>
                </audio>
              </article>
            ))}
          </div>
          <div className="lyrics-sidebar" aria-live="polite">
            <span>Lyrics</span>
            <h3>{selectedSong?.title || 'Select a song'}</h3>
            <pre>{selectedLyrics}</pre>
          </div>
        </div>
      </section>

      <section className="section split" id="members">
        <div>
          <p className="eyebrow">Members</p>
          <h2>Become a member.</h2>
          <p>
            Create a username, keep your check-ins, download the music, and join the message board.
          </p>
          <div className="member-feature-grid" aria-label="Planned member features">
            <article>
              <h3>Username profile</h3>
              <p>Public-facing member identity without exposing private email addresses.</p>
            </article>
            <article>
              <h3>Protected content</h3>
              <p>Member-only dashboard space for downloads, check-ins, and the message board.</p>
            </article>
          </div>
        </div>
        <div className="panel" id="member-auth">
          <strong>Members sign in / new members sign up</strong>
          <p>Members sign in. New members start here.</p>
          <MemberAuthPanel />
        </div>
      </section>

      <BlogSection />

      <section className="section split" id="about">
        <div>
          <p className="eyebrow">About</p>
          <h2>A simple daily rhythm for kindness, unity, and focused intention.</h2>
          <p>
            Collective Manifestation is built around one practical invitation: pause for a few minutes,
            set a clear intention for a better world, then return to the day with a lighter heart and an
            eye out for opportunities to be kind.
          </p>
          <div className="faq-grid" aria-label="Frequently asked questions">
            <article>
              <h3>What if I miss 5:28?</h3>
              <p>Join at 28 minutes past any hour. The wave is designed to keep moving around the world.</p>
            </article>
            <article>
              <h3>Do I need experience?</h3>
              <p>No. The guided video will keep the practice simple and accessible for first-time visitors.</p>
            </article>
            <article>
              <h3>Which 5:28?</h3>
              <p>The primary call is 5:28 PM in your local zone, with flexible hourly participation.</p>
            </article>
          </div>
        </div>
        <div className="panel" id="contact">
          <strong>Contact / waitlist</strong>
          <p>Questions, ideas, or an offer to help — this reaches us.</p>
          <ContactWaitlistForm />
        </div>
      </section>

      <section className="section support" id="support">
        <p className="eyebrow">Support</p>
        <h2>Support this work</h2>
        <p>
          Collective Manifestation is funded entirely by the people who use it. Every month we publish
          exactly what came in and what went out.
        </p>
        <span className="support-status">
          Donations open soon
        </span>
      </section>
    </main>
  );
}

export default App;
