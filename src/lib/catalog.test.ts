import { describe, expect, it } from "vitest";

import {
  EMPTY_CATALOG_STATE,
  changeCount,
  discardDraft,
  draftProducts,
  parseCatalog,
  pendingChanges,
  publish,
  publishedProducts,
  serializeCatalog,
  stageEdit,
} from "./catalog";
import { naira } from "./money";
import { products } from "./seed";

const priceOf = (list: readonly { id: string; pricePerKgKobo: number }[], id: string) =>
  list.find((p) => p.id === id)?.pricePerKgKobo;

const seedCroaker = products.find((p) => p.id === "croaker") as (typeof products)[number];

describe("draft and published", () => {
  it("leaves the storefront alone while the shop is still typing", () => {
    const state = stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) });

    // The customer is mid-sentence. Nothing has changed for them.
    expect(priceOf(publishedProducts(state), "croaker")).toBe(seedCroaker.pricePerKgKobo);
    // The shop sees its own working copy.
    expect(priceOf(draftProducts(state), "croaker")).toBe(naira(12_000));
  });

  it("moves the whole morning's board live in one act", () => {
    let state = stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) });
    state = stageEdit(state, "titus", { pricePerKgKobo: naira(7000) });
    expect(changeCount(state)).toBe(2);

    state = publish(state, 1_700_000_000_000);

    expect(priceOf(publishedProducts(state), "croaker")).toBe(naira(12_000));
    expect(priceOf(publishedProducts(state), "titus")).toBe(naira(7000));
    expect(changeCount(state)).toBe(0);
    expect(state.publishedAt).toBe(1_700_000_000_000);
  });

  it("does nothing on publish when there is nothing to publish", () => {
    const state = { ...EMPTY_CATALOG_STATE, publishedAt: 123 };
    expect(publish(state, 999)).toBe(state);
  });

  it("throws the draft away without touching what is live", () => {
    let state = stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) });
    state = publish(state, 1);
    state = stageEdit(state, "croaker", { pricePerKgKobo: naira(20_000) });

    const back = discardDraft(state);
    expect(changeCount(back)).toBe(0);
    expect(priceOf(publishedProducts(back), "croaker")).toBe(naira(12_000));
  });
});

describe("counting changes honestly", () => {
  it("does not count typing the same price back in", () => {
    const state = stageEdit(EMPTY_CATALOG_STATE, "croaker", {
      pricePerKgKobo: seedCroaker.pricePerKgKobo,
    });

    // A board claiming a change when nothing differs teaches the shop to
    // ignore the number.
    expect(changeCount(state)).toBe(0);
    expect(pendingChanges(state)).toEqual([]);
  });

  it("stops counting when an edit is undone back to the live value", () => {
    let state = stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) });
    expect(changeCount(state)).toBe(1);

    state = stageEdit(state, "croaker", { pricePerKgKobo: seedCroaker.pricePerKgKobo });
    expect(changeCount(state)).toBe(0);
  });

  it("measures a change against what is live, not against the seed", () => {
    let state = publish(stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) }), 1);
    state = stageEdit(state, "croaker", { pricePerKgKobo: naira(13_000) });

    const [change] = pendingChanges(state);
    expect(change?.from).toBe(naira(12_000));
    expect(change?.to).toBe(naira(13_000));
  });

  it("keeps several fields on one product as one staged edit", () => {
    let state = stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) });
    state = stageEdit(state, "croaker", { stockG: 4000 });

    expect(changeCount(state)).toBe(1);
    expect(pendingChanges(state)).toHaveLength(2);
    expect(priceOf(draftProducts(state), "croaker")).toBe(naira(12_000));
    expect(draftProducts(state).find((p) => p.id === "croaker")?.stockG).toBe(4000);
  });

  it("ignores a product that is not in the catalog", () => {
    expect(stageEdit(EMPTY_CATALOG_STATE, "unicorn", { stockG: 10 })).toEqual(EMPTY_CATALOG_STATE);
  });
});

describe("taking a product off the board", () => {
  it("hides it from the storefront once published", () => {
    const state = publish(stageEdit(EMPTY_CATALOG_STATE, "croaker", { availability: "hidden" }), 1);
    expect(publishedProducts(state).find((p) => p.id === "croaker")?.availability).toBe("hidden");
  });
});

describe("persistence", () => {
  it("round-trips", () => {
    let state = stageEdit(EMPTY_CATALOG_STATE, "croaker", { pricePerKgKobo: naira(12_000) });
    state = publish(state, 42);
    state = stageEdit(state, "titus", { stockG: 9000 });

    expect(parseCatalog(serializeCatalog(state))).toEqual(state);
  });

  it("falls back to seed prices rather than taking the shop down", () => {
    expect(parseCatalog(null)).toEqual(EMPTY_CATALOG_STATE);
    expect(parseCatalog("not json")).toEqual(EMPTY_CATALOG_STATE);
    expect(parseCatalog(JSON.stringify({ v: 99 }))).toEqual(EMPTY_CATALOG_STATE);
  });

  it("refuses a price that would pay the customer to take the fish", () => {
    const raw = JSON.stringify({
      v: 1,
      published: { croaker: { pricePerKgKobo: -5000 } },
      draft: {},
      publishedAt: null,
    });

    expect(parseCatalog(raw).published).toEqual({});
    expect(priceOf(publishedProducts(parseCatalog(raw)), "croaker")).toBe(seedCroaker.pricePerKgKobo);
  });

  it("refuses a fractional price, and a status it has never heard of", () => {
    const raw = JSON.stringify({
      v: 1,
      published: {
        croaker: { pricePerKgKobo: 980_050.5 },
        titus: { availability: "maybe" },
      },
      draft: {},
      publishedAt: null,
    });

    expect(parseCatalog(raw).published).toEqual({});
  });

  it("drops overrides for products that no longer exist", () => {
    const raw = JSON.stringify({
      v: 1,
      published: { unicorn: { stockG: 500 } },
      draft: {},
      publishedAt: null,
    });

    expect(parseCatalog(raw).published).toEqual({});
  });

  it("allows zero stock, which is a real thing to say", () => {
    const raw = JSON.stringify({ v: 1, published: { croaker: { stockG: 0 } }, draft: {}, publishedAt: null });
    expect(parseCatalog(raw).published).toEqual({ croaker: { stockG: 0 } });
  });
});
