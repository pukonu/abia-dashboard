import type {
  DashboardData,
  Direction,
  Domain,
  Entity,
  Frequency,
  Indicator,
  Lga,
  Mda,
  Result,
  Sector,
  ThematicArea,
  TimePeriod,
} from "./types";

/* ------------------------------------------------------------------ */
/* Deterministic pseudo-randomness so the demo data is stable          */
/* ------------------------------------------------------------------ */

function hashStr(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic value in [0, 1) derived from a string key. */
function rand(key: string): number {
  let x = hashStr(key) || 1;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return ((x >>> 0) % 100000) / 100000;
}

/** Deterministic value in [-1, 1). */
function noise(key: string): number {
  return rand(key) * 2 - 1;
}

/* ------------------------------------------------------------------ */
/* LGAs — the 17 Local Government Areas of Abia State                  */
/* ------------------------------------------------------------------ */

const LGA_SPECS: Array<[string, string, number]> = [
  // [name, senatorial zone, approx population]
  ["Aba North", "Abia South", 372000],
  ["Aba South", "Abia South", 534000],
  ["Arochukwu", "Abia North", 262000],
  ["Bende", "Abia North", 292000],
  ["Ikwuano", "Abia Central", 190000],
  ["Isiala Ngwa North", "Abia Central", 216000],
  ["Isiala Ngwa South", "Abia Central", 208000],
  ["Isuikwuato", "Abia North", 155000],
  ["Obi Ngwa", "Abia South", 226000],
  ["Ohafia", "Abia North", 322000],
  ["Osisioma Ngwa", "Abia Central", 302000],
  ["Ugwunagbo", "Abia South", 145000],
  ["Ukwa East", "Abia South", 105000],
  ["Ukwa West", "Abia South", 130000],
  ["Umuahia North", "Abia Central", 359000],
  ["Umuahia South", "Abia Central", 216000],
  ["Umu Nneochi", "Abia North", 195000],
];

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ------------------------------------------------------------------ */
/* Spec tree: sectors → MDAs/entities + thematic areas → domains →     */
/* indicators. Values here drive the deterministic series generator.   */
/* ------------------------------------------------------------------ */

interface IndicatorSpec {
  name: string;
  unit: string;
  direction: Direction;
  valueType?: "score" | "percentage" | "number";
  target: number;
  targetSource: string;
  weight?: number;
  /** typical current Abia value */
  base: number;
  /** typical national comparison value */
  nigeria: number;
  /** total relative change across the whole series (+ improves the raw value) */
  trend: number;
  /** relative noise amplitude */
  jitter: number;
  /** generate per-entity results (drives LGA/entity composites) */
  entityLevel?: boolean;
}

interface DomainSpec {
  name: string;
  weight?: number;
  indicators: IndicatorSpec[];
}

interface ThematicSpec {
  name: string;
  description: string;
  frequency: Frequency;
  weight?: number;
  domains: DomainSpec[];
}

interface MdaSpec {
  name: string;
  abbreviation: string;
  description: string;
  entities: Array<[string, string, string]>; // [name, type, lga name]
}

interface SectorSpec {
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  mdas: MdaSpec[];
  thematicAreas: ThematicSpec[];
}

const SECTOR_SPECS: SectorSpec[] = [
  {
    name: "Health",
    slug: "health",
    description: "Primary healthcare delivery, disease control and health systems strengthening.",
    icon: "🏥",
    color: "#e11d48",
    mdas: [
      {
        name: "Ministry of Health",
        abbreviation: "MOH",
        description: "Policy, public health programmes and primary healthcare oversight.",
        entities: [
          ["Isiala Ngwa PHC Hub", "Primary Health Centre", "Isiala Ngwa North"],
          ["Obi Ngwa Model PHC", "Primary Health Centre", "Obi Ngwa"],
          ["Bende PHC Cluster", "Primary Health Centre", "Bende"],
        ],
      },
      {
        name: "Hospitals Management Board",
        abbreviation: "HMB",
        description: "Secondary and specialist hospitals across the state.",
        entities: [
          ["Abia Specialist Hospital Umuahia", "Specialist Hospital", "Umuahia North"],
          ["Aba General Hospital", "General Hospital", "Aba South"],
          ["Ohafia General Hospital", "General Hospital", "Ohafia"],
          ["Arochukwu General Hospital", "General Hospital", "Arochukwu"],
          ["Ukwa West Cottage Hospital", "Cottage Hospital", "Ukwa West"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Primary Healthcare",
        description: "Maternal & child health outcomes and disease control at the primary level.",
        frequency: "monthly",
        domains: [
          {
            name: "Maternal & Child Health",
            indicators: [
              { name: "Immunization coverage (Penta-3)", unit: "%", direction: "higher_is_better", target: 95, targetSource: "WHO", base: 78, nigeria: 62, trend: 0.14, jitter: 0.04, entityLevel: true },
              { name: "Skilled birth attendance", unit: "%", direction: "higher_is_better", target: 90, targetSource: "SDG 3", base: 71, nigeria: 43, trend: 0.1, jitter: 0.05, entityLevel: true },
              { name: "Under-5 mortality rate", unit: "per 1,000", direction: "lower_is_better", target: 25, targetSource: "SDG 3.2", base: 78, nigeria: 110, trend: 0.12, jitter: 0.04 },
            ],
          },
          {
            name: "Disease Control",
            indicators: [
              { name: "Malaria incidence", unit: "per 1,000", direction: "lower_is_better", target: 100, targetSource: "WHO GTS", base: 214, nigeria: 302, trend: 0.1, jitter: 0.06, entityLevel: true },
              { name: "TB treatment success rate", unit: "%", direction: "higher_is_better", target: 90, targetSource: "WHO", base: 84, nigeria: 88, trend: 0.05, jitter: 0.03, entityLevel: true },
            ],
          },
        ],
      },
      {
        name: "Health Systems",
        description: "Facility readiness, medicines and the health workforce.",
        frequency: "quarterly",
        domains: [
          {
            name: "Facility Readiness",
            indicators: [
              { name: "Essential drugs availability", unit: "%", direction: "higher_is_better", target: 90, targetSource: "State Plan", base: 68, nigeria: 55, trend: 0.18, jitter: 0.05, entityLevel: true },
              { name: "Functional health facilities", unit: "%", direction: "higher_is_better", target: 85, targetSource: "State Plan", base: 72, nigeria: 60, trend: 0.12, jitter: 0.03, entityLevel: true },
            ],
          },
          {
            name: "Health Workforce",
            indicators: [
              { name: "Health workers density", unit: "per 10,000", direction: "higher_is_better", target: 44.5, targetSource: "WHO", base: 21, nigeria: 17, trend: 0.1, jitter: 0.02 },
              { name: "Clinical staff attendance", unit: "%", direction: "higher_is_better", target: 95, targetSource: "State Plan", base: 86, nigeria: 78, trend: 0.06, jitter: 0.03, entityLevel: true },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Education",
    slug: "education",
    description: "Access to basic and secondary education, learning outcomes and school standards.",
    icon: "🎓",
    color: "#2563eb",
    mdas: [
      {
        name: "Ministry of Education",
        abbreviation: "MOE",
        description: "Education policy, secondary schools and quality assurance.",
        entities: [
          ["Government College Umuahia", "Secondary School", "Umuahia North"],
          ["Girls' Secondary School Aba", "Secondary School", "Aba North"],
          ["Ohafia Technical College", "Technical College", "Ohafia"],
          ["Bende Community Secondary School", "Secondary School", "Bende"],
        ],
      },
      {
        name: "Universal Basic Education Board",
        abbreviation: "ASUBEB",
        description: "Primary and junior secondary education delivery.",
        entities: [
          ["Ikwuano Model Primary School", "Primary School", "Ikwuano"],
          ["Obi Ngwa Central Primary School", "Primary School", "Obi Ngwa"],
          ["Umu Nneochi Central School", "Primary School", "Umu Nneochi"],
          ["Osisioma Model Basic School", "Primary School", "Osisioma Ngwa"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Access & Participation",
        description: "Getting every Abia child into school and keeping them there.",
        frequency: "yearly",
        domains: [
          {
            name: "Enrollment",
            indicators: [
              { name: "Net primary enrollment", unit: "%", direction: "higher_is_better", target: 100, targetSource: "SDG 4", base: 88, nigeria: 68, trend: 0.07, jitter: 0.02, entityLevel: true },
              { name: "Gender parity index", unit: "index", direction: "higher_is_better", target: 1, targetSource: "SDG 4.5", base: 0.97, nigeria: 0.94, trend: 0.02, jitter: 0.01 },
            ],
          },
          {
            name: "Retention & Completion",
            indicators: [
              { name: "Primary completion rate", unit: "%", direction: "higher_is_better", target: 90, targetSource: "SDG 4", base: 82, nigeria: 73, trend: 0.06, jitter: 0.02, entityLevel: true },
              { name: "Out-of-school children", unit: "%", direction: "lower_is_better", target: 5, targetSource: "SDG 4", base: 11, nigeria: 26, trend: 0.15, jitter: 0.05 },
            ],
          },
        ],
      },
      {
        name: "Quality & Standards",
        description: "Learning outcomes, teachers and the classroom environment.",
        frequency: "yearly",
        domains: [
          {
            name: "Learning Outcomes",
            indicators: [
              { name: "WAEC 5 credits incl. Eng & Maths", unit: "%", direction: "higher_is_better", target: 70, targetSource: "State Plan", base: 61, nigeria: 59, trend: 0.1, jitter: 0.04, entityLevel: true },
              { name: "P4 pupils meeting literacy benchmark", unit: "%", direction: "higher_is_better", target: 80, targetSource: "State Plan", base: 58, nigeria: 45, trend: 0.12, jitter: 0.04, entityLevel: true },
            ],
          },
          {
            name: "Learning Environment",
            indicators: [
              { name: "Pupil-teacher ratio", unit: "pupils/teacher", direction: "lower_is_better", target: 35, targetSource: "UNESCO", base: 46, nigeria: 55, trend: 0.08, jitter: 0.03, entityLevel: true },
              { name: "Qualified teachers", unit: "%", direction: "higher_is_better", target: 95, targetSource: "State Plan", base: 81, nigeria: 66, trend: 0.06, jitter: 0.02, entityLevel: true },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Security",
    slug: "security",
    description: "Public safety, crime reduction, community policing and emergency response.",
    icon: "🛡️",
    color: "#7c3aed",
    mdas: [
      {
        name: "Ministry of Homeland Security",
        abbreviation: "MHS",
        description: "Coordination of state security outfits, intelligence and emergency response.",
        entities: [
          ["Aba Area Security Command", "Area Command", "Aba South"],
          ["Umuahia Area Security Command", "Area Command", "Umuahia North"],
          ["Ohafia Security Division", "Division", "Ohafia"],
          ["Arochukwu Security Division", "Division", "Arochukwu"],
          ["Obi Ngwa Security Division", "Division", "Obi Ngwa"],
          ["Ukwa East Security Post", "Division", "Ukwa East"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Public Safety",
        description: "Crime levels, response times and community policing coverage.",
        frequency: "weekly",
        domains: [
          {
            name: "Crime Reduction",
            indicators: [
              { name: "Violent crime incidents", unit: "cases/week", direction: "lower_is_better", target: 10, targetSource: "State Plan", base: 19, nigeria: 34, trend: 0.2, jitter: 0.12, entityLevel: true },
              { name: "Kidnapping cases", unit: "cases/week", direction: "lower_is_better", target: 1, targetSource: "State Plan", base: 3.2, nigeria: 7.5, trend: 0.25, jitter: 0.2, entityLevel: true },
              { name: "Average response time", unit: "minutes", direction: "lower_is_better", target: 15, targetSource: "State Plan", base: 24, nigeria: 41, trend: 0.15, jitter: 0.08, entityLevel: true },
            ],
          },
          {
            name: "Community Policing",
            indicators: [
              { name: "Vigilante/neighbourhood watch coverage", unit: "%", direction: "higher_is_better", target: 90, targetSource: "State Plan", base: 74, nigeria: 51, trend: 0.1, jitter: 0.03, entityLevel: true },
              { name: "Planned patrols completed", unit: "%", direction: "higher_is_better", target: 95, targetSource: "State Plan", base: 87, nigeria: 70, trend: 0.05, jitter: 0.04, entityLevel: true },
            ],
          },
        ],
      },
      {
        name: "Emergency Preparedness",
        description: "Readiness for emergencies and road safety.",
        frequency: "monthly",
        domains: [
          {
            name: "Emergency Response",
            indicators: [
              { name: "Emergency readiness score", unit: "%", direction: "higher_is_better", target: 85, targetSource: "State Plan", base: 69, nigeria: 54, trend: 0.12, jitter: 0.04 },
            ],
          },
          {
            name: "Road Safety",
            indicators: [
              { name: "Road traffic deaths", unit: "deaths/month", direction: "lower_is_better", target: 5, targetSource: "SDG 3.6", base: 9.5, nigeria: 14, trend: 0.15, jitter: 0.12 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Agriculture",
    slug: "agriculture",
    description: "Food production, farmer support and agribusiness value chains.",
    icon: "🌾",
    color: "#16a34a",
    mdas: [
      {
        name: "Ministry of Agriculture",
        abbreviation: "MOA",
        description: "Crop production, extension services and agro-industrial development.",
        entities: [
          ["Abia Palm Estate", "Plantation", "Ukwa West"],
          ["Umudike Farm Cluster", "Farm Cluster", "Ikwuano"],
          ["Bende Rice Cluster", "Farm Cluster", "Bende"],
          ["Isuikwuato Cassava Cluster", "Farm Cluster", "Isuikwuato"],
          ["Ugwunagbo Poultry Scheme", "Livestock Scheme", "Ugwunagbo"],
          ["Umu Nneochi Maize Belt", "Farm Cluster", "Umu Nneochi"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Food Production",
        description: "Yields for priority crops and support reaching farmers.",
        frequency: "quarterly",
        domains: [
          {
            name: "Crop Output",
            indicators: [
              { name: "Cassava yield", unit: "t/ha", direction: "higher_is_better", target: 20, targetSource: "State Plan", base: 13.5, nigeria: 8.9, trend: 0.15, jitter: 0.06, entityLevel: true },
              { name: "Rice paddy yield", unit: "t/ha", direction: "higher_is_better", target: 4, targetSource: "State Plan", base: 2.6, nigeria: 2.1, trend: 0.18, jitter: 0.07, entityLevel: true },
              { name: "Palm oil output", unit: "kt/quarter", direction: "higher_is_better", target: 12, targetSource: "State Plan", base: 8.2, nigeria: 6.5, trend: 0.12, jitter: 0.08, entityLevel: true },
            ],
          },
          {
            name: "Farmer Support",
            indicators: [
              { name: "Farmers receiving improved inputs", unit: "%", direction: "higher_is_better", target: 80, targetSource: "State Plan", base: 54, nigeria: 38, trend: 0.2, jitter: 0.05, entityLevel: true },
              { name: "Extension visits per farm cluster", unit: "visits/quarter", direction: "higher_is_better", target: 4, targetSource: "FAO", base: 2.7, nigeria: 1.8, trend: 0.15, jitter: 0.08, entityLevel: true },
            ],
          },
        ],
      },
      {
        name: "Agribusiness",
        description: "Processing capacity and post-harvest performance.",
        frequency: "yearly",
        domains: [
          {
            name: "Value Chain",
            indicators: [
              { name: "Agro-processing capacity utilization", unit: "%", direction: "higher_is_better", target: 75, targetSource: "State Plan", base: 52, nigeria: 45, trend: 0.14, jitter: 0.04 },
              { name: "Post-harvest losses", unit: "%", direction: "lower_is_better", target: 15, targetSource: "FAO/SDG 12.3", base: 28, nigeria: 37, trend: 0.12, jitter: 0.04 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Infrastructure",
    slug: "infrastructure",
    description: "Roads, transport, water supply and power across the state.",
    icon: "🏗️",
    color: "#ea580c",
    mdas: [
      {
        name: "Ministry of Works & Transport",
        abbreviation: "MOWT",
        description: "Road construction, rehabilitation and transport infrastructure.",
        entities: [
          ["Port Harcourt Road Rehabilitation", "Road Project", "Aba South"],
          ["Ossah Road Dualization", "Road Project", "Umuahia North"],
          ["Abiriba Ring Road", "Road Project", "Ohafia"],
          ["Obohia-Ohanku Road", "Road Project", "Aba South"],
          ["Uzuakoli-Bende Road", "Road Project", "Bende"],
        ],
      },
      {
        name: "Ministry of Power & Public Utilities",
        abbreviation: "MPPU",
        description: "Water schemes, rural electrification and public utilities.",
        entities: [
          ["Aba Water Scheme", "Water Scheme", "Aba North"],
          ["Umuahia Regional Water Scheme", "Water Scheme", "Umuahia South"],
          ["Ntigha Water Scheme", "Water Scheme", "Isiala Ngwa North"],
          ["Ukwa East Rural Electrification", "Power Project", "Ukwa East"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Roads & Transport",
        description: "Condition of the road network and delivery of road projects.",
        frequency: "monthly",
        domains: [
          {
            name: "Road Network",
            indicators: [
              { name: "State roads in good condition", unit: "%", direction: "higher_is_better", target: 80, targetSource: "State Plan", base: 58, nigeria: 40, trend: 0.2, jitter: 0.03 },
              { name: "Rehabilitation vs annual plan", unit: "%", direction: "higher_is_better", target: 100, targetSource: "State Plan", base: 76, nigeria: 60, trend: 0.15, jitter: 0.06, entityLevel: true },
            ],
          },
          {
            name: "Project Delivery",
            indicators: [
              { name: "Projects on schedule", unit: "%", direction: "higher_is_better", target: 90, targetSource: "State Plan", base: 71, nigeria: 55, trend: 0.1, jitter: 0.06, entityLevel: true },
              { name: "Budget variance", unit: "%", direction: "lower_is_better", target: 10, targetSource: "State Plan", base: 18, nigeria: 27, trend: 0.12, jitter: 0.08, entityLevel: true },
            ],
          },
        ],
      },
      {
        name: "Water & Power",
        description: "Access to safe water and reliability of power supply.",
        frequency: "monthly",
        domains: [
          {
            name: "Water Access",
            indicators: [
              { name: "Population with safe water access", unit: "%", direction: "higher_is_better", target: 90, targetSource: "SDG 6", base: 64, nigeria: 57, trend: 0.12, jitter: 0.03, entityLevel: true },
            ],
          },
          {
            name: "Power Supply",
            indicators: [
              { name: "Average daily power supply", unit: "hours/day", direction: "higher_is_better", target: 18, targetSource: "State Plan", base: 11.5, nigeria: 9, trend: 0.15, jitter: 0.08 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Power",
    slug: "power",
    description: "Electricity generation, distribution reliability, gas supply and outage response.",
    icon: "⚡",
    color: "#f59e0b",
    mdas: [
      {
        name: "Ministry of Power & Public Utilities",
        abbreviation: "MPWR",
        description: "Power sector coordination, rural electrification and utility reliability.",
        entities: [
          ["Geometric Power Plant, Osisioma", "Power Plant", "Osisioma Ngwa"],
          ["Aba Integrated Power Substation", "Power Substation", "Aba South"],
          ["Umuahia Injection Substation", "Power Substation", "Umuahia North"],
          ["Ariaria Industrial Feeder", "Distribution Feeder", "Aba North"],
          ["Umuahia Urban Feeder", "Distribution Feeder", "Umuahia North"],
          ["Ukwa East Rural Electrification", "Rural Electrification Project", "Ukwa East"],
        ],
      },
      {
        name: "Abia Electricity & Utilities Monitoring Unit",
        abbreviation: "AEUMU",
        description: "Daily monitoring of generation output, outages, grid events and gas constraints.",
        entities: [
          ["Geometric Daily Output Desk", "Power Monitoring Desk", "Osisioma Ngwa"],
          ["Aba Ring-Fenced Network Control", "Power Control Centre", "Aba South"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Generation & Supply",
        description: "Power generated, wheeled and available to homes, businesses and industrial clusters.",
        frequency: "daily",
        domains: [
          {
            name: "Geometric Power Output",
            indicators: [
              { name: "Geometric daily generation output", unit: "MW", direction: "higher_is_better", target: 141, targetSource: "Plant capacity", base: 92, nigeria: 0, trend: 0.12, jitter: 0.08 },
              { name: "Average daily energy sent out", unit: "MWh/day", direction: "higher_is_better", target: 2200, targetSource: "State Plan", base: 1480, nigeria: 0, trend: 0.14, jitter: 0.08 },
            ],
          },
          {
            name: "Gas Supply",
            indicators: [
              { name: "Gas supply availability", unit: "%", direction: "higher_is_better", target: 95, targetSource: "Gas supply SLA", base: 78, nigeria: 65, trend: 0.08, jitter: 0.06 },
              { name: "Low gas supply incidents", unit: "incidents/month", direction: "lower_is_better", target: 1, targetSource: "State Plan", base: 4, nigeria: 6, trend: 0.12, jitter: 0.16 },
            ],
          },
        ],
      },
      {
        name: "Distribution Reliability",
        description: "Outages, feeder availability and grid-cut events affecting residents and businesses.",
        frequency: "daily",
        domains: [
          {
            name: "Outages & Grid Events",
            indicators: [
              { name: "Power cutoff incidents", unit: "incidents/day", direction: "lower_is_better", target: 2, targetSource: "Utility SLA", base: 7, nigeria: 10, trend: 0.18, jitter: 0.18, entityLevel: true },
              { name: "Grid cutoff events", unit: "events/month", direction: "lower_is_better", target: 1, targetSource: "State Plan", base: 5, nigeria: 8, trend: 0.15, jitter: 0.18 },
              { name: "Feeder uptime", unit: "%", direction: "higher_is_better", target: 92, targetSource: "Utility SLA", base: 81, nigeria: 70, trend: 0.08, jitter: 0.05, entityLevel: true },
            ],
          },
          {
            name: "Customer Supply",
            indicators: [
              { name: "Average daily supply hours", unit: "hours/day", direction: "higher_is_better", target: 20, targetSource: "State Plan", base: 13.5, nigeria: 9, trend: 0.16, jitter: 0.08, entityLevel: true },
              { name: "Industrial cluster supply reliability", unit: "%", direction: "higher_is_better", target: 95, targetSource: "State Plan", base: 84, nigeria: 62, trend: 0.1, jitter: 0.05, entityLevel: true },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Economy & Trade",
    slug: "economy",
    description: "Internally generated revenue, investment, markets and SME growth.",
    icon: "💼",
    color: "#0d9488",
    mdas: [
      {
        name: "Ministry of Trade & Investment",
        abbreviation: "MTI",
        description: "Markets, industrial clusters and investment promotion.",
        entities: [
          ["Ariaria International Market", "Market", "Aba North"],
          ["Umuahia Ubani Main Market", "Market", "Umuahia North"],
          ["Aba SME Hub", "SME Hub", "Aba South"],
          ["Ohafia Industrial Cluster", "Industrial Cluster", "Ohafia"],
        ],
      },
      {
        name: "Board of Internal Revenue",
        abbreviation: "BIR",
        description: "Revenue collection and taxpayer services.",
        entities: [
          ["Aba Revenue Zone", "Revenue Zone", "Aba South"],
          ["Umuahia Revenue Zone", "Revenue Zone", "Umuahia North"],
          ["Ohafia Revenue Zone", "Revenue Zone", "Ohafia"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Revenue & Investment",
        description: "IGR performance and new business formation.",
        frequency: "monthly",
        domains: [
          {
            name: "Internally Generated Revenue",
            indicators: [
              { name: "Monthly IGR", unit: "NGN bn", direction: "higher_is_better", target: 5, targetSource: "State Plan", base: 3.4, nigeria: 2.8, trend: 0.25, jitter: 0.08, entityLevel: true },
              { name: "Collection efficiency", unit: "%", direction: "higher_is_better", target: 90, targetSource: "State Plan", base: 72, nigeria: 61, trend: 0.12, jitter: 0.04, entityLevel: true },
            ],
          },
          {
            name: "Investment & Jobs",
            indicators: [
              { name: "New businesses registered", unit: "count/month", direction: "higher_is_better", target: 400, targetSource: "State Plan", base: 285, nigeria: 240, trend: 0.2, jitter: 0.1 },
              { name: "Jobs created", unit: "jobs/month", direction: "higher_is_better", target: 800, targetSource: "State Plan", base: 540, nigeria: 430, trend: 0.18, jitter: 0.12 },
            ],
          },
        ],
      },
      {
        name: "SME Development",
        description: "Small business access to finance and survival.",
        frequency: "quarterly",
        domains: [
          {
            name: "SME Support",
            indicators: [
              { name: "SMEs accessing formal credit", unit: "%", direction: "higher_is_better", target: 40, targetSource: "State Plan", base: 22, nigeria: 15, trend: 0.2, jitter: 0.05, entityLevel: true },
              { name: "2-year SME survival rate", unit: "%", direction: "higher_is_better", target: 80, targetSource: "State Plan", base: 63, nigeria: 55, trend: 0.08, jitter: 0.03 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Women Affairs",
    slug: "women-affairs",
    description: "Women empowerment, child protection, gender inclusion and social welfare.",
    icon: "👩🏾‍🤝‍👩🏾",
    color: "#be185d",
    mdas: [
      {
        name: "Ministry of Women Affairs & Poverty Alleviation",
        abbreviation: "MWAPA",
        description: "Women empowerment, family welfare and gender inclusion programmes.",
        entities: [
          ["Umuahia Women Development Centre", "Women Development Centre", "Umuahia North"],
          ["Aba Skills Acquisition Centre", "Skills Centre", "Aba South"],
          ["Ohafia Women Cooperative Hub", "Cooperative Hub", "Ohafia"],
          ["Bende Family Support Desk", "Family Support Desk", "Bende"],
        ],
      },
      {
        name: "Abia Social Welfare & Child Protection Agency",
        abbreviation: "ASWCPA",
        description: "Child protection, GBV response and social welfare case management.",
        entities: [
          ["Aba GBV Response Desk", "GBV Response Desk", "Aba North"],
          ["Umuahia Child Protection Desk", "Child Protection Desk", "Umuahia South"],
          ["Osisioma Social Welfare Desk", "Social Welfare Desk", "Osisioma Ngwa"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Women Empowerment",
        description: "Economic inclusion, skills, cooperative support and access to credit.",
        frequency: "quarterly",
        domains: [
          {
            name: "Skills & Enterprise",
            indicators: [
              { name: "Women trained in livelihood skills", unit: "women/quarter", direction: "higher_is_better", target: 2500, targetSource: "State Plan", base: 1450, nigeria: 980, trend: 0.22, jitter: 0.1, entityLevel: true },
              { name: "Women-owned SMEs supported", unit: "SMEs/quarter", direction: "higher_is_better", target: 800, targetSource: "State Plan", base: 420, nigeria: 300, trend: 0.18, jitter: 0.1, entityLevel: true },
            ],
          },
          {
            name: "Financial Inclusion",
            indicators: [
              { name: "Women accessing programme credit", unit: "%", direction: "higher_is_better", target: 45, targetSource: "State Plan", base: 24, nigeria: 18, trend: 0.16, jitter: 0.05 },
              { name: "Women cooperatives active", unit: "cooperatives", direction: "higher_is_better", target: 120, targetSource: "State Plan", base: 72, nigeria: 55, trend: 0.12, jitter: 0.08, entityLevel: true },
            ],
          },
        ],
      },
      {
        name: "Protection & Welfare",
        description: "GBV response, child protection and social welfare support.",
        frequency: "monthly",
        domains: [
          {
            name: "Gender-Based Violence Response",
            indicators: [
              { name: "GBV cases receiving timely support", unit: "%", direction: "higher_is_better", target: 95, targetSource: "State Plan", base: 68, nigeria: 52, trend: 0.18, jitter: 0.06, entityLevel: true },
              { name: "Average GBV case response time", unit: "hours", direction: "lower_is_better", target: 24, targetSource: "State Plan", base: 54, nigeria: 72, trend: 0.16, jitter: 0.12 },
            ],
          },
          {
            name: "Child Protection",
            indicators: [
              { name: "Child protection cases closed", unit: "%", direction: "higher_is_better", target: 85, targetSource: "State Plan", base: 61, nigeria: 48, trend: 0.12, jitter: 0.06, entityLevel: true },
              { name: "Vulnerable households reached", unit: "households/month", direction: "higher_is_better", target: 3500, targetSource: "State Plan", base: 2100, nigeria: 1600, trend: 0.14, jitter: 0.1 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Environment",
    slug: "environment",
    description: "Waste management, drainage, flood control, erosion response and urban sanitation.",
    icon: "🌿",
    color: "#16a34a",
    mdas: [
      {
        name: "Ministry of Environment",
        abbreviation: "MOEENV",
        description: "Environmental protection, sanitation, flood control and erosion management.",
        entities: [
          ["Aba Flood Control Zone", "Flood Control Zone", "Aba South"],
          ["Umuahia Drainage Corridor", "Drainage Corridor", "Umuahia North"],
          ["Isuikwuato Erosion Site", "Erosion Site", "Isuikwuato"],
          ["Ohafia Watershed Protection Area", "Watershed Area", "Ohafia"],
        ],
      },
      {
        name: "Abia State Environmental Protection Agency",
        abbreviation: "ASEPA",
        description: "Waste collection, dumpsite management and urban sanitation enforcement.",
        entities: [
          ["Aba Waste Collection Zone", "Waste Collection Zone", "Aba North"],
          ["Umuahia Waste Collection Zone", "Waste Collection Zone", "Umuahia South"],
          ["Ariaria Market Sanitation Beat", "Sanitation Beat", "Aba North"],
          ["Ubani Market Sanitation Beat", "Sanitation Beat", "Umuahia North"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Waste & Sanitation",
        description: "Waste collection, market sanitation and dumpsite management.",
        frequency: "weekly",
        domains: [
          {
            name: "Waste Collection",
            indicators: [
              { name: "Urban waste collection coverage", unit: "%", direction: "higher_is_better", target: 90, targetSource: "State Plan", base: 62, nigeria: 45, trend: 0.2, jitter: 0.06, entityLevel: true },
              { name: "Dumpsites cleared", unit: "sites/month", direction: "higher_is_better", target: 20, targetSource: "State Plan", base: 11, nigeria: 8, trend: 0.18, jitter: 0.15 },
            ],
          },
          {
            name: "Sanitation Compliance",
            indicators: [
              { name: "Markets meeting sanitation standard", unit: "%", direction: "higher_is_better", target: 85, targetSource: "State Plan", base: 58, nigeria: 46, trend: 0.14, jitter: 0.06, entityLevel: true },
              { name: "Street sweeping route completion", unit: "%", direction: "higher_is_better", target: 95, targetSource: "State Plan", base: 72, nigeria: 54, trend: 0.12, jitter: 0.04 },
            ],
          },
        ],
      },
      {
        name: "Flood & Erosion Control",
        description: "Drainage, flood prevention and erosion site response.",
        frequency: "monthly",
        domains: [
          {
            name: "Drainage Readiness",
            indicators: [
              { name: "Drainage desilting completed", unit: "%", direction: "higher_is_better", target: 90, targetSource: "Rainy Season Plan", base: 64, nigeria: 50, trend: 0.16, jitter: 0.07, entityLevel: true },
              { name: "Flood-prone locations mapped", unit: "%", direction: "higher_is_better", target: 100, targetSource: "State Plan", base: 78, nigeria: 60, trend: 0.1, jitter: 0.04 },
            ],
          },
          {
            name: "Erosion Response",
            indicators: [
              { name: "Active erosion sites under control", unit: "%", direction: "higher_is_better", target: 80, targetSource: "State Plan", base: 46, nigeria: 35, trend: 0.14, jitter: 0.08, entityLevel: true },
              { name: "Monthly flood incidents", unit: "incidents/month", direction: "lower_is_better", target: 2, targetSource: "State Plan", base: 7, nigeria: 12, trend: 0.16, jitter: 0.2 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "Technology",
    slug: "technology",
    description: "Digital government, broadband access, startup support and public-sector innovation.",
    icon: "💻",
    color: "#7c3aed",
    mdas: [
      {
        name: "Ministry of Digital Economy & SME Innovation",
        abbreviation: "MDESI",
        description: "Digital economy policy, technology skills and startup ecosystem development.",
        entities: [
          ["Aba Innovation Hub", "Innovation Hub", "Aba South"],
          ["Umuahia Digital Skills Centre", "Digital Skills Centre", "Umuahia North"],
          ["Ohafia Tech Outreach Centre", "Tech Outreach Centre", "Ohafia"],
          ["Ariaria Digital Trade Desk", "Digital Trade Desk", "Aba North"],
        ],
      },
      {
        name: "Abia State ICT & E-Government Agency",
        abbreviation: "ASICTA",
        description: "E-government services, connectivity and public-sector digital transformation.",
        entities: [
          ["Abia E-Government Service Desk", "E-Government Desk", "Umuahia North"],
          ["Broadband Right-of-Way Desk", "Broadband Desk", "Umuahia South"],
          ["Aba Fibre Backbone Segment", "Fibre Backbone Segment", "Aba South"],
        ],
      },
    ],
    thematicAreas: [
      {
        name: "Digital Economy",
        description: "Tech skills, startups and digital trade enablement.",
        frequency: "monthly",
        domains: [
          {
            name: "Skills & Talent",
            indicators: [
              { name: "Youth trained in digital skills", unit: "people/month", direction: "higher_is_better", target: 2500, targetSource: "State Plan", base: 1180, nigeria: 900, trend: 0.24, jitter: 0.12, entityLevel: true },
              { name: "Digital skills completion rate", unit: "%", direction: "higher_is_better", target: 85, targetSource: "State Plan", base: 63, nigeria: 52, trend: 0.14, jitter: 0.05 },
            ],
          },
          {
            name: "Startups & Innovation",
            indicators: [
              { name: "Startups supported by state programmes", unit: "startups/quarter", direction: "higher_is_better", target: 150, targetSource: "State Plan", base: 64, nigeria: 48, trend: 0.2, jitter: 0.1, entityLevel: true },
              { name: "Tech-enabled SMEs onboarded", unit: "SMEs/month", direction: "higher_is_better", target: 600, targetSource: "State Plan", base: 280, nigeria: 200, trend: 0.22, jitter: 0.12 },
            ],
          },
        ],
      },
      {
        name: "Digital Government",
        description: "E-services, connectivity and digitisation of government workflows.",
        frequency: "monthly",
        domains: [
          {
            name: "E-Government Services",
            indicators: [
              { name: "Government services available online", unit: "services", direction: "higher_is_better", target: 50, targetSource: "State Plan", base: 18, nigeria: 14, trend: 0.18, jitter: 0.08 },
              { name: "Online service completion rate", unit: "%", direction: "higher_is_better", target: 80, targetSource: "State Plan", base: 54, nigeria: 42, trend: 0.14, jitter: 0.06, entityLevel: true },
            ],
          },
          {
            name: "Connectivity",
            indicators: [
              { name: "Broadband coverage in priority corridors", unit: "%", direction: "higher_is_better", target: 75, targetSource: "State Plan", base: 38, nigeria: 32, trend: 0.2, jitter: 0.08, entityLevel: true },
              { name: "Public Wi-Fi sites active", unit: "sites", direction: "higher_is_better", target: 120, targetSource: "State Plan", base: 34, nigeria: 22, trend: 0.22, jitter: 0.12 },
            ],
          },
        ],
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Time periods (anchored to a fixed date so data is reproducible)     */
/* ------------------------------------------------------------------ */

const ANCHOR = new Date(Date.UTC(2026, 5, 30)); // 30 Jun 2026

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function buildTimePeriods(): TimePeriod[] {
  const periods: TimePeriod[] = [];

  // Yearly: 2021 – 2026
  for (let y = 2021; y <= 2026; y++) {
    periods.push({
      id: `tp-y-${y}`,
      frequency: "yearly",
      label: `${y}`,
      start_date: `${y}-01-01`,
      end_date: `${y}-12-31`,
    });
  }

  // Quarterly: last 8 quarters ending 2026 Q2
  for (let i = 7; i >= 0; i--) {
    const qEndMonth = 6 - i * 3; // month index of quarter end, from anchor (Jun 2026)
    const end = new Date(Date.UTC(2026, qEndMonth, 0)); // last day of quarter-end month
    const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 2, 1));
    const q = Math.floor(start.getUTCMonth() / 3) + 1;
    periods.push({
      id: `tp-q-${start.getUTCFullYear()}q${q}`,
      frequency: "quarterly",
      label: `${start.getUTCFullYear()} Q${q}`,
      start_date: iso(start),
      end_date: iso(end),
    });
  }

  // Monthly: last 12 months ending Jun 2026
  for (let i = 11; i >= 0; i--) {
    const start = new Date(Date.UTC(2026, 5 - i, 1));
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    periods.push({
      id: `tp-m-${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      frequency: "monthly",
      label: `${MONTHS[start.getUTCMonth()]} ${start.getUTCFullYear()}`,
      start_date: iso(start),
      end_date: iso(end),
    });
  }

  // Weekly: last 12 weeks ending the week of the anchor (weeks start Monday)
  const anchorMonday = new Date(ANCHOR);
  anchorMonday.setUTCDate(anchorMonday.getUTCDate() - ((anchorMonday.getUTCDay() + 6) % 7));
  for (let i = 11; i >= 0; i--) {
    const start = new Date(anchorMonday);
    start.setUTCDate(start.getUTCDate() - i * 7);
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    periods.push({
      id: `tp-w-${iso(start)}`,
      frequency: "weekly",
      label: `Wk of ${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}`,
      start_date: iso(start),
      end_date: iso(end),
    });
  }

  // Daily: last 14 days ending at the anchor
  for (let i = 13; i >= 0; i--) {
    const day = new Date(ANCHOR);
    day.setUTCDate(day.getUTCDate() - i);
    periods.push({
      id: `tp-d-${iso(day)}`,
      frequency: "daily",
      label: `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`,
      start_date: iso(day),
      end_date: iso(day),
    });
  }

  return periods;
}

/* ------------------------------------------------------------------ */
/* Assemble the full dataset                                           */
/* ------------------------------------------------------------------ */

function clampValue(v: number, unit: string): number {
  if (v < 0) v = 0;
  if (unit === "%" && v > 100) v = 100;
  return Math.round(v * 100) / 100;
}

/** Per-LGA structural performance bias in roughly [-0.14, +0.14]. */
function lgaBias(lgaName: string): number {
  return noise(`lga-bias:${lgaName}`) * 0.14;
}

export function buildDemoData(): DashboardData {
  const lgas: Lga[] = LGA_SPECS.map(([name, zone, population]) => ({
    id: `lga-${slugify(name)}`,
    name,
    zone,
    population,
  }));
  const lgaByName = new Map(lgas.map((l) => [l.name, l]));

  const sectors: Sector[] = [];
  const mdas: Mda[] = [];
  const entities: Entity[] = [];
  const thematicAreas: ThematicArea[] = [];
  const domains: Domain[] = [];
  const indicators: Indicator[] = [];
  const results: Result[] = [];

  const timePeriods = buildTimePeriods();
  const periodsByFreq = new Map<Frequency, TimePeriod[]>();
  for (const tp of timePeriods) {
    const list = periodsByFreq.get(tp.frequency) ?? [];
    list.push(tp);
    periodsByFreq.set(tp.frequency, list);
  }
  periodsByFreq.forEach((list) => list.sort((a, b) => a.start_date.localeCompare(b.start_date)));

  // Keep an indicator-spec lookup so the seed generator can reuse it
  for (const [sIdx, s] of SECTOR_SPECS.entries()) {
    const sectorId = `sec-${s.slug}`;
    sectors.push({
      id: sectorId,
      slug: s.slug,
      name: s.name,
      description: s.description,
      icon: s.icon,
      color: s.color,
      sort_order: sIdx,
    });

    const sectorEntities: Entity[] = [];
    for (const m of s.mdas) {
      const mdaId = `mda-${slugify(m.abbreviation)}`;
      mdas.push({
        id: mdaId,
        sector_id: sectorId,
        name: m.name,
        abbreviation: m.abbreviation,
        description: m.description,
      });
      for (const [entName, entType, lgaName] of m.entities) {
        const lga = lgaByName.get(lgaName);
        if (!lga) throw new Error(`Unknown LGA in demo data: ${lgaName}`);
        const entity: Entity = {
          id: `ent-${slugify(entName)}`,
          mda_id: mdaId,
          lga_id: lga.id,
          name: entName,
          entity_type: entType,
        };
        entities.push(entity);
        sectorEntities.push(entity);
      }
    }

    for (const ta of s.thematicAreas) {
      const taId = `ta-${s.slug}-${slugify(ta.name)}`;
      thematicAreas.push({
        id: taId,
        sector_id: sectorId,
        name: ta.name,
        description: ta.description,
        frequency: ta.frequency,
        weight: ta.weight ?? 1,
      });
      const periods = periodsByFreq.get(ta.frequency) ?? [];
      const n = periods.length;

      for (const d of ta.domains) {
        const domainId = `dom-${s.slug}-${slugify(d.name)}`;
        domains.push({
          id: domainId,
          thematic_area_id: taId,
          name: d.name,
          weight: d.weight ?? 1,
        });

        for (const ind of d.indicators) {
          const indicatorId = `ind-${slugify(ind.name)}`;
          indicators.push({
            id: indicatorId,
            domain_id: domainId,
            indicator_scope: "state",
            name: ind.name,
            value_type: ind.valueType ?? (ind.unit === "%" ? "percentage" : "number"),
            score_options: null,
            unit: ind.unit,
            direction: ind.direction,
            target_value: ind.target,
            target_source: ind.targetSource,
            weight: ind.weight ?? 1,
          });

          // A raw-value trend should move the value in the *good* direction.
          const dirSign = ind.direction === "higher_is_better" ? 1 : -1;

          for (const [pIdx, tp] of periods.entries()) {
            const t = n > 1 ? pIdx / (n - 1) : 1; // 0 → oldest, 1 → latest
            // series is calibrated so the latest value ≈ base
            const drift = 1 + dirSign * ind.trend * (t - 1);
            const abia = clampValue(
              ind.base * drift * (1 + noise(`${indicatorId}:${tp.id}:abia`) * ind.jitter),
              ind.unit
            );
            const nigeriaDrift = 1 + dirSign * ind.trend * 0.4 * (t - 1);
            const nigeria = clampValue(
              ind.nigeria * nigeriaDrift * (1 + noise(`${indicatorId}:${tp.id}:ng`) * ind.jitter),
              ind.unit
            );

            results.push({
              id: `res-${indicatorId}-${tp.id}`,
              indicator_id: indicatorId,
              time_period_id: tp.id,
              entity_id: null,
              abia_value: abia,
              nigeria_value: nigeria,
              target_value: null,
            });

            if (ind.entityLevel) {
              for (const ent of sectorEntities) {
                const bias = lgaBias(lgas.find((l) => l.id === ent.lga_id)!.name);
                const wobble = noise(`${indicatorId}:${tp.id}:${ent.id}`) * ind.jitter * 1.5;
                const perf = 1 + bias + wobble; // >1 = performs better than state average
                const value =
                  ind.direction === "higher_is_better"
                    ? abia * perf
                    : abia / Math.max(perf, 0.5);
                results.push({
                  id: `res-${indicatorId}-${tp.id}-${ent.id}`,
                  indicator_id: indicatorId,
                  time_period_id: tp.id,
                  entity_id: ent.id,
                  abia_value: clampValue(value, ind.unit),
                  nigeria_value: null,
                  target_value: null,
                });
              }
            }
          }
        }
      }
    }
  }

  /* ---------- sample custom dashboards (built with the dashboard builder) ---------- */

  const ind = (name: string) => `ind-${slugify(name)}`;
  const dashboards: DashboardData["dashboards"] = [
    {
      id: "dash-health-glance",
      name: "Primary Care at a Glance",
      description: "Key maternal, child health and disease-control indicators for the Health sector.",
      scope: "sector",
      sector_id: "sec-health",
      lga_id: null,
      published: true,
      sort_order: 0,
    },
    {
      id: "dash-aba-north",
      name: "Aba North Service Delivery",
      description: "How facilities in Aba North are performing on frontline service indicators.",
      scope: "lga",
      sector_id: null,
      lga_id: "lga-aba-north",
      published: true,
      sort_order: 0,
    },
  ];
  const dashboardWidgets: DashboardData["dashboardWidgets"] = [
    {
      id: "dw-health-stats",
      dashboard_id: "dash-health-glance",
      chart_type: "stat",
      title: "Latest results",
      indicator_ids: [
        ind("Immunization coverage (Penta-3)"),
        ind("Skilled birth attendance"),
        ind("Under-5 mortality rate"),
        ind("TB treatment success rate"),
      ],
      span: 2,
      position: 0,
    },
    {
      id: "dw-health-trend",
      dashboard_id: "dash-health-glance",
      chart_type: "trend",
      title: "Immunization coverage over time",
      indicator_ids: [ind("Immunization coverage (Penta-3)")],
      span: 1,
      position: 1,
    },
    {
      id: "dw-health-bar",
      dashboard_id: "dash-health-glance",
      chart_type: "bar",
      title: "Distance to target",
      indicator_ids: [
        ind("Immunization coverage (Penta-3)"),
        ind("Skilled birth attendance"),
        ind("Malaria incidence"),
        ind("Essential drugs availability"),
      ],
      span: 1,
      position: 2,
    },
    {
      id: "dw-health-radar",
      dashboard_id: "dash-health-glance",
      chart_type: "radar",
      title: "Health scorecard",
      indicator_ids: [
        ind("Immunization coverage (Penta-3)"),
        ind("Skilled birth attendance"),
        ind("Malaria incidence"),
        ind("Essential drugs availability"),
        ind("Functional health facilities"),
      ],
      span: 2,
      position: 3,
    },
    // Aba North's demo entities are a school, a water scheme and a market,
    // so the sample widgets use indicators measured at those entities.
    {
      id: "dw-aba-north-stats",
      dashboard_id: "dash-aba-north",
      chart_type: "stat",
      title: "Latest averages across facilities",
      indicator_ids: [
        ind("Net primary enrollment"),
        ind("Qualified teachers"),
        ind("Population with safe water access"),
        ind("Projects on schedule"),
      ],
      span: 2,
      position: 0,
    },
    {
      id: "dw-aba-north-trend",
      dashboard_id: "dash-aba-north",
      chart_type: "trend",
      title: "Service delivery trend",
      indicator_ids: [ind("Net primary enrollment"), ind("Primary completion rate")],
      span: 1,
      position: 1,
    },
    {
      id: "dw-aba-north-bar",
      dashboard_id: "dash-aba-north",
      chart_type: "bar",
      title: "Latest scores",
      indicator_ids: [
        ind("Net primary enrollment"),
        ind("Qualified teachers"),
        ind("WAEC 5 credits incl. Eng & Maths"),
        ind("Pupil-teacher ratio"),
      ],
      span: 1,
      position: 2,
    },
  ];

  return {
    sectors,
    lgas,
    mdas,
    entities,
    thematicAreas,
    domains,
    indicators,
    timePeriods,
    results,
    evidence: [],
    dashboards,
    dashboardWidgets,
    mode: "demo",
    supabaseConfigured: false,
  };
}

let cached: DashboardData | null = null;

export function getDemoData(): DashboardData {
  if (!cached) cached = buildDemoData();
  return cached;
}
