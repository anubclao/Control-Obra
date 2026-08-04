// VERIFIER: WorkCut REJECT Requires Non-Empty Reason
// BUG FIX: #5

import { describe, it, expect, beforeEach } from "vitest";
import { useCutsStore } from "@/lib/cuts-store";

describe("useCutsStore — REJECT requires rejectionReason", () => {
  beforeEach(() => {
    useCutsStore.setState({ cuts: useCutsStore.getInitialState().cuts });
  });

  it("AC-1: REJECT sin rejectionReason debe fallar", () => {
    const submittedCut = useCutsStore
      .getState()
      .cuts.find((c) => c.status === "SUBMITTED");
    expect(submittedCut).toBeDefined();

    const result = useCutsStore.getState().performAction(
      submittedCut!.id,
      "REJECT",
      { id: "u-admin", name: "Admin", role: "ADMIN" },
      // sin rejectionReason
    );

    expect(result.ok).toBe(false);
    expect(result.error?.toLowerCase()).toContain("motivo");
  });

  it("AC-2: REJECT con rejectionReason solo whitespace debe fallar", () => {
    const submittedCut = useCutsStore
      .getState()
      .cuts.find((c) => c.status === "SUBMITTED");
    expect(submittedCut).toBeDefined();

    const result = useCutsStore.getState().performAction(
      submittedCut!.id,
      "REJECT",
      { id: "u-admin", name: "Admin", role: "ADMIN" },
      undefined,
      "   \n  \t  ", // whitespace only
    );

    expect(result.ok).toBe(false);
    expect(result.error?.toLowerCase()).toContain("motivo");
  });

  it("AC-3: REJECT con rejectionReason válido debe funcionar", () => {
    const submittedCut = useCutsStore
      .getState()
      .cuts.find((c) => c.status === "SUBMITTED");
    expect(submittedCut).toBeDefined();

    const result = useCutsStore
      .getState()
      .performAction(
        submittedCut!.id,
        "REJECT",
        { id: "u-admin", name: "Admin", role: "ADMIN" },
        undefined,
        "Cantidades infladas",
      );

    expect(result.ok).toBe(true);
    const after = useCutsStore.getState().getCut(submittedCut!.id);
    expect(after?.rejectionReason).toBe("Cantidades infladas");
  });
});
