// Vitest setup file
// Configures jsdom + Testing Library + Zustand store reset between tests

import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Limpia DOM y stores persistidos entre tests
beforeEach(() => {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.clear();
  }
});

afterEach(() => {
  cleanup();
});
