import { buildRabRequest, templateForProject, SOURCE } from "./rabInputs";
import { HOUSE_TEMPLATES, newProject, makeFloor } from "./project";

// Minimal catalogue: the input keys and fixed-volume items each template has.
const vol = (key) => ({ key, label: key, unit: "", input: true, default: 0 });
const item = (code, name, volume_key = null) => ({ code, name, volume_key, items: [] });
const ITEMS = [
  item("II.1", "Galian tanah pondasi", "GL"),
  item("VIII.1", "Pintu utama aluminium + kusen + kunci"),
  item("VIII.2", "Pintu kamar HPL + kusen aluminium (2 kamar + belakang)"),
  item("VIII.3", "Pintu KM PVC"),
  item("VIII.4", "Jendela aluminium + kaca"),
  item("X.1", "Kloset duduk + jet shower"),
  item("X.3", "Wastafel + kran"),
  item("X.4", "Floor drain"),
  item("XI.1", "Titik lampu + downlight"),
  item("XI.2", "Titik saklar / stop kontak"),
];
const CATALOG = {
  templates: [
    {
      key: "tipe36_1lantai",
      volumes: ["W", "D", "H", "LI", "OP", "OPW", "NB", "ANG", "OV", "NK", "TE", "CP", "PG", "GT", "KM", "KMW"].map(vol),
      items: ITEMS,
    },
    {
      key: "2lantai_lb108",
      volumes: ["W", "D", "H1", "H2", "LI1", "LI2", "OP1", "OP2", "OPW", "NB", "ANG", "OV", "NK", "NF", "BLEN", "VOID",
        "NKP1", "NKP2", "TG", "TGF", "RLT", "TE", "CP", "PG", "GT", "NKM", "KM1", "KMW1", "WPF"].map(vol),
      items: ITEMS,
    },
  ],
};

const template = (id) => HOUSE_TEMPLATES.find((t) => t.id === id).build();

describe("templateForProject", () => {
  it("maps floor count to a Buildora template", () => {
    expect(templateForProject(newProject({ floorCount: 1 }))).toBe("tipe36_1lantai");
    expect(templateForProject(newProject({ floorCount: 2 }))).toBe("2lantai_lb108");
    expect(templateForProject(newProject({ floorCount: 3 }))).toBeNull();
    expect(buildRabRequest(newProject({ floorCount: 3 }), CATALOG)).toBeNull();
  });
});

describe("buildRabRequest — empty drawing", () => {
  it("falls back to template defaults except roof settings", () => {
    const p = newProject({ floorCount: 1 });
    const b = buildRabRequest(p, CATALOG);
    expect(Object.keys(b.request.volumes).sort()).toEqual(["ANG", "OV"]);
    expect(b.volumeSources.W).toBe(SOURCE.template);
    expect(b.volumeSources.ANG).toBe(SOURCE.drawing);
    expect(b.request.item_volumes).toEqual({});
    expect(b.itemSources["VIII.1"]).toBe(SOURCE.template);
    expect(b.request.spec_class).toBe("Menengah");
  });

  it("only offers fixed-number items as item volumes", () => {
    const b = buildRabRequest(newProject({ floorCount: 1 }), CATALOG);
    expect(b.itemSources["II.1"]).toBeUndefined();
  });
});

describe("buildRabRequest — 1-level sample house (12 × 8 m, 2 toilets)", () => {
  const p = template("3b2b-1l");
  const b = buildRabRequest(p, CATALOG);
  const v = b.request.volumes;

  it("takes dimensions and walls from the drawing", () => {
    expect(v.W).toBe(8);
    expect(v.D).toBe(12);
    expect(v.H).toBe(3.2);
    expect(v.LI).toBeCloseTo(5 + 5 + 7 + 5); // the four interior segments
    expect(b.volumeSources.LI).toBe(SOURCE.drawing);
  });

  it("measures openings, columns and bathrooms", () => {
    // 1 door 0.9×2.1 + 2 windows 1.2×1.5
    expect(v.NB).toBe(3);
    expect(v.OP).toBeCloseTo(0.9 * 2.1 + 2 * 1.2 * 1.5);
    expect(v.OPW).toBeCloseTo(0.9 + 2 * 1.2);
    expect(v.NK).toBe(4);
    expect(v.KM).toBe(6);
    expect(v.KMW).toBeCloseTo(30.8);
    expect(v.PG).toBe(10); // land width
  });

  it("keeps template defaults for what the drawing cannot show", () => {
    expect(v.TE).toBeUndefined();
    expect(v.CP).toBeUndefined();
    expect(b.volumeSources.TE).toBe(SOURCE.template);
  });

  it("derives fixed item volumes from drawn elements", () => {
    const iv = b.request.item_volumes;
    expect(iv["VIII.1"]).toBe(1); // main door
    expect(iv["VIII.3"]).toBe(0); // 1 door total, so none left for bathrooms
    expect(iv["VIII.4"]).toBeCloseTo(2 * 1.2 * 1.5);
    expect(iv["X.1"]).toBe(2);
    expect(iv["X.3"]).toBe(2);
    expect(iv["X.4"]).toBeUndefined(); // no drains drawn -> template default
    expect(iv["XI.1"]).toBe(2);
    expect(iv["XI.2"]).toBe(1);
  });
});

describe("buildRabRequest — 2-level sample house", () => {
  const p = template("3b2b-2l");
  const b = buildRabRequest(p, CATALOG);
  const v = b.request.volumes;

  it("fills per-floor inputs", () => {
    expect(b.template).toBe("2lantai_lb108");
    expect(v.W).toBe(7);
    expect(v.D).toBe(10);
    expect(v.H1).toBe(3.2);
    expect(v.H2).toBe(3.2);
    expect(v.NKM).toBe(2);
    expect(v.WPF).toBe(4.5); // one toilet upstairs
    expect(v.NK).toBe(4); // 0.2 m corner columns are main columns
    expect(v.NF).toBe(4);
    expect(v.NKP1).toBeUndefined();
  });

  it("uses stairs and railings", () => {
    expect(v.VOID).toBeCloseTo(1.6 * 2.6);
    expect(v.TG).toBe(1.6);
    expect(v.TGF).toBe(10);
    expect(v.RLT).toBe(3);
  });
});

describe("buildRabRequest — manual overrides", () => {
  it("manual values win over drawing values and are per template", () => {
    const p = template("3b2b-1l");
    p.rab = {
      specClass: "Mewah",
      volumes: { tipe36_1lantai: { W: 9, TE: 6 }, "2lantai_lb108": { W: 99 } },
      itemVolumes: { tipe36_1lantai: { "VIII.1": 2 } },
      materialPrices: { GRN: 200000 },
      laborRates: { PKJ: 140000 },
      parameters: { margin: 0.2 },
      currentWeek: 3,
      stageProgress: { I: 1 },
    };
    const b = buildRabRequest(p, CATALOG);
    expect(b.request.volumes.W).toBe(9);
    expect(b.request.volumes.TE).toBe(6);
    expect(b.volumeSources.W).toBe(SOURCE.manual);
    expect(b.drawingVolumes.W).toBe(8);
    expect(b.request.item_volumes["VIII.1"]).toBe(2);
    expect(b.itemSources["VIII.1"]).toBe(SOURCE.manual);
    expect(b.request).toMatchObject({
      spec_class: "Mewah",
      material_prices: { GRN: 200000 },
      labor_rates: { PKJ: 140000 },
      parameters: { margin: 0.2 },
      current_week: 3,
      stage_progress: { I: 1 },
    });
  });
});

describe("buildRabRequest — fences and stray openings", () => {
  it("ignores fence walls and openings on them", () => {
    const p = newProject({ floorCount: 1 });
    const f = makeFloor(0);
    f.walls = [
      { id: "a", start: { x: 0, y: 0 }, end: { x: 6, y: 0 }, wallType: "exterior" },
      { id: "b", start: { x: 6, y: 0 }, end: { x: 6, y: 6 }, wallType: "exterior" },
      { id: "fence", start: { x: -5, y: -5 }, end: { x: 20, y: -5 }, wallType: "fence" },
    ];
    f.doors = [{ id: "d", wallId: "fence", width: 3, height: 2 }];
    p.floors = [f];
    const b = buildRabRequest(p, CATALOG);
    expect(b.request.volumes.D).toBe(6);
    expect(b.request.volumes.W).toBe(6);
    expect(b.request.volumes.NB).toBeUndefined();
  });
});
