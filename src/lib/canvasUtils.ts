export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.8): Promise<Blob | null> {
  if (typeof canvas.toBlob === 'function') {
    return new Promise(resolve => {
      canvas.toBlob(resolve, type, quality);
    });
  }
  return Promise.resolve(null);
}

export async function canvasToDataUrl(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.8): Promise<string | null> {
  const blob = await canvasToBlob(canvas, type, quality);
  if (!blob) return null;
  return await new Promise<string | null>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
