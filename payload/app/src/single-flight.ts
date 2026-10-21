/** Concurrent readers share one request; completion/failure allows a fresh request. */
export function singleFlight<T>(work: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) pending = Promise.resolve().then(work).finally(() => { pending = null; });
    return pending;
  };
}
