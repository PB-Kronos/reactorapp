/** Prevents a stalled network/database request from leaving a terminal or
 * control-room action permanently pending. Supabase requests are otherwise
 * allowed to use their normal client retry behaviour. */
export const withSupabaseTimeout = <T>(promise: PromiseLike<T>, operation: string, timeoutMs = 6_000): Promise<T> =>
  Promise.race([
    Promise.resolve(promise),
    new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error(`${operation} timed out. Check the Supabase project connection and try again.`)), timeoutMs)),
  ]);
