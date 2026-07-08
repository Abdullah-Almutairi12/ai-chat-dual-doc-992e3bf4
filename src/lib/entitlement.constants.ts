/** Number of PDFs a brand-new user may process completely for free. */
export const FREE_FILE_LIMIT = 1;

export type EntitlementSnapshot = {
  filesProcessed: number;
  freeLimit: number;
  subscribed: boolean;
  remaining: number | null;
  allowed: boolean;
};

export function defaultFreeEntitlement(): EntitlementSnapshot {
  return {
    filesProcessed: 0,
    freeLimit: FREE_FILE_LIMIT,
    subscribed: false,
    remaining: FREE_FILE_LIMIT,
    allowed: true,
  };
}
