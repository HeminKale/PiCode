import test from "node:test";
import assert from "node:assert/strict";
import { createSyntheticShopFixture } from "../src/index.js";

test("synthetic shop fixture creates 100 products with a stable, known promotion signal", () => {
  const fixture = createSyntheticShopFixture({ customerCount: 3, weekCount: 8, seed: 7 });
  assert.equal(fixture.productIds.length, 100);
  assert.equal(fixture.customerIds.length, 3);
  assert.equal(fixture.rowCount, 2_400);
  assert.equal(fixture.knownPromotionUpliftUnits, 9);
  assert.equal(fixture.salesCsv.split("\n").length - 2, fixture.rowCount);
  assert.equal(fixture.calendarCsv.split("\n").length - 2, 8);
});
