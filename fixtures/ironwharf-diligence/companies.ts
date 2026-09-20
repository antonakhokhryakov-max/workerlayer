export interface DiligenceVendor {
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

/** Synthetic vendor pack for supplier diligence. Knowledge-work example data, not a finance product. */
export const DILIGENCE_VENDORS: DiligenceVendor[] = [
  {
    name: "Ironwharf Canvas",
    slug: "ironwharf-canvas",
    model: "Made-to-order marine canvas for yards and hotels",
    customers: "Boat yards and coastal hotels",
    funding: "$4.8 million seed",
    products: "Dodgers, awnings, custom shade",
    differentiators: "In-house pattern loft",
    hq: "New Bedford, Massachusetts",
    notes: "Lead time stated as 6 weeks in this profile.",
  },
  {
    name: "Splitrock Hardware",
    slug: "splitrock-hardware",
    model: "Specialty fasteners sold through millwork shops",
    customers: "Cabinet shops and outdoor millwork yards",
    funding: "$1.6 million owner-funded",
    products: "Marine-grade screws, hidden deck clips",
    differentiators: "Salt-spray test records on every lot",
    hq: "Rockland, Maine",
  },
  {
    name: "Dunlin Bindings",
    slug: "dunlin-bindings",
    model: "Contract stitching for outdoor textiles",
    funding: "$900,000 friends-and-family",
    products: "Binding tape, welt cord, UV thread",
    differentiators: "Color-matched lots in five working days",
    hq: "Fall River, Massachusetts",
  },
  {
    name: "Kelp & Keel Fasteners",
    slug: "kelp-keel-fasteners",
    model: "Direct-to-shop hardware with a small catalog",
    customers: "Sail lofts and canvas shops",
    funding: "$2.4 million seed",
    products: "Snaps, track, turnbuttons",
    differentiators: "Replacement parts kept for 12 years",
    hq: "Portsmouth, New Hampshire",
  },
  {
    name: "Marshlight Dye",
    slug: "marshlight-dye",
    model: "Commission dye house for performance fabrics",
    customers: "Regional weavers and two national fabric houses",
    funding: "$3.2 million Series A",
    products: "Solution-dyed acrylic and solution-dyed polyester",
    hq: "Providence, Rhode Island",
  },
  {
    name: "Cobb Wharf Weaving",
    slug: "cobb-wharf-weaving",
    model: "Short-run outdoor fabric weaving",
    products: "Solution-dyed acrylic yardage",
    differentiators: "Custom stripe programs",
    hq: "Newburyport, Massachusetts",
  },
];

/** Lives only on the noisy image-only invoice scan. Tests may import this; the worker must not. */
export const SCAN_ONLY_INVOICE = "$410,000";
export const SCAN_ONLY_INVOICE_LABEL = "Unpaid mill invoice";

/** Lives only on the intentionally unreadable twin scan. Tests may import this; the worker must not. */
export const SCAN_ONLY_HOLD = "$287,500";
export const SCAN_ONLY_HOLD_LABEL = "Bonded warehouse hold";

export const DILIGENCE_GOAL =
  "Complete supplier diligence on the attached millwork and canvas vendors. Build a comparison spreadsheet covering business model, customers, funding, products, and differentiators, plus a short presentation. Cite sources. Flag incomplete facts and any contradictions. One image-only mill invoice scan holds a figure that does not appear in any text memo. A second image-only warehouse-hold scan may be unreadable. Recover a scan figure only if OCR can read it. Do not invent unread numbers.";
