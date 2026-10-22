/**
 * mediaProviders.ts - Embeddable Media Link Providers
 *
 * Maps a media link URL to a provider that knows how to preview and embed
 * it inline (see MediaLinkList.tsx's click-to-load preview card). Only
 * YouTube exists today; any URL no provider recognizes keeps rendering as
 * a plain "View on <Platform>" link (see mediaLinks.ts).
 *
 * ADDING A PROVIDER (Vimeo, SoundCloud, ...): write a parser that pulls the
 * provider's media id out of a URL, then append an entry to
 * MEDIA_PROVIDERS with its thumbnail and embed URL builders. Nothing in
 * the UI needs to change.
 */

export interface MediaProvider {
  /** Shown on the card ("YouTube") and in its "Open in ..." label. */
  name: string;
  /** Pulls the provider's media id out of a URL, or null if it isn't one. */
  parseId: (url: string) => string | null;
  /** Static preview image for the card - loaded before any embed. */
  getThumbnailUrl: (id: string) => string;
  /** iframe src, used only once the user clicks to play. */
  getEmbedUrl: (id: string) => string;
}

/** YouTube video ids are 11 characters of [A-Za-z0-9_-]. */
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

/**
 * Extracts the video id from a YouTube URL. Handles youtube.com/watch?v=,
 * youtu.be/<id>, /shorts/<id>, /embed/<id> (and /live/<id>), on www., m.,
 * music. and youtube-nocookie.com hosts. Extra params like si, t, and list
 * are ignored. Returns null for anything else, including playlist-only
 * URLs with no video id.
 */
export function parseYouTubeId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
  const segments = parsed.pathname.split('/').filter(Boolean);
  let id: string | null = null;

  if (hostname === 'youtu.be') {
    id = segments[0] ?? null;
  } else if (
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtube-nocookie.com'
  ) {
    if (segments[0] === 'watch') {
      id = parsed.searchParams.get('v');
    } else if (['shorts', 'embed', 'live', 'v'].includes(segments[0])) {
      id = segments[1] ?? null;
    }
  }

  return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
}

const YOUTUBE_PROVIDER: MediaProvider = {
  name: 'YouTube',
  parseId: parseYouTubeId,
  getThumbnailUrl: id => `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  // youtube-nocookie: no tracking cookies until the user actually plays.
  getEmbedUrl: id =>
    `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`,
};

const MEDIA_PROVIDERS: MediaProvider[] = [YOUTUBE_PROVIDER];

/** The provider that can embed `url`, plus its parsed id - or null. */
export function getEmbeddableMedia(
  url: string
): { provider: MediaProvider; id: string } | null {
  for (const provider of MEDIA_PROVIDERS) {
    const id = provider.parseId(url);
    if (id) return { provider, id };
  }
  return null;
}
