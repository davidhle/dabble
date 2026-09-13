/**
 * mediaLinks.ts - Platform Label For A Media Link URL
 *
 * AddEntryForm.tsx's "Media Links" field accepts a URL from any platform
 * (YouTube, Vimeo, Instagram, TikTok, etc.) but always stores it with the
 * same `type: MediaType.Video` - there's no per-platform input for the
 * user to set that accurately, and the form has no way to know which
 * platform a given URL belongs to. That means a display label can't be
 * derived from `MediaLink.type` (every link says "Video" regardless of
 * where it actually goes) - this derives a platform label from the URL's
 * own hostname instead, which is accurate no matter what `type` says.
 *
 * Used by EntryPanel.tsx's Media Links section to render something more
 * useful than the raw URL - "View on Instagram" rather than
 * "https://instagram.com/p/...".
 */

/** hostname pattern -> the platform label to show for it. */
const PLATFORM_HOSTNAME_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /(^|\.)youtube\.com$|^youtu\.be$/, label: 'YouTube' },
  { pattern: /(^|\.)vimeo\.com$/, label: 'Vimeo' },
  { pattern: /(^|\.)instagram\.com$/, label: 'Instagram' },
  { pattern: /(^|\.)tiktok\.com$/, label: 'TikTok' },
  { pattern: /(^|\.)(twitter|x)\.com$/, label: 'X' },
  { pattern: /(^|\.)facebook\.com$/, label: 'Facebook' },
];

/**
 * Returns a "View on <Platform>" label for a media link URL, e.g.
 * "View on Instagram" - falls back to the generic "View Link" for an
 * unrecognized host or a URL that fails to parse, so a link with an
 * unfamiliar platform still renders something clickable rather than
 * nothing at all.
 */
export function getMediaLinkLabel(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const match = PLATFORM_HOSTNAME_PATTERNS.find(({ pattern }) =>
      pattern.test(hostname)
    );
    return match ? `View on ${match.label}` : 'View Link';
  } catch {
    // Not a parseable absolute URL - still render a link (the browser
    // will handle whatever the href actually resolves to), just with the
    // generic label instead of throwing or hiding the link entirely.
    return 'View Link';
  }
}
