import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEMO_CAMPAIGNS, DEMO_CREATIVES, DEMO_ACCOUNTS, DEMO_STAGES,
  createLaunchDemo, selectCampaign, toggleCreative, toggleAccount,
  canContinue, nextStep, previousStep, summarizeDemo, startDemo, advanceDemo,
} from "../dist/launch-demo.mjs";

function draft({ campaignId = "store-es", creativeIds = ["studio", "detail", "story"], accountIds = ["DEMO-A1", "DEMO-A2"] } = {}) {
  let state = nextStep(selectCampaign(createLaunchDemo(), campaignId));
  for (const id of creativeIds) state = toggleCreative(state, id);
  state = nextStep(state);
  for (const id of accountIds) state = toggleAccount(state, id);
  return nextStep(state);
}

test("launch demo starts with no campaign and cannot skip selection", () => {
  const state = createLaunchDemo();
  assert.equal(state.step, "campaign");
  assert.equal(canContinue(state), false);
  assert.throws(() => nextStep(state));
  assert.throws(() => startDemo(state));
});

test("campaign selection is immutable and limited to fictional inventory", () => {
  const state = createLaunchDemo();
  const selected = selectCampaign(state, "store-br");
  assert.equal(state.campaignId, "");
  assert.equal(selected.campaignId, "store-br");
  assert.throws(() => selectCampaign(state, "foreign-campaign"));
});

test("empty creatives prevent continuing", () => {
  const state = nextStep(selectCampaign(createLaunchDemo(), "store-es"));
  assert.equal(canContinue(state), false);
  assert.throws(() => nextStep(state));
  assert.throws(() => toggleCreative(state, "foreign-media"));
});

test("creative choices toggle without duplicates or mutation", () => {
  const state = nextStep(selectCampaign(createLaunchDemo(), "store-es"));
  const selected = toggleCreative(state, "studio");
  assert.deepEqual(state.creativeIds, []);
  assert.deepEqual(selected.creativeIds, ["studio"]);
  assert.deepEqual(toggleCreative(selected, "studio").creativeIds, []);
});

test("no account selected means no launch plan", () => {
  let state = nextStep(selectCampaign(createLaunchDemo(), "store-es"));
  state = nextStep(toggleCreative(state, "studio"));
  assert.equal(canContinue(state), false);
  assert.throws(() => nextStep(state));
  assert.throws(() => summarizeDemo(state));
});

test("unavailable and unknown accounts cannot be selected", () => {
  let state = nextStep(selectCampaign(createLaunchDemo(), "store-es"));
  state = nextStep(toggleCreative(state, "studio"));
  assert.throws(() => toggleAccount(state, "DEMO-B2"));
  assert.throws(() => toggleAccount(state, "foreign-account"));
  assert.deepEqual(state.accountIds, []);
});

test("review requires a separate explicit start and preserves the plan", () => {
  const state = draft();
  assert.equal(state.step, "review");
  assert.equal(state.status, "draft");
  assert.deepEqual(state.results, []);
  assert.throws(() => nextStep(state));
  const running = startDemo(state);
  assert.equal(running.status, "running");
  assert.equal(state.status, "draft");
  assert.deepEqual(running.accountIds, state.accountIds);
});

test("three creatives across two accounts produce six ad sets and ads", () => {
  const plan = summarizeDemo(draft());
  assert.equal(plan.campaigns, 2);
  assert.equal(plan.adSets, 6);
  assert.equal(plan.ads, 6);
  assert.equal(plan.budgetPerAdSet, 5);
  assert.equal(plan.dailyBudget, 30);
});

test("alternative campaign and one-by-one allocation remain exact", () => {
  const plan = summarizeDemo(draft({ campaignId: "store-br", creativeIds: ["detail"], accountIds: ["DEMO-B1"] }));
  assert.equal(plan.campaign.country, "BR");
  assert.equal(plan.campaigns, 1);
  assert.equal(plan.ads, 1);
  assert.equal(plan.dailyBudget, 5);
});

test("back navigation retains choices for a corrected plan", () => {
  const state = draft();
  const accounts = previousStep(state);
  assert.equal(accounts.step, "accounts");
  assert.deepEqual(accounts.creativeIds, state.creativeIds);
  const corrected = nextStep(toggleAccount(accounts, "DEMO-A2"));
  assert.equal(summarizeDemo(corrected).dailyBudget, 15);
});

test("no results are claimed before every simulated stage finishes", () => {
  let state = startDemo(draft());
  for (let stage = 1; stage < DEMO_STAGES.length; stage += 1) {
    state = advanceDemo(state);
    assert.equal(state.status, "running");
    assert.equal(state.progress, stage);
    assert.deepEqual(state.results, []);
  }
  state = advanceDemo(state);
  assert.equal(state.status, "completed");
  assert.equal(state.results.length, 2);
  assert.equal(state.results[0].adIds.length, 3);
  assert.equal(state.results[1].adSetIds.length, 3);
  assert.equal(new Set(state.results.flatMap(row => row.adIds)).size, 6);
});

test("completed simulations do not duplicate results on another advance", () => {
  let state = startDemo(draft());
  for (const stage of DEMO_STAGES) state = advanceDemo(state);
  assert.equal(advanceDemo(state), state);
  assert.throws(() => startDemo(state));
});

test("editing and backward navigation are prohibited during a run", () => {
  const state = startDemo(draft());
  assert.equal(canContinue(state), false);
  assert.throws(() => previousStep(state));
  assert.throws(() => selectCampaign(state, "store-br"));
  assert.throws(() => toggleCreative(state, "story"));
  assert.throws(() => toggleAccount(state, "DEMO-B1"));
});

test("unknown, duplicate and blocked IDs fail closed even in a forged plan", () => {
  for (const override of [{ campaignId: "unknown" }, { creativeIds: ["unknown"] },
    { creativeIds: ["studio", "studio"] }, { accountIds: ["DEMO-B2"] },
    { accountIds: ["DEMO-A1", "DEMO-A1"] }]) {
    assert.throws(() => startDemo({ ...draft(), ...override }));
  }
});

test("reset returns a clean draft without retaining earlier results", () => {
  assert.deepEqual(createLaunchDemo(), { step: "campaign", campaignId: "", creativeIds: [], accountIds: [], status: "draft", progress: 0, results: [] });
  assert.equal(Object.isFrozen(DEMO_CAMPAIGNS), true);
  assert.equal(Object.isFrozen(DEMO_CREATIVES), true);
  assert.equal(Object.isFrozen(DEMO_ACCOUNTS), true);
});

test("only the demo section is replaced, with explicit simulation boundaries", () => {
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const app = readFileSync(new URL("../dist/app.js", import.meta.url), "utf8");
  assert.ok(!html.includes("RECOVERY LAB"));
  assert.ok(html.includes("Упрощённая симуляция, не рабочий интерфейс"));
  assert.ok(html.includes("Время выполнения условное"));
  assert.ok(html.includes('id="architecture"'));
  assert.ok(html.includes('id="role"'));
  assert.ok(app.includes('import("./launch-demo.mjs")'));
  for (const [, id] of app.matchAll(/getElementById\("([^"]+)"\)/g)) assert.ok(html.includes(`id="${id}"`), `Missing demo node ${id}`);
});
