/**
 * Where in Lagos.
 *
 * The customer was being asked to pick a *pricing zone* — "Lagos Island",
 * "Mainland central", "Outer Lagos" — which is the shop's own vocabulary and
 * not something anybody knows about their own house. They know their area and
 * their local government. So they pick that, and the zone and the fee are
 * worked out from it.
 *
 * **What this is, honestly.** All twenty Lagos State local governments, and
 * the areas within them that people actually name when they say where they
 * live. It is not a gazetteer: Lagos has thousands of named places and the
 * boundaries between them are argued over by people who live there. Where an
 * area straddles two local governments it is filed under the one most people
 * would say, and "somewhere else in <LGA>" catches the rest.
 *
 * **There are no streets here, deliberately.** Lagos has tens of thousands,
 * and a dropdown of invented ones is worse than a text field — the customer
 * either picks a street that does not exist or cannot find theirs and gives
 * up. Streets are typed, and the landmark underneath is what the rider
 * actually uses. Real street data means a geocoding service; see the README.
 */

export interface LagosArea {
  readonly name: string;
  readonly lga: string;
  /** Which delivery zone this falls in, and therefore what it costs. */
  readonly zoneId: string;
}

/** The twenty local government areas of Lagos State. */
export const LGAS: readonly string[] = [
  "Agege",
  "Ajeromi-Ifelodun",
  "Alimosho",
  "Amuwo-Odofin",
  "Apapa",
  "Badagry",
  "Epe",
  "Eti-Osa",
  "Ibeju-Lekki",
  "Ifako-Ijaiye",
  "Ikeja",
  "Ikorodu",
  "Kosofe",
  "Lagos Island",
  "Lagos Mainland",
  "Mushin",
  "Ojo",
  "Oshodi-Isolo",
  "Shomolu",
  "Surulere",
] as const;

/*
 * Zones are set per area rather than per local government, because Eti-Osa
 * alone spans the two most expensive ones: Ikoyi is a different run from
 * Sangotedo, and charging them the same is either losing money or losing the
 * customer.
 */
const A = (lga: string, zoneId: string, ...names: string[]): LagosArea[] =>
  names.map((name) => ({ name, lga, zoneId }));

export const AREAS: readonly LagosArea[] = [
  ...A("Lagos Island", "island",
    "Lagos Island", "Marina", "Broad Street", "Obalende", "Idumota", "Balogun",
    "Isale Eko", "Onikan", "Campos", "Elegbata", "Somewhere else on Lagos Island"),

  ...A("Eti-Osa", "island",
    "Victoria Island", "Ikoyi", "Oniru", "Banana Island", "Lekki Phase 1", "Lekki Phase 2"),

  ...A("Eti-Osa", "lekki-ajah",
    "Ajah", "Sangotedo", "Chevron", "Osapa London", "Agungi", "Ikate", "Jakande",
    "Ologolo", "Ilasan", "Igbo Efon", "Badore", "Addo", "Langbasa",
    "Abraham Adesanya", "Somewhere else in Eti-Osa"),

  ...A("Ibeju-Lekki", "lekki-ajah",
    "Awoyaya", "Bogije", "Lakowe", "Abijo", "Eleko", "Akodo", "Elemoro",
    "Lekki Free Trade Zone", "Somewhere else in Ibeju-Lekki"),

  ...A("Apapa", "island",
    "Apapa", "Ijora", "Sari Iganmu", "Marine Beach", "Liverpool", "Tin Can",
    "Somewhere else in Apapa"),

  ...A("Ikeja", "mainland-central",
    "Ikeja GRA", "Allen Avenue", "Opebi", "Oregun", "Alausa", "Maryland", "Ogba",
    "Agidingbi", "Omole Phase 1", "Omole Phase 2", "Adeniyi Jones", "Mangoro",
    "Onigbongbo", "Somewhere else in Ikeja"),

  ...A("Lagos Mainland", "mainland-central",
    "Yaba", "Ebute Metta", "Iwaya", "Makoko", "Oyingbo", "Alagomeji", "Sabo Yaba",
    "Akoka", "Abule Oja", "Adekunle", "Herbert Macaulay", "Somewhere else on the Mainland"),

  ...A("Surulere", "mainland-central",
    "Surulere", "Ojuelegba", "Aguda", "Ijeshatedo", "Itire", "Lawanson", "Masha",
    "Adeniran Ogunsanya", "Bode Thomas", "Iponri", "Coker", "Orile Iganmu",
    "Stadium", "Shitta", "Somewhere else in Surulere"),

  ...A("Shomolu", "mainland-central",
    "Shomolu", "Bariga", "Fadeyi", "Ilaje", "Pedro", "Gbagada", "Somewhere else in Shomolu"),

  ...A("Kosofe", "mainland-central",
    "Ketu", "Ojota", "Alapere", "Mile 12", "Ogudu", "Oworonshoki", "Ikosi",
    "Anthony", "Magodo Phase 1", "Magodo Phase 2", "Isheri Olowora", "Agboyi",
    "Owode Onirin", "Somewhere else in Kosofe"),

  ...A("Mushin", "mainland-central",
    "Mushin", "Ilupeju", "Papa Ajao", "Idi Oro", "Odi Olowo", "Ladipo",
    "Palm Avenue", "Somewhere else in Mushin"),

  ...A("Oshodi-Isolo", "mainland-central",
    "Oshodi", "Isolo", "Ejigbo", "Mafoluku", "Okota", "Ilasamaja", "Ajao Estate",
    "Bucknor", "Shogunle", "Ago Palace Way", "Somewhere else in Oshodi-Isolo"),

  ...A("Agege", "mainland-central",
    "Agege", "Dopemu", "Oko-Oba", "Orile Agege", "Papa Ashafa", "Tabon Tabon",
    "Isale Oja", "Somewhere else in Agege"),

  ...A("Ifako-Ijaiye", "mainland-central",
    "Ifako", "Ijaiye", "Ojokoro", "Agbado", "Iju Ishaga", "Abule Egba", "Fagba",
    "Alagbado", "Somewhere else in Ifako-Ijaiye"),

  ...A("Alimosho", "outer",
    "Ikotun", "Egbeda", "Idimu", "Ipaja", "Ayobo", "Akowonjo", "Igando",
    "Iyana Ipaja", "Abesan", "Isheri Olofin", "Meiran", "Shasha", "Command",
    "Gowon Estate", "Baruwa", "Somewhere else in Alimosho"),

  ...A("Amuwo-Odofin", "outer",
    "Festac Town", "Satellite Town", "Mile 2", "Amuwo Odofin", "Agboju",
    "Abule Ado", "Kirikiri", "Ijegun Egba", "Somewhere else in Amuwo-Odofin"),

  ...A("Ajeromi-Ifelodun", "outer",
    "Ajegunle", "Olodi Apapa", "Wilmer", "Layeni", "Alaba Oro", "Tolu", "Amukoko",
    "Somewhere else in Ajeromi-Ifelodun"),

  ...A("Ojo", "outer",
    "Ojo", "Okokomaiko", "Alaba International", "Iba", "Volkswagen", "Trade Fair",
    "Ijanikin", "Etegbin", "Ilogbo", "Somewhere else in Ojo"),

  ...A("Ikorodu", "outer",
    "Ikorodu", "Ijede", "Igbogbo", "Bayeku", "Imota", "Ipakodo", "Ebute Ikorodu",
    "Owutu", "Isawo", "Odogunyan", "Sabo Ikorodu", "Gberigbe", "Majidun",
    "Somewhere else in Ikorodu"),

  ...A("Badagry", "outer",
    "Badagry", "Ajara", "Topo", "Mowo", "Ibereko", "Iworo", "Seme", "Aradagun",
    "Gbaji", "Somewhere else in Badagry"),

  ...A("Epe", "outer",
    "Epe", "Ejirin", "Agbowa", "Ise", "Odomola", "Poka", "Ilara", "Itoikin",
    "Ibonwon", "Somewhere else in Epe"),
];

/** Areas in one local government, in the order they are listed. */
export function areasIn(lga: string): readonly LagosArea[] {
  return AREAS.filter((a) => a.lga === lga);
}

export function findArea(lga: string, name: string): LagosArea | undefined {
  return AREAS.find((a) => a.lga === lga && a.name === name);
}

/** The zone an area falls in, and therefore what delivery costs. */
export function zoneForArea(lga: string, name: string): string | undefined {
  return findArea(lga, name)?.zoneId;
}

/**
 * Search areas by name or by local government.
 *
 * Matches anywhere in the word rather than only at the start: somebody living
 * in Lekki Phase 1 types "lekki", and somebody who only knows their LGA types
 * "eti-osa" and wants the list. Exact and prefix matches come first, because
 * typing "ikeja" should not bury Ikeja GRA under everything in Ikeja.
 */
export function searchAreas(query: string, limit = 40): readonly LagosArea[] {
  const q = query.trim().toLowerCase();
  if (q === "") return AREAS.slice(0, limit);

  const scored: { area: LagosArea; score: number }[] = [];

  for (const area of AREAS) {
    const name = area.name.toLowerCase();
    const lga = area.lga.toLowerCase();

    let score = -1;
    if (name === q) score = 0;
    else if (name.startsWith(q)) score = 1;
    else if (name.includes(q)) score = 2;
    else if (lga.startsWith(q)) score = 3;
    else if (lga.includes(q)) score = 4;

    /*
      "Somewhere else in Alimosho" contains "alimosho", so searching a local
      government put the fallback above every real place in it. It is the last
      resort, so it sorts last — offering it first invites somebody to pick it
      when their actual area was two rows down.
    */
    if (score >= 0 && name.startsWith("somewhere else")) score += 10;

    if (score >= 0) scored.push({ area, score });
  }

  return scored
    .sort(
      (a, b) =>
        a.score - b.score ||
        // Shorter first on a tie: "Lekki Phase 1" is what someone typing
        // "lekki" usually means, not "Lekki Free Trade Zone".
        a.area.name.length - b.area.name.length ||
        a.area.name.localeCompare(b.area.name),
    )
    .slice(0, limit)
    .map((s) => s.area);
}

/** "Lekki Phase 1, Eti-Osa" — how it reads back on an order. */
export function formatArea(area: LagosArea): string {
  return `${area.name}, ${area.lga}`;
}
