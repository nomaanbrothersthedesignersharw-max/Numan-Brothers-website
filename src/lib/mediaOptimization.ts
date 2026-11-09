export interface MediaPreparation {
  file: File;
  originalBytes: number;
  preparedBytes: number;
  compressed: boolean;
  format: 'webp' | 'original';
}

const MAX_IMAGE_EDGE = 2400;
const WEBP_QUALITY = 0.84;
const SKIP_COMPRESSION_BELOW = 512 * 1024;

function webpName(name: string): string {
  const stem = name.replace(/\.[^.]*$/, '').trim() || 'image';
  return stem.slice(0, 200) + '.webp';
}

/**
 * Compress still photographs in the browser before sending them to Storage.
 * Animated GIFs and all videos are left byte-for-byte unchanged. If the
 * browser cannot decode/encode an image or WebP is not smaller, retain the
 * original file rather than risking a broken garment photograph.
 */
export async function prepareMediaFile(file: File): Promise<MediaPreparation> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return {
      file, originalBytes: file.size, preparedBytes: file.size,
      compressed: false, format: 'original',
    };
  }

  const canDecode = typeof globalThis.createImageBitmap === 'function';
  if (!canDecode) {
    return {
      file, originalBytes: file.size, preparedBytes: file.size,
      compressed: false, format: 'original',
    };
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(1, longestEdge));
    if (file.size <= SKIP_COMPRESSION_BELOW && scale === 1) {
      return {
        file, originalBytes: file.size, preparedBytes: file.size,
        compressed: false, format: 'original',
      };
    }

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    let blob: Blob | null = null;

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(width, height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image canvas is unavailable');
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
    } else if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Image canvas is unavailable');
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
    }

    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) {
      return {
        file, originalBytes: file.size, preparedBytes: file.size,
        compressed: false, format: 'original',
      };
    }

    const prepared = new File([blob], webpName(file.name), {
      type: 'image/webp',
      lastModified: file.lastModified,
    });
    return {
      file: prepared, originalBytes: file.size, preparedBytes: prepared.size,
      compressed: true, format: 'webp',
    };
  } catch {
    return {
      file, originalBytes: file.size, preparedBytes: file.size,
      compressed: false, format: 'original',
    };
  } finally {
    bitmap?.close();
  }
}
