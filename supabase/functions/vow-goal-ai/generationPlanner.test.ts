import { assertEquals, assertThrows } from "jsr:@std/assert";
import { buildGenerationWindows, estimateOutputTokens, validateGeneratedWindow } from "./generationPlanner.ts";

Deno.test("long plans are split into bounded windows", () => {
  const windows = buildGenerationWindows({
    totalWeeks: 52, sessionsPerWeek: 4, complexity: 1, providerOutputLimit: 32768,
  });
  assertEquals(windows[0].startWeek, 1);
  assertEquals(windows.at(-1)?.endWeek, 52);
  assertEquals(windows.reduce((sum, window) => sum + window.weeks, 0), 52);
  if (windows.some(window => window.weeks > 8)) throw new Error("window exceeded 8 weeks");
});

Deno.test("token budgets scale with task size and respect provider limit", () => {
  const small = estimateOutputTokens({
    stage: "window", weeks: 2, sessionsPerWeek: 2, complexity: 1, providerOutputLimit: 32768,
  });
  const large = estimateOutputTokens({
    stage: "window", weeks: 8, sessionsPerWeek: 5, complexity: 1.4, providerOutputLimit: 32768,
  });
  assertEquals(large > small, true);
  assertEquals(estimateOutputTokens({
    stage: "window", weeks: 8, sessionsPerWeek: 7, complexity: 1.8, providerOutputLimit: 5000,
  }) <= 5000, true);
});

Deno.test("token estimator fails closed when provider limit is unknown", () => {
  assertThrows(() => estimateOutputTokens({
    stage: "window", weeks: 4, sessionsPerWeek: 3, complexity: 1, providerOutputLimit: 0,
  }), Error, "PROVIDER_OUTPUT_LIMIT_UNAVAILABLE");
});

Deno.test("window validator checks selected days and duplicate sessions", () => {
  const base = {
    expectedStartWeek: 1, expectedEndWeek: 1, selectedDays: ["Monday", "Thursday"],
    milestones: [{ week: 1, title: "Start" }],
  };
  assertEquals(validateGeneratedWindow({
    ...base,
    sessions: [
      { week: 1, day: "Monday", task: "Build baseline", milestone_week: 1 },
      { week: 1, day: "Thursday", task: "Review baseline", milestone_week: 1 },
    ],
  }), null);
  assertEquals(validateGeneratedWindow({
    ...base,
    sessions: [
      { week: 1, day: "Monday", task: "Build baseline" },
      { week: 1, day: "Monday", task: "Duplicate" },
    ],
  }), "DUPLICATE_SESSION");
});
