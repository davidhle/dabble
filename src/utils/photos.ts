/**
 * photos.ts - In-Browser Photo Downscaling For Entry Attachments
 *
 * Photos are stored inline on the entry as JPEG data URLs (see EntryPhoto
 * in types/Entry.ts) since there's no backend - so every photo has to be
 * shrunk before it lands in localStorage's ~5MB quota. A typical 12MP
 * phone photo (3-5MB) comes out of here at roughly 150-300KB.
 *
 * EXIF ORIENTATION: phone cameras often store pixels sideways plus an EXIF
 * "rotate me" flag. Drawing the raw pixels to a canvas would lose that flag
 * (the re-encoded JPEG carries no EXIF), baking in a sideways photo -
 * createImageBitmap's `imageOrientation: 'from-image'` applies the
 * rotation while decoding, so the canvas gets upright pixels.
 */

import { EntryPhoto } from '../types/Entry';

/** Longest side, in pixels, a stored photo is downscaled to. */
const MAX_PHOTO_DIMENSION = 1400;

/** JPEG re-encode quality - visually clean while keeping files small. */
const JPEG_QUALITY = 0.82;

/**
 * Decodes `file` with EXIF orientation applied. Falls back to an <img>
 * element where createImageBitmap is missing or rejects the options -
 * modern browsers apply EXIF orientation to <img> by default too
 * (CSS `image-orientation: from-image`).
 */
async function decodeImage(file: File): Promise<CanvasImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path below.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function getSourceSize(source: CanvasImageSource): {
  width: number;
  height: number;
} {
  if (source instanceof HTMLImageElement) {
    return { width: source.naturalWidth, height: source.naturalHeight };
  }
  const { width, height } = source as ImageBitmap;
  return { width, height };
}

/**
 * Turns a picked image file into an EntryPhoto: decoded upright, scaled so
 * its longest side is at most MAX_PHOTO_DIMENSION (never upscaled), and
 * re-encoded as JPEG. Rejects if the browser can't decode the file (e.g.
 * HEIC outside Safari) - the caller reports that per file.
 */
export async function processPhotoFile(file: File): Promise<EntryPhoto> {
  const source = await decodeImage(file);
  const { width, height } = getSourceSize(source);
  if (!width || !height) throw new Error('Image has no dimensions');

  const scale = Math.min(1, MAX_PHOTO_DIMENSION / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');

  // JPEG has no alpha - paint white first so a transparent PNG doesn't
  // come out with a black background.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, 0, 0, canvas.width, canvas.height);

  if ('close' in source && typeof source.close === 'function') {
    source.close();
  }

  return {
    id: crypto.randomUUID(),
    dataUrl: canvas.toDataURL('image/jpeg', JPEG_QUALITY),
  };
}

/**
 * Keeps only well-formed photos from untrusted data (an imported file):
 * a string id and an image data URL, plus a string caption if any.
 * Returns undefined when nothing valid remains, so the entry simply has
 * no `photos` field - the same as an entry that never had photos.
 */
export function sanitizePhotos(value: unknown): EntryPhoto[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const photos = value.flatMap((item): EntryPhoto[] => {
    if (typeof item !== 'object' || item === null) return [];
    const candidate = item as Record<string, unknown>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.dataUrl !== 'string' ||
      !candidate.dataUrl.startsWith('data:image/')
    ) {
      return [];
    }
    return [
      {
        id: candidate.id,
        dataUrl: candidate.dataUrl,
        ...(typeof candidate.caption === 'string' && candidate.caption
          ? { caption: candidate.caption }
          : {}),
      },
    ];
  });

  return photos.length > 0 ? photos : undefined;
}
