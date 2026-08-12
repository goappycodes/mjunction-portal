/**
 * Order rollback (dev/test tool — see src/app/actions/rollback.ts) must never
 * be reachable in production, regardless of who is logged in. Gated by an env
 * var (not NODE_ENV) so it can be deliberately enabled on a staging box too.
 * Checked server-side only; never inline this into client bundles.
 */
export const ORDER_ROLLBACK_ENABLED = process.env.ENABLE_ORDER_ROLLBACK === 'true';
