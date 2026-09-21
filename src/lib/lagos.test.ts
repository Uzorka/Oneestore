import { describe, expect, it } from "vitest";

import { ZONES } from "./delivery";
import { AREAS, LGAS, areasIn, findArea, formatArea, searchAreas, zoneForArea } from "./lagos";

describe("the local governments", () => {
  it("are all twenty of them", () => {
    expect(LGAS).toHaveLength(20);
  });

  it("are listed once each", () => {
    expect(new Set(LGAS).size).toBe(LGAS.length);
  });

  it("each have areas under them", () => {
    for (const lga of LGAS) {
      expect(areasIn(lga).length, `${lga} has no areas`).toBeGreaterThan(0);
    }
  });

  it("each offer a way out for somewhere not listed", () => {
    // Lagos has thousands of named places. Somebody whose area is missing must
    // still be able to order, rather than picking a neighbourhood they do not
    // live in because it was the nearest thing on the list.
    for (const lga of LGAS) {
      const hasFallback = areasIn(lga).some((a) => a.name.toLowerCase().startsWith("somewhere else"));
      expect(hasFallback, `${lga} has no "somewhere else"`).toBe(true);
    }
  });
});

describe("the areas", () => {
  it("only sit in local governments that exist", () => {
    for (const area of AREAS) {
      expect(LGAS, `${area.name}`).toContain(area.lga);
    }
  });

  it("are not listed twice in the same local government", () => {
    const seen = new Set<string>();
    for (const area of AREAS) {
      const key = `${area.lga}:${area.name}`;
      expect(seen.has(key), `${key} listed twice`).toBe(false);
      seen.add(key);
    }
  });

  it("every one lands in a delivery zone that exists", () => {
    // An area with no zone is an address that cannot be quoted a price.
    const zoneIds = new Set(ZONES.map((z) => z.id));
    for (const area of AREAS) {
      expect(zoneIds.has(area.zoneId), `${area.name} -> ${area.zoneId}`).toBe(true);
    }
  });

  it("puts the far side of Eti-Osa in a different zone from Ikoyi", () => {
    // Eti-Osa alone spans the two dearest runs. Charging Ikoyi and Sangotedo
    // the same is either losing money or losing the customer.
    expect(zoneForArea("Eti-Osa", "Ikoyi")).toBe("island");
    expect(zoneForArea("Eti-Osa", "Sangotedo")).toBe("lekki-ajah");
  });

  it("covers every zone the shop delivers to", () => {
    const used = new Set(AREAS.map((a) => a.zoneId));
    for (const zone of ZONES) {
      expect(used.has(zone.id), `nothing is in ${zone.id}`).toBe(true);
    }
  });
});

describe("looking one up", () => {
  it("finds an area by its local government and name", () => {
    expect(findArea("Ikeja", "Opebi")?.zoneId).toBe("mainland-central");
    expect(findArea("Ikeja", "Nowhere")).toBeUndefined();
  });

  it("does not confuse two places with the same name in different councils", () => {
    // Several names repeat across Lagos; the pair is what identifies a place.
    const surulere = findArea("Surulere", "Itire");
    const mushin = findArea("Mushin", "Itire");

    expect(surulere).toBeDefined();
    expect(mushin).toBeUndefined();
  });

  it("reads back the way someone would say it", () => {
    expect(formatArea(findArea("Eti-Osa", "Lekki Phase 1") as never)).toBe("Lekki Phase 1, Eti-Osa");
  });
});

describe("searching", () => {
  it("finds a place by the start of its name", () => {
    const results = searchAreas("lekki");
    expect(results.some((a) => a.name === "Lekki Phase 1")).toBe(true);
  });

  it("finds a place by something in the middle of its name", () => {
    expect(searchAreas("ipaja").some((a) => a.name === "Iyana Ipaja")).toBe(true);
  });

  it("finds everything in a local government by its name", () => {
    const results = searchAreas("eti-osa", 100);
    expect(results.length).toBeGreaterThan(5);
    expect(results.every((a) => a.lga === "Eti-Osa")).toBe(true);
  });

  it("puts an exact name first rather than burying it", () => {
    // Typing "ikeja" should not bury Ikeja GRA under everything in Ikeja.
    const [first] = searchAreas("ikeja gra");
    expect(first?.name).toBe("Ikeja GRA");
  });

  it("ignores case and surrounding space", () => {
    expect(searchAreas("  AJAH ")[0]?.name).toBe("Ajah");
  });

  it("returns nothing for a place that is not in Lagos", () => {
    expect(searchAreas("Abuja")).toEqual([]);
  });

  it("offers the real places before the fallback", () => {
    // "Somewhere else in Alimosho" contains "alimosho" and was ranking above
    // every actual area in it, which invites the wrong answer.
    const [first] = searchAreas("alimosho");
    expect(first?.name).not.toMatch(/^somewhere else/i);
    expect(first?.lga).toBe("Alimosho");

    const results = searchAreas("alimosho", 100);
    expect(results[results.length - 1]?.name).toMatch(/^somewhere else/i);
  });

  it("puts the likely meaning first when several names share a prefix", () => {
    expect(searchAreas("lekki")[0]?.name).toBe("Lekki Phase 1");
  });

  it("gives something to start from before anything is typed", () => {
    expect(searchAreas("").length).toBeGreaterThan(0);
  });
});
