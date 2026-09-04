import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CitySchema, CourtDefinitionSchema, DistrictSchema, MetroStationSchema } from "@ss/shared";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => JSON.parse(readFileSync(path.join(root, p), "utf8"));
const list = (dir: string) => readdirSync(path.join(root, dir)).filter((f) => f.endsWith(".json"));
const locale = read("locales/es.json") as Record<string, string>;

/** Content is data (§78, §125): every file must validate and every nameKey must be localized (§86). */
describe("content: santiago-street", () => {
  const city = CitySchema.parse(read("cities/santiago-street/city.json"));
  const districts = list("cities/santiago-street/districts").map((f) => DistrictSchema.parse(read(`cities/santiago-street/districts/${f}`)));
  const courts = list("cities/santiago-street/courts").map((f) => CourtDefinitionSchema.parse(read(`cities/santiago-street/courts/${f}`)));
  const stations = list("cities/santiago-street/metro").map((f) => MetroStationSchema.parse(read(`cities/santiago-street/metro/${f}`)));

  it("references resolve", () => {
    for (const d of city.districtIds) expect(districts.some((x) => x.id === d)).toBe(true);
    for (const d of districts) {
      expect(d.cityId).toBe(city.id);
      for (const c of d.courtIds) expect(courts.some((x) => x.id === c && x.districtId === d.id)).toBe(true);
      for (const s of d.metroStationIds) expect(stations.some((x) => x.id === s)).toBe(true);
    }
  });

  it("every nameKey has a Spanish string", () => {
    const keys = [city.nameKey, city.metroBrandKey, ...districts.map((d) => d.nameKey), ...courts.map((c) => c.nameKey), ...stations.flatMap((s) => [s.nameKey, s.lineId])];
    for (const k of keys) expect(locale[k], `missing locale for ${k}`).toBeTruthy();
  });

  it("first district has exactly one main court and one secondary (§7)", () => {
    expect(courts.filter((c) => c.tags.includes("main"))).toHaveLength(1);
    expect(courts.filter((c) => c.tags.includes("secondary"))).toHaveLength(1);
  });
});
