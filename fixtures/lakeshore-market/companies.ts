export interface MarketCompany {
  name: string;
  slug: string;
  model: string;
  customers?: string;
  funding?: string;
  products: string;
  differentiators?: string;
  hq: string;
  notes?: string;
}

/** Synthetic outdoor-living landscape. Knowledge-work example data, not a finance product. */
export const MARKET_COMPANIES: MarketCompany[] = [
  {
    name: "Harbor & Pine Outdoor Co.",
    slug: "harbor-and-pine",
    model: "Wholesale to boutiques plus direct-to-consumer site",
    customers: "Independent garden shops, coastal hotels, homeowners",
    funding: "Bootstrapped; no institutional round disclosed",
    products: "Teak dining, powder-coated steel lounge, performance cushions",
    differentiators: "Retailer relationships on the US West Coast",
    hq: "Portland, Oregon",
  },
  {
    name: "Northwind Lantern Co.",
    slug: "northwind-lantern",
    model: "Specialty wholesale with a small online shop",
    customers: "Independent outfitters and two regional parks accounts",
    funding: "Owner-funded",
    products: "Oil lanterns, rechargeable camp lights, glass shades",
    differentiators: "Heritage lantern designs with modern batteries",
    hq: "Burlington, Vermont",
  },
  {
    name: "Cedar & Current",
    slug: "cedar-and-current",
    model: "Direct-to-consumer plus a few design-trade accounts",
    customers: "Designers and second-home owners",
    funding: "$18 million Series B",
    products: "Modular teak decks and rail planters",
    differentiators: "Flat-pack outdoor rooms",
    hq: "Oakland, California",
    notes: "Funding is intentionally contradicted in the addendum PDF.",
  },
  {
    name: "Saltwell Canvas",
    slug: "saltwell-canvas",
    model: "Made-to-order textiles sold through showrooms",
    customers: "Marine outfitters and hospitality groups",
    funding: "$4 million seed",
    products: "Marine-grade outdoor fabrics and custom covers",
    differentiators: "Salt-spray tested weaves",
    hq: "Savannah, Georgia",
  },
  {
    name: "Redwood Ember Grills",
    slug: "redwood-ember",
    model: "Premium hardware sold via specialty retailers",
    customers: "Outdoor kitchen dealers",
    funding: "$9 million Series A",
    products: "Wood-fired grills and cart inserts",
    differentiators: "Replaceable firebox liners",
    hq: "Santa Rosa, California",
  },
  {
    name: "Blue Heron Shade",
    slug: "blue-heron-shade",
    model: "Catalog wholesale",
    customers: "Patio stores and resort buyers",
    products: "Cantilever umbrellas and shade sails",
    differentiators: "Wind-rated frames with replaceable canopies",
    hq: "Fort Lauderdale, Florida",
  },
  {
    name: "Quarry & Fern",
    slug: "quarry-and-fern",
    model: "Direct-to-consumer planters",
    customers: "Urban gardeners",
    funding: "Friends-and-family only; amount not stated",
    products: "Lightweight stone-look planters",
    differentiators: "Frost-rated shells under 20 pounds",
    hq: "Minneapolis, Minnesota",
  },
  {
    name: "Tidepool Rec",
    slug: "tidepool-rec",
    model: "D2C camping furniture",
    customers: "Car campers and van-life buyers",
    funding: "$2.5 million seed",
    products: "Folding tables, low chairs, kitchen boxes",
    differentiators: "Packs into a single tote",
    hq: "Bend, Oregon",
  },
  {
    name: "Ironvine Perennials",
    slug: "ironvine-perennials",
    model: "Wholesale cushions to furniture brands",
    customers: "OEM furniture makers — named accounts not listed",
    products: "Solution-dyed acrylic cushions",
    differentiators: "Custom sizes in 10 days",
    hq: "High Point, North Carolina",
  },
  {
    name: "Larkspur Fire Tables",
    slug: "larkspur-fire",
    model: "Showroom plus e-commerce",
    customers: "Landscape contractors",
    funding: "$6 million Series A",
    products: "Propane and natural-gas fire tables",
    differentiators: "Hidden tank wells",
    hq: "Denver, Colorado",
  },
  {
    name: "Mossline Shelters",
    slug: "mossline-shelters",
    model: "Project-bid pergolas",
    products: "Cedar and aluminum pergola kits",
    differentiators: "On-site install partners",
    hq: "Austin, Texas",
    notes:
      "Named customers are omitted here on purpose. They live only on the approved trade note.",
  },
  {
    name: "Windrow Hammocks",
    slug: "windrow-hammocks",
    model: "D2C with seasonal pop-ups",
    customers: "College towns and coastal gift shops",
    funding: "Crowdfunded; later round not disclosed",
    products: "Quilted hammocks and stands",
    differentiators: "Machine-washable slings",
    hq: "Asheville, North Carolina",
  },
  {
    name: "Pebble & Dock",
    slug: "pebble-and-dock",
    model: "Coastal furniture wholesale",
    customers: "Marinas and inn owners",
    funding: "Bootstrapped",
    products: "Teak benches and dock boxes",
    differentiators: "Hardware rated for salt air",
    hq: "Newport, Rhode Island",
  },
  {
    name: "Bramble Forge",
    slug: "bramble-forge",
    model: "Made-to-order steel furniture",
    customers: "Landscape architects",
    funding: "$1.2 million seed",
    products: "Welded steel benches and planters",
    differentiators: "Local-mill steel with visible joinery",
    hq: "Pittsburgh, Pennsylvania",
  },
  {
    name: "Silverpine Saunas",
    slug: "silverpine-saunas",
    model: "Direct-to-consumer barrel saunas",
    customers: "Homeowners in cold climates",
    funding: "$7 million Series A",
    products: "Outdoor barrel and cabin saunas",
    hq: "Duluth, Minnesota",
  },
  {
    name: "Cinder Trail Ovens",
    slug: "cinder-trail",
    model: "Specialty retail plus D2C",
    customers: "Culinary hobbyists",
    funding: "Angel round; size redacted in the pack",
    products: "Portable wood-fired pizza ovens",
    differentiators: "Sub-15-minute heat-up claim (unverified here)",
    hq: "Nashville, Tennessee",
  },
  {
    name: "Gull & Grain",
    slug: "gull-and-grain",
    model: "Tabletop goods for outdoor dining",
    customers: "Home stores and wineries",
    products: "Melamine dinnerware and enamelware",
    differentiators: "Restaurant-weight outdoor plates",
    hq: "Hudson, New York",
  },
  {
    name: "Hearthlane Heaters",
    slug: "hearthlane-heaters",
    model: "Commercial and residential patio heat",
    customers: "Restaurants and homeowners",
    funding: "$11 million Series B",
    products: "Propane and electric patio heaters",
    differentiators: "Low-clearance heads for covered patios",
    hq: "Phoenix, Arizona",
  },
];

/** Filled only from the allowlisted note — not present in attached Mossline files. */
export const MOSSLINE_APPROVED_CUSTOMERS = "Hill Country wineries and civic parks";
export const LAKESHORE_MOSSLINE_URL = "https://notes.lakeshore.example/mossline-customers";

export const BENCHMARK_GOAL =
  "Review the attached materials and research the companies using approved sources. Create a comparison spreadsheet covering business model, customers, funding, product capabilities and key differentiators. Then create a 10-slide market overview summarizing the landscape and your major findings. Cite sources and clearly flag information that could not be verified.";
