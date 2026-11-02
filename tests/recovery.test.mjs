import test from "node:test";
import assert from "node:assert/strict";
import { createCheckpoint, continueCheckpoint, demoScenario } from "../dist/recovery.mjs";

function evidence(overrides = {}) {
  return { scope: createCheckpoint().scope, complete: true, mediaId: "media-demo", campaignIds: ["campaign-demo"], adIds: [], ...overrides };
}

test("confirmed campaign is reused; only the missing ad is simulated", () => {
  const checkpoint = createCheckpoint();
  const original = structuredClone(checkpoint);
  const result = continueCheckpoint(checkpoint, evidence(), { approved: true });
  assert.equal(result.status, "completed");
  assert.equal(result.mediaId, checkpoint.mediaId);
  assert.equal(result.campaignId, "campaign-demo");
  assert.deepEqual(result.writes, [{ action: "simulate_missing_ad", campaignId: "campaign-demo", adId: "ad-demo" }]);
  assert.deepEqual(checkpoint, original);
});

test("no explicit approval means no writes", () => {
  const result = continueCheckpoint(createCheckpoint(), evidence());
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.writes, []);
});

for (const [label, overrides] of [
  ["incomplete read", { complete: false }],
  ["foreign scope", { scope: "other-workspace/account-demo/launch-demo" }],
  ["wrong media identity", { mediaId: "other-media" }],
  ["missing campaign", { campaignIds: [] }],
  ["ambiguous campaign", { campaignIds: ["campaign-a", "campaign-b"] }],
  ["malformed campaign response", { campaignIds: null }],
  ["invalid campaign ID", { campaignIds: [""] }],
  ["ambiguous ads", { adIds: ["ad-a", "ad-b"] }],
  ["invalid ad ID", { adIds: [""] }],
  ["missing ad read", { adIds: undefined }],
]) {
  test(`${label}: fails closed`, () => {
    const result = continueCheckpoint(createCheckpoint(), evidence(overrides), { approved: true });
    assert.equal(result.status, "blocked");
    assert.deepEqual(result.writes, []);
  });
}

test("missing observation does not authorize a write", () => {
  const result = continueCheckpoint(createCheckpoint(), undefined, { approved: true });
  assert.equal(result.status, "blocked");
  assert.deepEqual(result.writes, []);
});

test("already existing ad is reused with no new simulated write", () => {
  const result = continueCheckpoint(createCheckpoint(), evidence({ adIds: ["ad-existing"] }), { approved: true });
  assert.equal(result.status, "completed");
  assert.equal(result.adId, "ad-existing");
  assert.deepEqual(result.writes, []);
});

test("completed checkpoint does not repeat its simulated step", () => {
  const completed = demoScenario("found");
  assert.deepEqual(continueCheckpoint(completed, evidence(), { approved: true }), completed);
});

test("cancellation survives checkpoint serialization", () => {
  const checkpoint = JSON.parse(JSON.stringify({ ...createCheckpoint(), canceled: true }));
  const result = continueCheckpoint(checkpoint, evidence(), { approved: true });
  assert.equal(result.status, "canceled");
  assert.equal(result.mediaId, "media-demo");
  assert.deepEqual(result.writes, []);
});

test("a persisted canceled status alone also prevents resume", () => {
  const result = continueCheckpoint({ ...createCheckpoint(), status: "canceled" }, evidence(), { approved: true });
  assert.equal(result.status, "canceled");
  assert.deepEqual(result.writes, []);
});

test("persisted campaign identity cannot be replaced silently", () => {
  const result = continueCheckpoint({ ...createCheckpoint(), campaignId: "saved-campaign" }, evidence(), { approved: true });
  assert.equal(result.status, "blocked");
  assert.equal(result.campaignId, "saved-campaign");
  assert.deepEqual(result.writes, []);
});

test("persisted ad identity cannot be replaced or recreated", () => {
  for (const adIds of [[], ["different-ad"]]) {
    const result = continueCheckpoint({ ...createCheckpoint(), adId: "saved-ad" }, evidence({ adIds }), { approved: true });
    assert.equal(result.status, "blocked");
    assert.equal(result.adId, "saved-ad");
    assert.deepEqual(result.writes, []);
  }
});

test("demonstration scenarios expose all three outcomes", () => {
  assert.equal(demoScenario("found").status, "completed");
  assert.equal(demoScenario("unknown").status, "blocked");
  assert.equal(demoScenario("canceled").status, "canceled");
  assert.throws(() => demoScenario("unrecognized"));
});
