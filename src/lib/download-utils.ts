/**
 * Asset download utilities for the MONEY PRINTER 3000.
 *
 * Uses fetch-and-save approach to handle cross-origin URLs
 * where the HTML `download` attribute may be silently ignored.
 */

export async function downloadAsset(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Downloads multiple assets sequentially with a small delay between each
 * to avoid browser popup-blocking heuristics.
 */
export async function downloadAllAssets(
  items: { url: string; filename: string }[],
  delayMs = 400,
): Promise<void> {
  for (let i = 0; i < items.length; i++) {
    await downloadAsset(items[i].url, items[i].filename);
    if (i < items.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

// ---- Filename builders ----

export function keyframeFilename(projectNumber: number, segmentIndex: number, position: 'start' | 'end'): string {
  return `PROJECT-${projectNumber}_keyframe-seg${segmentIndex}-${position}.png`;
}

export function videoFilename(projectNumber: number, segmentIndex: number): string {
  return `PROJECT-${projectNumber}_video-seg${segmentIndex}.mp4`;
}

export function voiceFilename(projectNumber: number, segmentIndex: number): string {
  return `PROJECT-${projectNumber}_voice-seg${segmentIndex}.mp3`;
}

export function brollFilename(projectNumber: number, segmentIndex: number, shotIndex: number): string {
  return `PROJECT-${projectNumber}_broll-seg${segmentIndex}-shot${shotIndex}.png`;
}

export function finalVideoFilename(projectNumber: number): string {
  return `PROJECT-${projectNumber}_final-video.mp4`;
}
