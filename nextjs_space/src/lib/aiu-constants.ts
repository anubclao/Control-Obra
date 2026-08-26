// Helper extraido de aiu-store.ts
export function validateAiu(admin: number, imprev: number, util: number): {
  ok: boolean;
  total: number;
  message?: string;
} {
  const total = admin + imprev + util;
  if (Math.abs(total - 100) > 0.01) {
    return { ok: false, total, message: "La suma debe ser exactamente 100% (actual: " + total.toFixed(2) + "%)" };
  }
  return { ok: true, total };
}
