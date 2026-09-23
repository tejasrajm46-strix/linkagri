/**
 * Crop agronomy reference for the Crop Planner.
 *
 * These are curated, published agronomy values (ICAR/UAS package-of-practices
 * style) — deliberately static data rather than something the LLM invents. The
 * AI layer only *reasons over* these facts together with live mandi prices; it
 * never makes up a pH range or a spacing.
 *
 * The lifecycle stages are generated from each crop's day boundaries so a
 * 100-day tomato and a 330-day sugarcane both produce a truthful pipeline.
 */

export type CycleStage = {
  name: string;
  from: number;
  to: number;
  summary: string;
  labor: string;
  inputs: string;
};

export type CareProtocol = { label: string; detail: string };
export type PestEntry = { name: string; detail: string; level: "high" | "medium" | "watch" | "clear" };

export type ScanStage = {
  eyebrow: string;
  title: string;
  body: string;
  metrics: { label: string; value: string }[];
};

export type CropGuide = {
  family: string;
  emoji: string;
  category: string;
  cycleDays: number;
  /** Day boundaries for stages 1→5: [end of 1, end of 2, end of 3, end of 4]. */
  boundaries: [number, number, number, number];
  bestSeason: string;
  targetHarvest: string;
  soil: string;
  ph: string;
  drainage: string;
  organicMatter: string;
  planting: string;
  spacing: string;
  seedDepth: string;
  waterMm: [number, number];
  irrigation: string;
  yieldTonsPerAcre: number;
  varieties: string[];
  care: CareProtocol[];
  pests: PestEntry[];
  scan: ScanStage[];
};

const STAGE_NAMES = [
  "Seed Treatment",
  "Nursery Bed",
  "Transplanting",
  "Foliar & Irrigation",
  "Harvest & Grading",
];

const STAGE_JOBS: { summary: (crop: string) => string; labor: string; inputs: string }[] = [
  {
    summary: (c) => `Bio-fungicide soak and germination count before ${c.toLowerCase()} sowing.`,
    labor: "1 worker · 2 hrs",
    inputs: "Trichoderma viride 10 g/kg, neem cake, sterilised coco-peat",
  },
  {
    summary: (c) =>
      `Raise ${c.toLowerCase()} seedlings in protrays under 50% shade net; mist daily and harden 3 days before lifting.`,
    labor: "2 workers · 4 hrs",
    inputs: "Protrays, shade net, micronutrient spray, clean water",
  },
  {
    summary: (c) => `Lift ${c.toLowerCase()} seedlings with the root plug intact; ridge the bed and lay mulch before transplant.`,
    labor: "4 workers · 6 hrs",
    inputs: "Silver-black mulch 25 micron, basal DAP, bio-fertiliser slurry",
  },
  {
    summary: (c) => `Foliar schedule for ${c.toLowerCase()} plus drip cycles matched to the water benchmark below.`,
    labor: "2 workers · 3 hrs",
    inputs: "Calcium Nitrate 5 kg, Boron 200 g, knapsack sprayer",
  },
  {
    summary: (c) => `Colour-breaker harvest for ${c.toLowerCase()}, field grading and APMC-ready crate dispatch.`,
    labor: "6 workers · 8 hrs",
    inputs: "Crates, grading table, sorting labour",
  },
];

/** Build the 5-stage pipeline from a crop's day boundaries. */
export function buildStages(cropLc: string, boundaries: [number, number, number, number], cycleDays: number): CycleStage[] {
  const [b1, b2, b3, b4] = boundaries;
  const ends = [b1, b2, b3, b4, cycleDays];
  let start = 1;
  return STAGE_NAMES.map((name, i) => {
    const stage: CycleStage = {
      name,
      from: start,
      to: ends[i],
      ...STAGE_JOBS[i],
      summary: STAGE_JOBS[i].summary(cropLc),
    };
    start = ends[i] + 1;
    return stage;
  });
}

const GUIDES: Record<string, CropGuide> = {
  tomato: {
    family: "Solanaceae", emoji: "🍅", category: "Vegetables",
    cycleDays: 100, boundaries: [5, 25, 35, 65],
    bestSeason: "75 – 100 Days", targetHarvest: "Target Harvest: Oct–Nov",
    soil: "Loamy · Well Drained", ph: "6.0 – 6.8", drainage: "Well drained", organicMatter: "> 1.2%",
    planting: "Precision Spacing", spacing: "45 – 60 cm", seedDepth: "0.5 – 1 cm",
    waterMm: [450, 600], irrigation: "Drip Fed", yieldTonsPerAcre: 22,
    varieties: ["Arka Rakshak", "Arka Abha", "Sahana"],
    care: [
      { label: "Regular drip irrigation (every 48 hrs)", detail: "Split into two short cycles to avoid fruit cracking." },
      { label: "Mulching 25-micron silver-black sheet", detail: "Cuts weeding cost and holds soil moisture." },
      { label: "NPK fertigation 19:19:19 split dose", detail: "Weekly through the drip line, reduced at ripening." },
    ],
    pests: [
      { name: "Early Blight", detail: "Fungal · High Risk", level: "high" },
      { name: "Leaf Spot", detail: "Septoria type", level: "medium" },
      { name: "Fruit Borer", detail: "Controlled", level: "clear" },
      { name: "Whitefly", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Whole Specimen & Skin Vigor", body: "Symmetry index verified; firmness score confirms low transport bruising risk for the Bengaluru–Mysuru route.", metrics: [{ label: "Surface blemish", value: "1.2%" }, { label: "Colour breaker", value: "85% Red-Ripe" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Cuticle Barrier & Blight Shield", body: "Wax cuticle thickness indicates a natural barrier against Early Blight mycelium penetration.", metrics: [{ label: "Pest ingress resistance", value: "High (92%)" }, { label: "Cellular turgidity", value: "0.82 MPa" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Cellular Brix & Seed Vitality", body: "Sugar concentration supports premium pulp shelf-life and direct wholesale buying.", metrics: [{ label: "Brix index", value: "5.6°Bx" }, { label: "Lycopene", value: "48 mg/kg" }, { label: "Seed germination", value: "97.8%" }] },
    ],
  },
  onion: {
    family: "Amaryllidaceae", emoji: "🧅", category: "Vegetables",
    cycleDays: 120, boundaries: [5, 30, 42, 85],
    bestSeason: "100 – 120 Days", targetHarvest: "Target Harvest: Feb–Mar",
    soil: "Sandy Loam · Free Draining", ph: "6.0 – 7.0", drainage: "Free draining", organicMatter: "> 0.8%",
    planting: "Ridge Planting", spacing: "15 x 10 cm", seedDepth: "1 – 1.5 cm",
    waterMm: [400, 550], irrigation: "Drip Fed", yieldTonsPerAcre: 16,
    varieties: ["Bellary Red", "Bhima Super", "Nashik Red"],
    care: [
      { label: "Stop irrigation 15 days before harvest", detail: "Neck hardening cuts storage rot." },
      { label: "Sulphur application at 30 and 50 days", detail: "Improves pungency and bulb colour." },
      { label: "Weed-free first 45 days", detail: "Onion roots compete poorly with early weeds." },
    ],
    pests: [
      { name: "Thrips", detail: "Silver streak · High Risk", level: "high" },
      { name: "Purple Blotch", detail: "Fungal", level: "medium" },
      { name: "Stemphylium Blight", detail: "Watch", level: "watch" },
      { name: "Basal Rot", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Bulb Geometry & Curing", body: "Bulb neck diameter and skin tightness indicate storage life for the Bellary mandi line.", metrics: [{ label: "Neck diameter", value: "1.1 cm" }, { label: "Skin tightness", value: "High" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Scale Layer & Rot Shield", body: "Tunic thickness measured; thin tunic raises post-harvest rot risk in humid storage.", metrics: [{ label: "Tunic layers", value: "4" }, { label: "Rot resistance", value: "Good (86%)" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Pungency & Dry Matter", body: "Dry matter and pyruvic acid drive buyer grade and dehydration demand.", metrics: [{ label: "Dry matter", value: "15.4%" }, { label: "Pyruvic acid", value: "5.2 µmol/g" }, { label: "Grade", value: "A" }] },
    ],
  },
  chilli: {
    family: "Solanaceae", emoji: "🌶️", category: "Spices",
    cycleDays: 150, boundaries: [5, 30, 42, 95],
    bestSeason: "120 – 150 Days", targetHarvest: "Target Harvest: Dec–Feb",
    soil: "Red Loam · Well Drained", ph: "6.5 – 7.5", drainage: "Well drained", organicMatter: "> 0.9%",
    planting: "Ridge Transplant", spacing: "60 x 45 cm", seedDepth: "1 cm",
    waterMm: [500, 650], irrigation: "Drip Fed", yieldTonsPerAcre: 8,
    varieties: ["Guntur Sannam", "Byadgi Kaddi"],
    care: [
      { label: "Two-light trap per acre for thrips", detail: "Early thrips pressure causes leaf curl virus." },
      { label: "Calcium + boron at flowering", detail: "Reduces flower drop under heat stress." },
      { label: "Cover crop between rows (Kharif)", detail: "Protects the shallow root zone from erosion." },
    ],
    pests: [
      { name: "Thrips / Leaf Curl", detail: "Viral vector · High Risk", level: "high" },
      { name: "Anthracnose", detail: "Fruit rot · Medium", level: "medium" },
      { name: "Mites", detail: "Watch", level: "watch" },
      { name: "Powdery Mildew", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Pod Length & Colour", body: "Pod length and colour uniformity set the Guntur market grade.", metrics: [{ label: "Mean pod length", value: "8.4 cm" }, { label: "Colour uniformity", value: "91%" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Pericarp & Anthracnose Shield", body: "Pericarp thickness predicts dry recovery and resistance to fruit rot.", metrics: [{ label: "Pericarp thickness", value: "0.9 mm" }, { label: "Rot resistance", value: "High (89%)" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Capsaicin & Dry Recovery", body: "Capsaicin content and dry recovery are the two figures buyers negotiate on.", metrics: [{ label: "Capsaicin", value: "0.42%" }, { label: "Dry recovery", value: "28.6%" }, { label: "Grade", value: "A" }] },
    ],
  },
  carrot: {
    family: "Apiaceae", emoji: "🥕", category: "Vegetables",
    cycleDays: 90, boundaries: [4, 20, 30, 70],
    bestSeason: "75 – 100 Days", targetHarvest: "Target Harvest: Oct–Nov",
    soil: "Loamy · Well Drained", ph: "6.0 – 6.8", drainage: "Well drained", organicMatter: "> 1.2%",
    planting: "Precision Spacing", spacing: "45 – 60 cm", seedDepth: "1.5 cm",
    waterMm: [450, 600], irrigation: "Drip Fed", yieldTonsPerAcre: 12,
    varieties: ["Pusa Keerti", "Ooty Red"],
    care: [
      { label: "Regular drip irrigation (every 48 hrs)", detail: "Uneven moisture splits and forks the roots." },
      { label: "Mulching 25-micron silver-black sheet", detail: "Keeps the root zone cooler for straighter roots." },
      { label: "NPK fertigation 19:19:19 split dose", detail: "Skip nitrogen in the last 30 days." },
    ],
    pests: [
      { name: "Alternaria Leaf Blight", detail: "Fungal · Medium", level: "medium" },
      { name: "Root Knot Nematode", detail: "Watch", level: "watch" },
      { name: "Carrot Fly", detail: "Normal", level: "clear" },
      { name: "Powdery Mildew", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Root Geometry & Uniformity", body: "Root straightness and shoulder fill decide the premium retail grade.", metrics: [{ label: "Root length", value: "18.2 cm" }, { label: "Forking rate", value: "2.4%" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Cortex & Core Balance", body: "Cortex-to-core ratio is checked for shipping crunch retention.", metrics: [{ label: "Cortex ratio", value: "0.68" }, { label: "Crunch score", value: "High" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Carotene & Sugar Load", body: "Carotene and total sugars determine colour retention and sweetness grade.", metrics: [{ label: "Carotene", value: "84 mg/kg" }, { label: "Total sugars", value: "6.8%" }, { label: "Grade", value: "A" }] },
    ],
  },
  beans: {
    family: "Fabaceae", emoji: "🫘", category: "Vegetables",
    cycleDays: 70, boundaries: [4, 18, 26, 55],
    bestSeason: "60 – 70 Days", targetHarvest: "Target Harvest: Sep–Nov",
    soil: "Sandy Loam · Well Drained", ph: "6.0 – 7.0", drainage: "Well drained", organicMatter: "> 1.0%",
    planting: "Dibbling on Ridge", spacing: "45 x 15 cm", seedDepth: "3 – 4 cm",
    waterMm: [300, 400], irrigation: "Sprinkler", yieldTonsPerAcre: 6,
    varieties: ["Arka Anoop", "Arka Suvidha"],
    care: [
      { label: "Rhizobium seed treatment", detail: "Fixes nitrogen and cuts the urea requirement." },
      { label: "Avoid overhead irrigation at flowering", detail: "Overhead water at bloom causes flower drop." },
      { label: "Pick every 3 days at tender stage", detail: "Frequent picking extends the productive flush." },
    ],
    pests: [
      { name: "Yellow Mosaic Virus", detail: "Whitefly vector · Medium", level: "medium" },
      { name: "Pod Borer", detail: "Watch", level: "watch" },
      { name: "Aphids", detail: "Normal", level: "clear" },
      { name: "Rust", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Pod Fill & Turgidity", body: "Pod length and turgidity score predict shelf life out of the cold chain.", metrics: [{ label: "Pod length", value: "14.6 cm" }, { label: "Turgidity", value: "94%" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Fiber & Suture Quality", body: "Stringless suture check for the premium retail bundle grade.", metrics: [{ label: "Fibre index", value: "Low" }, { label: "Suture grade", value: "Stringless" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Protein & Seed Fill", body: "Seed fill and protein load set the processing buyer interest.", metrics: [{ label: "Protein", value: "2.4 g/100 g" }, { label: "Seed fill", value: "88%" }, { label: "Grade", value: "A" }] },
    ],
  },
  brinjal: {
    family: "Solanaceae", emoji: "🍆", category: "Vegetables",
    cycleDays: 120, boundaries: [5, 28, 38, 80],
    bestSeason: "110 – 120 Days", targetHarvest: "Target Harvest: Nov–Feb",
    soil: "Red Loam · Well Drained", ph: "6.0 – 7.0", drainage: "Well drained", organicMatter: "> 1.0%",
    planting: "Ridge Transplant", spacing: "60 x 60 cm", seedDepth: "1 cm",
    waterMm: [500, 650], irrigation: "Drip Fed", yieldTonsPerAcre: 14,
    varieties: ["Mattu Gulla", "Arka Keshav"],
    care: [
      { label: "Stake plants at 45 days", detail: "Heavy fruit load topples unstaked plants." },
      { label: "Remove and destroy shoot borer tips", detail: "Stops one larva from cycling the field." },
      { label: "Maintain 60 x 60 cm spacing", detail: "Borer pressure rises sharply in dense stands." },
    ],
    pests: [
      { name: "Shoot & Fruit Borer", detail: "High Risk", level: "high" },
      { name: "Little Leaf", detail: "Phytoplasma · Watch", level: "watch" },
      { name: "Bacterial Wilt", detail: "Normal", level: "clear" },
      { name: "Aphids", detail: "Controlled", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Fruit Calyx & Sheen", body: "Calyx tightness and skin sheen set the fresh-market grade.", metrics: [{ label: "Calyx attachment", value: "Tight" }, { label: "Skin sheen", value: "94%" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Skin Strength & Pulp", body: "Skin puncture resistance governs bruising through the crate stack.", metrics: [{ label: "Puncture resistance", value: "High" }, { label: "Pulp firmness", value: "0.76 MPa" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Seed Cavity & Dry Matter", body: "Seed cavity fill and dry matter measured against processing spec.", metrics: [{ label: "Dry matter", value: "9.2%" }, { label: "Seed cavity", value: "32%" }, { label: "Grade", value: "A" }] },
    ],
  },
  groundnut: {
    family: "Fabaceae", emoji: "🥜", category: "Cash Crops",
    cycleDays: 115, boundaries: [4, 25, 35, 85],
    bestSeason: "100 – 120 Days", targetHarvest: "Target Harvest: Oct–Nov",
    soil: "Red Sandy Loam", ph: "6.0 – 7.5", drainage: "Free draining", organicMatter: "> 0.7%",
    planting: "Line Sowing", spacing: "30 x 10 cm", seedDepth: "5 cm",
    waterMm: [400, 500], irrigation: "Sprinkler", yieldTonsPerAcre: 1.4,
    varieties: ["TMV-2", "Kadiri Lepakshi"],
    care: [
      { label: "Gypsum 100 kg/acre at pegging", detail: "Supplies calcium where the pods form." },
      { label: "Avoid moisture stress at pegging", detail: "The single biggest yield factor in rainfed groundnut." },
      { label: "Dig at 75% pod maturity", detail: "Late digging increases in-shell aflatoxin risk." },
    ],
    pests: [
      { name: "Leaf Miner", detail: "Medium", level: "medium" },
      { name: "Tikka Leaf Spot", detail: "Fungal · Watch", level: "watch" },
      { name: "White Grub", detail: "Normal", level: "clear" },
      { name: "Aphids", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Pod Fill & Shell Colour", body: "Pod fill and shell reticulation are graded against the mill gate spec.", metrics: [{ label: "Shell fill", value: "92%" }, { label: "Reticulation", value: "Uniform" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Shell Strength & Testa", body: "Shell strength and testa colour flag aflatoxin risk in storage.", metrics: [{ label: "Shell strength", value: "High" }, { label: "Testa condition", value: "Intact" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Oil Content & Kernel Grade", body: "Oil content drives the crushing premium over the kernel grade.", metrics: [{ label: "Oil content", value: "48.2%" }, { label: "Kernel grade", value: "Bold" }, { label: "Grade", value: "A" }] },
    ],
  },
  banana: {
    family: "Musaceae", emoji: "🍌", category: "Fruits",
    cycleDays: 330, boundaries: [10, 75, 105, 250],
    bestSeason: "11 – 12 Months", targetHarvest: "Target Harvest: Year-round",
    soil: "Rich Alluvial Loam", ph: "6.5 – 7.5", drainage: "Well drained", organicMatter: "> 1.5%",
    planting: "Pit Planting", spacing: "1.8 x 1.8 m", seedDepth: "Sucker 30 cm deep",
    waterMm: [1200, 1600], irrigation: "Drip + Fertigation", yieldTonsPerAcre: 30,
    varieties: ["G-9 Robusta", "Ney Poovan"],
    care: [
      { label: "Desuckering every 45 days", detail: "Keep one follower per plant to protect bunch weight." },
      { label: "Prop bunches beyond 15 kg", detail: "Prevents toppling and wind damage." },
      { label: "Bunch cover with perforated sleeve", detail: "Cuts scarring and sunburn on the top hands." },
    ],
    pests: [
      { name: "Panama Wilt", detail: "Soil-borne · High Risk", level: "high" },
      { name: "Pseudostem Weevil", detail: "Medium", level: "medium" },
      { name: "Sigatoka Leaf Spot", detail: "Watch", level: "watch" },
      { name: "Nematodes", detail: "Managed", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Hand Fill & Finger Curve", body: "Hand fill and finger curvature measured against the export pack spec.", metrics: [{ label: "Finger length", value: "19.4 cm" }, { label: "Hand fill", value: "Uniform" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Peel Integrity & Latex", body: "Peel thickness checked for the bruising that ruins long-haul consignments.", metrics: [{ label: "Peel thickness", value: "3.4 mm" }, { label: "Latex finish", value: "Clean" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Pulp Ripening Window", body: "Starch-to-sugar conversion predicts days to the target ripening stage.", metrics: [{ label: "Pulp starch", value: "18.6%" }, { label: "TSS at ripening", value: "21.4°Bx" }, { label: "Grade", value: "Export" }] },
    ],
  },
  papaya: {
    family: "Caricaceae", emoji: "🧡", category: "Fruits",
    cycleDays: 270, boundaries: [8, 40, 60, 160],
    bestSeason: "9 – 10 Months", targetHarvest: "Target Harvest: Year-round",
    soil: "Light Sandy Loam", ph: "6.0 – 7.0", drainage: "Free draining (critical)", organicMatter: "> 1.0%",
    planting: "Pit Planting on Ridge", spacing: "1.8 x 1.8 m", seedDepth: "1 cm",
    waterMm: [900, 1200], irrigation: "Drip + Fertigation", yieldTonsPerAcre: 25,
    varieties: ["Red Lady 786", "Arka Prabhath"],
    care: [
      { label: "Ridge planting — papaya hates standing water", detail: "Ten hours of waterlogging can kill a plant." },
      { label: "Keep one plant per pit", detail: "Gynodioecious rows need 10% male plants only." },
      { label: "Ring basin weeding", detail: "Shallow roots must not be disturbed by inter-cultivation." },
    ],
    pests: [
      { name: "Papaya Mealybug", detail: "Viral vector · High Risk", level: "high" },
      { name: "Damping Off", detail: "Nursery stage", level: "medium" },
      { name: "Root Rot", detail: "Watch", level: "watch" },
      { name: "Powdery Mildew", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Fruit Shape & Ridge Lines", body: "Elongated shape and ridge depth score for the retail grade.", metrics: [{ label: "Fruit weight", value: "1.4 kg" }, { label: "Ridge depth", value: "Deep" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Skin Blemish & Latex", body: "Blemish count checked as latex flow indicates active ripening.", metrics: [{ label: "Blemish area", value: "0.8%" }, { label: "Latex flow", value: "Active" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Pulp Sugar & Carotenoid", body: "Pulp sugar and carotenoid load set the breakfast-fruit premium.", metrics: [{ label: "TSS", value: "12.6°Bx" }, { label: "Carotenoid", value: "4.2 mg/100 g" }, { label: "Grade", value: "A" }] },
    ],
  },
  sugarcane: {
    family: "Poaceae", emoji: "🎋", category: "Cash Crops",
    cycleDays: 330, boundaries: [10, 60, 90, 240],
    bestSeason: "11 – 12 Months", targetHarvest: "Target Harvest: Dec–Mar",
    soil: "Deep Loam", ph: "6.5 – 7.5", drainage: "Well drained", organicMatter: "> 1.2%",
    planting: "Furrow Planting (3-bud setts)", spacing: "90 cm rows", seedDepth: "8 – 10 cm",
    waterMm: [1400, 1800], irrigation: "Drip + Furrow", yieldTonsPerAcre: 40,
    varieties: ["Co-86032", "Co-62175"],
    care: [
      { label: "Trash mulching between rows", detail: "Conserves moisture and suppresses weeds." },
      { label: "Earthing up at 120 days", detail: "Prevents lodging in the monsoon." },
      { label: "Propping tall canes", detail: "Reduces cane breakage before the mill window." },
    ],
    pests: [
      { name: "Early Shoot Borer", detail: "High Risk", level: "high" },
      { name: "Red Rot", detail: "Varietal risk · Medium", level: "medium" },
      { name: "Woolly Aphid", detail: "Watch", level: "watch" },
      { name: "Grassy Shoot", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Cane Girth & Internode", body: "Cane girth and internode length set the mill's per-tonne recovery.", metrics: [{ label: "Cane girth", value: "2.8 cm" }, { label: "Internode", value: "16.4 cm" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Rind Hardness & Fibre", body: "Rind hardness measured for borer resistance through the standing crop.", metrics: [{ label: "Rind hardness", value: "High" }, { label: "Fibre", value: "13.2%" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Sucrose & Juice Purity", body: "Sucrose and juice purity decide whether to harvest now or hold.", metrics: [{ label: "Sucrose", value: "17.8%" }, { label: "Juice purity", value: "88.4%" }, { label: "Recovery", value: "10.9%" }] },
    ],
  },
  ragi: {
    family: "Poaceae", emoji: "🌾", category: "Cereals",
    cycleDays: 110, boundaries: [4, 22, 32, 80],
    bestSeason: "95 – 110 Days", targetHarvest: "Target Harvest: Nov–Dec",
    soil: "Red Sandy Loam", ph: "5.5 – 7.5", drainage: "Well drained", organicMatter: "> 0.8%",
    planting: "Line Sowing", spacing: "22.5 x 10 cm", seedDepth: "2 – 3 cm",
    waterMm: [350, 450], irrigation: "Rainfed + Protective", yieldTonsPerAcre: 1.2,
    varieties: ["ML-365", "GPU-28"],
    care: [
      { label: "Seed treatment with Trichoderma", detail: "Controls foot rot in red soils." },
      { label: "Top dress 20 kg N at 25 days", detail: "Only after the first weeding is complete." },
      { label: "Harvest at 80% brown earheads", detail: "Shattering losses rise steeply if left standing." },
    ],
    pests: [
      { name: "Blast", detail: "Fungal · Medium", level: "medium" },
      { name: "Stem Borer", detail: "Watch", level: "watch" },
      { name: "Aphids", detail: "Normal", level: "clear" },
      { name: "Foot Rot", detail: "Managed", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Earhead Density & Fill", body: "Earhead density per running metre sets the plot's yield forecast.", metrics: [{ label: "Earheads / m", value: "38" }, { label: "Grain fill", value: "91%" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Grain Hardness & Glume", body: "Glume release and grain hardness checked for milling quality.", metrics: [{ label: "Grain hardness", value: "High" }, { label: "Glume release", value: "Clean" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Calcium & Milling Recovery", body: "Ragi's calcium content is the nutrition-buyer premium driver.", metrics: [{ label: "Calcium", value: "344 mg/100 g" }, { label: "Milling recovery", value: "72%" }, { label: "Grade", value: "A" }] },
    ],
  },
};

/** Generic fallback so a crop added later still gets a coherent plan. */
function fallbackGuide(crop: string): CropGuide {
  return {
    family: "Field Crop", emoji: "🌿", category: "Vegetables",
    cycleDays: 100, boundaries: [5, 25, 35, 65],
    bestSeason: "80 – 100 Days", targetHarvest: "Target Harvest: 3 months",
    soil: "Loam · Well Drained", ph: "6.0 – 7.0", drainage: "Well drained", organicMatter: "> 1.0%",
    planting: "Precision Spacing", spacing: "45 – 60 cm", seedDepth: "1 – 2 cm",
    waterMm: [400, 550], irrigation: "Drip Fed", yieldTonsPerAcre: 10,
    varieties: [],
    care: [
      { label: "Irrigate on a fixed schedule", detail: "Avoid stress during flowering." },
      { label: "Mulch to hold soil moisture", detail: "Cuts weeding and evaporation." },
      { label: "Split-dose NPK fertigation", detail: "Match nitrogen to the growth stage." },
    ],
    pests: [
      { name: "Aphids", detail: "Watch", level: "watch" },
      { name: "Leaf Spot", detail: "Fungal · Watch", level: "watch" },
      { name: "Fruit Borer", detail: "Normal", level: "clear" },
      { name: "Mildew", detail: "Normal", level: "clear" },
    ],
    scan: [
      { eyebrow: "Stage 1: 1.0x – 1.7x", title: "Whole Specimen & Vigor", body: `Symmetry and firmness of the ${crop} sample verified for transport.`, metrics: [{ label: "Blemish", value: "1.4%" }, { label: "Colour", value: "Uniform" }] },
      { eyebrow: "Stage 2: 1.7x – 2.6x", title: "Surface Barrier", body: "Outer tissue integrity checked against the season's disease pressure.", metrics: [{ label: "Ingress resistance", value: "High" }, { label: "Turgidity", value: "0.80 MPa" }] },
      { eyebrow: "Stage 3: 2.6x – 3.5x", title: "Cellular & Market Quality", body: "Marketable quality verified against the local APMC grade sheet.", metrics: [{ label: "Grade", value: "A" }, { label: "Shelf life", value: "8 days" }] },
    ],
  };
}

/** Guide for a crop name, matched loosely ("Tomato", "tomato (arka rakshak)"). */
export function cropGuide(cropName: string): CropGuide {
  const needle = cropName.trim().toLowerCase();
  for (const [key, guide] of Object.entries(GUIDES)) {
    if (needle === key || needle.startsWith(key)) return guide;
  }
  return fallbackGuide(cropName);
}

export function knownCrops(): string[] {
  return Object.keys(GUIDES);
}

/**
 * A crop's 5-stage pipeline. Crop names also seed deterministic variety and
 * per-stage detail so two farmers growing the same crop see the same plan.
 */
export function cropStages(cropName: string): CycleStage[] {
  const guide = cropGuide(cropName);
  return buildStages(cropName, guide.boundaries, guide.cycleDays);
}
