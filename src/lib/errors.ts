/**
 * Thrown when a generation is cancelled by the user.
 * The worker catches this and exits cleanly without retrying.
 */
export class CancellationError extends Error {
  constructor(message = 'Generation cancelled by user') {
    super(message);
    this.name = 'CancellationError';
  }
}

/**
 * Thrown when a TikTok video download fails across all strategies.
 */
export class TikTokDownloadError extends Error {
  constructor(
    message: string,
    public readonly strategy: 'tikwm' | 'direct' | 'all',
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'TikTokDownloadError';
  }
}
