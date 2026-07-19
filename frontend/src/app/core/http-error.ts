export function extractErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const body = (err as { error?: { message?: string } }).error;
    if (body?.message) {
      return body.message;
    }
  }
  return 'Something went wrong. Please try again.';
}
