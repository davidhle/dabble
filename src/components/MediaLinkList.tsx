/**
 * MediaLinkList.tsx - Media Links In The Sidebar, With Inline Players
 *
 * Renders an entry's (or reflection's) mediaLinks. A link an embed
 * provider recognizes (see utils/mediaProviders.ts - YouTube today)
 * becomes a preview card; anything else stays the plain "View on
 * <Platform>" link it always was (see utils/mediaLinks.ts).
 *
 * CLICK-TO-LOAD: a card starts as just a static thumbnail. The iframe -
 * and with it every request to the provider's player - only exists once
 * the user clicks play, so opening an entry stays fast and no player
 * loads for videos nobody watches.
 *
 * ONE PLAYER AT A TIME: which card (if any) is playing lives in
 * ActivePlayerProvider, which FocusedEntryView.tsx wraps around both tabs.
 * Clicking play on one card replaces whatever was playing, and changing
 * the provider's `resetKey` (entry, tab, or sidebar collapse) stops it.
 */

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MediaLink } from '../types/Entry';
import { getMediaLinkLabel } from '../utils/mediaLinks';
import { getEmbeddableMedia, MediaProvider } from '../utils/mediaProviders';
import { LINK_CLASSNAME } from '../utils/linkify';

interface ActivePlayerState {
  activeKey: string | null;
  setActiveKey: (key: string | null) => void;
}

const ActivePlayerContext = createContext<ActivePlayerState | null>(null);

/**
 * Holds the single active player. Any change to `resetKey` stops it - in
 * the same render (the stored key is tagged with the resetKey it was
 * started under, so a stale one never matches), and the effect then
 * clears it for good so it doesn't resume if the key changes back (e.g.
 * collapsing then re-expanding the sidebar).
 */
export function ActivePlayerProvider({
  resetKey,
  children,
}: {
  resetKey: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState<{
    key: string;
    resetKey: string;
  } | null>(null);

  useEffect(() => {
    setActive(null);
  }, [resetKey]);

  const value = useMemo<ActivePlayerState>(
    () => ({
      activeKey: active?.resetKey === resetKey ? active.key : null,
      setActiveKey: key => setActive(key ? { key, resetKey } : null),
    }),
    [active, resetKey]
  );

  return (
    <ActivePlayerContext.Provider value={value}>
      {children}
    </ActivePlayerContext.Provider>
  );
}

/**
 * Falls back to per-list local state when there's no provider, so a list
 * rendered outside FocusedEntryView still works (just without the
 * cross-list one-at-a-time guarantee).
 */
function useActivePlayer(): ActivePlayerState {
  const context = useContext(ActivePlayerContext);
  const [localKey, setLocalKey] = useState<string | null>(null);
  return context ?? { activeKey: localKey, setActiveKey: setLocalKey };
}

interface MediaLinkListProps {
  mediaLinks: MediaLink[];
  /**
   * Unique per list on screen (e.g. "entry", or a reflection id) - card
   * keys are `${scope}:${index}`, so two lists never share a player key.
   */
  scope: string;
}

export default function MediaLinkList({
  mediaLinks,
  scope,
}: MediaLinkListProps) {
  const { activeKey, setActiveKey } = useActivePlayer();

  return (
    <div className="flex flex-col gap-2">
      {mediaLinks.map((media, index) => {
        const embeddable = getEmbeddableMedia(media.url);
        if (!embeddable) {
          return (
            <a
              key={index}
              href={media.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`text-sm ${LINK_CLASSNAME}`}
            >
              {getMediaLinkLabel(media.url)}
            </a>
          );
        }

        const key = `${scope}:${index}`;
        return (
          <EmbedPreviewCard
            key={index}
            media={media}
            provider={embeddable.provider}
            mediaId={embeddable.id}
            isPlaying={activeKey === key}
            onPlay={() => setActiveKey(key)}
          />
        );
      })}
    </div>
  );
}

function getHostnameLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * YouTube serves a 120x90 grey placeholder (with a 404 status that not
 * every browser treats as an image error) for removed/private videos -
 * the real hqdefault thumbnail is 480x360. Anything this narrow counts as
 * a failed thumbnail.
 */
const PLACEHOLDER_THUMBNAIL_MAX_WIDTH = 120;

interface EmbedPreviewCardProps {
  media: MediaLink;
  provider: MediaProvider;
  mediaId: string;
  isPlaying: boolean;
  onPlay: () => void;
}

function EmbedPreviewCard({
  media,
  provider,
  mediaId,
  isPlaying,
  onPlay,
}: EmbedPreviewCardProps) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const label = media.title || getHostnameLabel(media.url);

  // Private/removed video: no preview to show, and likely nothing to
  // play either - degrade to a plain styled link card.
  if (thumbnailFailed) {
    return (
      <a
        href={media.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-[var(--panel-border-color)] bg-[var(--field-tint-1)] px-3 py-2 text-sm hover:bg-[var(--field-tint-2)]"
      >
        <ExternalLinkIcon />
        <span className="min-w-0 flex-1 truncate text-[var(--text-secondary-color)]">
          {label}
        </span>
        <span className="flex-shrink-0 text-xs text-[var(--text-muted-color)]">
          {getMediaLinkLabel(media.url)}
        </span>
      </a>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--panel-border-color)] bg-[var(--field-tint-1)]">
      <div className="relative aspect-video w-full bg-black">
        {isPlaying ? (
          <iframe
            src={provider.getEmbedUrl(mediaId)}
            title={label}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <button
            type="button"
            onClick={onPlay}
            aria-label={`Play ${label} on ${provider.name}`}
            className="group absolute inset-0 h-full w-full"
          >
            <img
              src={provider.getThumbnailUrl(mediaId)}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
              onError={() => setThumbnailFailed(true)}
              onLoad={event => {
                if (
                  event.currentTarget.naturalWidth <=
                  PLACEHOLDER_THUMBNAIL_MAX_WIDTH
                ) {
                  setThumbnailFailed(true);
                }
              }}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition-colors group-hover:bg-black/25 motion-reduce:transition-none">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/70 text-white shadow-lg transition-transform group-hover:scale-110 group-focus-visible:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100">
                <svg
                  className="ml-0.5 h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5">
        <span className="min-w-0 flex-1 truncate text-xs text-[var(--text-muted-color)]">
          {label}
        </span>
        <a
          href={media.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open in ${provider.name}`}
          title={`Open in ${provider.name}`}
          className="flex-shrink-0 rounded p-1 text-[var(--text-muted-color)] hover:bg-[var(--field-tint-2)] hover:text-[var(--text-color)]"
        >
          <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="h-3.5 w-3.5 flex-shrink-0"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
      />
    </svg>
  );
}
