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
