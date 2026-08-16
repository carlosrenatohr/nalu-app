import "@testing-library/jest-dom/vitest";
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Sin globals:true, RTL no limpia solo; limpiamos después de cada test.
afterEach(() => {
  cleanup();
});
