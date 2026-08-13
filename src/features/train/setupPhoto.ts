import { createId } from '../../domain/ids';
import type { ExerciseSetupPhoto } from '../../domain/model';

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.72;
const FALLBACK_QUALITY = 0.58;
const MAX_DATA_URL_LENGTH = 2_500_000;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The selected image could not be opened.'));
    };
    image.src = url;
  });
}

function scaledSize(width: number, height: number) {
  const longest = Math.max(width, height);
  if (longest <= MAX_EDGE) return { width, height };
  const scale = MAX_EDGE / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

function encode(canvas: HTMLCanvasElement, quality: number): string {
  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  if (!dataUrl.startsWith('data:image/jpeg;base64,')) {
    throw new Error('The image could not be converted to JPEG.');
  }
  return dataUrl;
}

export async function compressSetupPhoto(file: File): Promise<ExerciseSetupPhoto> {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file.');
  const image = await loadImage(file);
  const size = scaledSize(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Image processing is unavailable on this device.');
  context.drawImage(image, 0, 0, size.width, size.height);

  let dataUrl = encode(canvas, JPEG_QUALITY);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) dataUrl = encode(canvas, FALLBACK_QUALITY);
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    throw new Error('This image is still too large after compression. Try a lower-resolution photo.');
  }

  return {
    id: createId('setup_photo'),
    dataUrl,
    createdAt: new Date().toISOString(),
    width: size.width,
    height: size.height,
  };
}
