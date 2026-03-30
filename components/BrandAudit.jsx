// components/BrandAudit.jsx
"use client";
import { useState } from "react";

const STEPS = [
  "Brand Discovery",
  "Market Discovery",
  "Generating Prompts",
  "Executing Prompts",
  "Analyzing Share of Voice",
  "Off-Site Insights",
];

const BRAND_COLORS = [
  "#3b82f6", "#ef4444", "#f59e0b", "#10b981", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316", "#6366f1", "#14b8a6",
];

function hashColor(str, colors) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

// Clearbit logo with letter fallback
const BRAND_DOMAINS = {
  // Companies
  adobe: "adobe.com", canva: "canva.com", figma: "figma.com", affinity: "affinity.serif.com",
  "davinci resolve": "blackmagicdesign.com", apple: "apple.com", midjourney: "midjourney.com",
  salesforce: "salesforce.com", hubspot: "hubspot.com", docusign: "docusign.com",
  google: "google.com", microsoft: "microsoft.com", openai: "openai.com",
  "stable diffusion": "stability.ai", gimp: "gimp.org", inkscape: "inkscape.org",
  nike: "nike.com", adidas: "adidas.com", notion: "notion.so", slack: "slack.com",
  sketch: "sketch.com", "capture one": "captureone.com", foxit: "foxit.com",
  // Adobe products & services
  "adobe photoshop": "adobe.com", "adobe illustrator": "adobe.com", "adobe premiere pro": "adobe.com",
  "adobe after effects": "adobe.com", "adobe lightroom": "adobe.com", "adobe indesign": "adobe.com",
  "adobe acrobat": "adobe.com", "adobe firefly": "adobe.com", "adobe xd": "adobe.com",
  "creative cloud": "adobe.com", "document cloud": "adobe.com", "experience cloud": "adobe.com",
  "adobe fonts": "adobe.com", "adobe stock": "adobe.com", "adobe express": "adobe.com",
  // Nike products & services
  "nike air max": "nike.com", "nike air jordan": "nike.com", "jordan brand": "nike.com",
  "nike by you": "nike.com", converse: "converse.com",
  // Common products
  "final cut pro": "apple.com", "apple motion": "apple.com", "logic pro": "apple.com",
  "google analytics": "google.com", "google ads": "google.com",
  // Furniture brands
  lovesac: "lovesac.com", sactionals: "lovesac.com", sacs: "lovesac.com", "stealthtech sound + charge": "lovesac.com",
  ikea: "ikea.com", burrow: "burrow.com", article: "article.com", "pottery barn": "potterybarn.com",
  "west elm": "westelm.com", "crate & barrel": "crateandbarrel.com", joybird: "joybird.com",
  sabai: "sabai.design", "moon pod": "moonpod.co", yogibo: "yogibo.com", "cordaroy's": "cordaroys.com",
  sonos: "sonos.com", samsung: "samsung.com",
};

function getBrandDomain(name) {
  const lower = name.toLowerCase();
  if (BRAND_DOMAINS[lower]) return BRAND_DOMAINS[lower];
  return `${lower.replace(/[^a-z0-9]/g, "")}.com`;
}

function BrandLogo({ brand, size = 28 }) {
  const domain = getBrandDomain(brand);
  const fallbackColor = hashColor(brand, BRAND_COLORS);
  const [srcIndex, setSrcIndex] = useState(0);

  // Try Clearbit first, then Google Favicon, then letter fallback
  const sources = [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${domain}&sz=${size * 2}`,
  ];

  const showLetter = srcIndex >= sources.length;

  return (
    <div style={{ width: size, height: size, borderRadius: size > 24 ? 7 : 5, overflow: "hidden", flexShrink: 0, background: showLetter ? fallbackColor : "#fff", border: showLetter ? "none" : "1px solid #e8ecf1", display: "flex", alignItems: "center", justifyContent: "center", boxSizing: "border-box" }}>
      {!showLetter ? (
        <img src={sources[srcIndex]} alt="" width={size - 2} height={size - 2} style={{ display: "block", objectFit: "contain" }} onError={() => setSrcIndex(srcIndex + 1)} />
      ) : (
        <span style={{ color: "#fff", fontSize: Math.round(size * 0.4), fontWeight: 700 }}>{brand.substring(0, 1).toUpperCase()}</span>
      )}
    </div>
  );
}

// Simple markdown renderer for LLM answers
function RenderAnswer({ text }) {
  if (!text) return null;
  const lines = text.split("\n");
  return (
    <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.7 }}>
      {lines.map((line, i) => {
        const trimmed = line.trimStart();
        if (trimmed.startsWith("# ")) return <h3 key={i} style={{ fontSize: 16, fontWeight: 700, color: "#1e293b", margin: "12px 0 6px" }}>{trimmed.slice(2)}</h3>;
        if (trimmed.startsWith("## ")) return <h4 key={i} style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", margin: "10px 0 4px" }}>{trimmed.slice(3)}</h4>;
        if (trimmed.startsWith("### ")) return <h5 key={i} style={{ fontSize: 13, fontWeight: 700, color: "#334155", margin: "8px 0 4px" }}>{trimmed.slice(4)}</h5>;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const content = trimmed.slice(2);
          return <div key={i} style={{ display: "flex", gap: 8, marginLeft: 8, marginBottom: 2 }}><span style={{ color: "#94a3b8", flexShrink: 0 }}>&bull;</span><span dangerouslySetInnerHTML={{ __html: boldify(content) }} /></div>;
        }
        if (!trimmed) return <div key={i} style={{ height: 6 }} />;
        return <p key={i} style={{ margin: "2px 0" }} dangerouslySetInnerHTML={{ __html: boldify(trimmed) }} />;
      })}
    </div>
  );
}

function boldify(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong style='color:#1e293b'>$1</strong>");
}

// Collapsible section with accent color
function SectionCard({ icon, title, badge, accentColor, isOpen, onToggle, children, loading, loadingText }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8ecf1", boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)", overflow: "hidden", animation: "fadeIn 0.4s ease" }}>
      <button onClick={onToggle} style={{ background: "none", border: "none", padding: "18px 24px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", borderBottom: isOpen ? "1px solid #f1f5f9" : "none", borderLeft: `3px solid ${accentColor || "#3b82f6"}`, transition: "background 0.15s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {icon}
          <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700, color: accentColor || "#3b82f6", textTransform: "uppercase", letterSpacing: 1.2 }}>{title}</span>
          {badge && <span style={{ fontSize: 10, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 7px", fontWeight: 600 }}>{badge}</span>}
        </div>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.2s" }}><path d="M2 4l4 4 4-4" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      {isOpen && (
        <div style={{ padding: "20px 24px" }}>
          {loading ? (
            <div style={{ padding: 32, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: "spin 1s linear infinite", marginBottom: 8 }}><circle cx="12" cy="12" r="10" stroke="#e2e8f0" strokeWidth="2"/><path d="M22 12a10 10 0 0 0-10-10" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/></svg>
              <div>{loadingText}</div>
            </div>
          ) : children}
        </div>
      )}
    </div>
  );
}

// Category accordion used in Prompts and Results
function CategoryAccordion({ name, count, label, isExpanded, onToggle, children }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <button onClick={onToggle} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 16px", color: "#1e293b", fontSize: 14, cursor: "pointer", width: "100%", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span><strong>{name}</strong> <span style={{ color: "#94a3b8", fontWeight: 400 }}>({count} {label})</span></span>
        <span style={{ color: "#94a3b8", fontSize: 11 }}>{isExpanded ? "\u25BC" : "\u25B6"}</span>
      </button>
      {isExpanded && <div style={{ padding: "14px 4px 4px" }}>{children}</div>}
    </div>
  );
}

export default function BrandAudit() {
  const [brand, setBrand] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [discovery, setDiscovery] = useState(null);
  const [market, setMarket] = useState(null);
  const [prompts, setPrompts] = useState(null);
  const [results, setResults] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});

  const callAPI = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Request failed"); }
    return res.json();
  };

  const runPipeline = async () => {
    if (!brand.trim()) return;
    setLoading(true); setDiscovery(null); setMarket(null); setPrompts(null); setResults(null); setAnalysis(null); setError(null); setCollapsedSections({}); setExpandedCategories({});
    try {
      setCurrentStep(0);
      const disc = await callAPI("/api/discover", { brand: brand.trim() });
      setDiscovery(disc);
      setCurrentStep(1);
      const mkt = await callAPI("/api/market-discovery", { industry: disc.industry, products: disc.products, services: disc.services });
      setMarket(mkt);
      setCurrentStep(2);
      const prm = await callAPI("/api/generate-prompts", { industry: disc.industry, categories: mkt.categories });
      setPrompts(prm);
      setCurrentStep(3);
      const execResults = await callAPI("/api/execute-prompts", { prompts: prm.prompts });
      setResults(execResults);
      setCurrentStep(4);
      const sov = await callAPI("/api/analyze-sov", { brand: brand.trim(), results: execResults.results });
      setAnalysis(sov);
      setCurrentStep(5);
      // Step 6: Off-Site Insights (instant — uses existing data)
      setCurrentStep(6);
    } catch (e) { setError(e.message || "Something went wrong."); } finally { setLoading(false); }
  };

  const loadMockData = () => {
    const b = "Lovesac";
    setDiscovery({ brand: b, industry: "Home Furnishings & Comfort Technology", webSearchUsed: true, products: [{ name: "Sactionals", description: "Patented modular sectional sofas with washable, changeable covers and rearrangeable seats and sides. Designed to last a lifetime and adapt to any room configuration." }, { name: "Sacs", description: "Premium oversized bean bag chairs filled with Durafoam — a proprietary blend of shredded foam that conforms to your body. Available in multiple sizes from Gamersac to the BigOne." }, { name: "StealthTech Sound + Charge", description: "Invisible home theater technology built directly into Sactionals. Features Harman Kardon speakers and wireless charging pads hidden within the furniture." }, { name: "Accessories & Covers", description: "A wide range of fabric and leather covers, drink holders, storage seats, footsac blankets, and decorative pillows that integrate with the Sactionals ecosystem." }], services: [{ name: "Showroom Experience", description: "Hands-on retail showrooms across the US where customers can test configurations, fabrics, and the modular system before purchasing." }, { name: "White Glove Delivery", description: "Premium delivery service with in-home setup, configuration assistance, and packaging removal included." }, { name: "Trade-In & Recycling Program", description: "Sustainability program allowing customers to trade in old Sactionals components and recycle foam and fabric materials." }] });
    setMarket({ webSearchUsed: true, categories: [{ name: "Modular & Sectional Sofas", topics: ["Customizable Modular Sofas", "Family-Friendly Sectionals", "Small Space Modular Furniture"] }, { name: "Home Theater & Audio", topics: ["Built-In Sound Systems", "Immersive Home Theater Seating", "Wireless Audio Furniture"] }, { name: "Premium Comfort Seating", topics: ["Oversized Lounge Chairs", "Gaming Chairs & Beanbags", "Ergonomic Recliners"] }, { name: "Sustainable & Eco-Friendly Furniture", topics: ["Recyclable Furniture Materials", "Long-Lasting Furniture Design", "Eco-Conscious Home Brands"] }, { name: "Direct-to-Consumer Furniture", topics: ["Online Sofa Shopping", "Sofa-in-a-Box Delivery", "Custom Fabric & Configuration"] }] });
    setPrompts({ prompts: [{ category: "Modular & Sectional Sofas", topic: "Customizable Modular Sofas", prompt: "what is the best modular sofa you can rearrange?" }, { category: "Modular & Sectional Sofas", topic: "Customizable Modular Sofas", prompt: "which modular couch has the most configuration options?" }, { category: "Modular & Sectional Sofas", topic: "Customizable Modular Sofas", prompt: "what are the top modular sofas that grow with your space?" }, { category: "Modular & Sectional Sofas", topic: "Family-Friendly Sectionals", prompt: "what is the best sectional sofa for families with kids and pets?" }, { category: "Modular & Sectional Sofas", topic: "Family-Friendly Sectionals", prompt: "which couches have washable and stain-resistant covers?" }, { category: "Modular & Sectional Sofas", topic: "Small Space Modular Furniture", prompt: "what is the best modular sofa for a small apartment?" }, { category: "Home Theater & Audio", topic: "Built-In Sound Systems", prompt: "which sofas have built-in speakers?" }, { category: "Home Theater & Audio", topic: "Built-In Sound Systems", prompt: "what is the best furniture with integrated surround sound?" }, { category: "Home Theater & Audio", topic: "Immersive Home Theater Seating", prompt: "what is the best couch for a home theater setup?" }, { category: "Premium Comfort Seating", topic: "Oversized Lounge Chairs", prompt: "what is the most comfortable oversized chair?" }, { category: "Premium Comfort Seating", topic: "Gaming Chairs & Beanbags", prompt: "what is the best premium beanbag chair for adults?" }, { category: "Premium Comfort Seating", topic: "Gaming Chairs & Beanbags", prompt: "what are the best large beanbag chairs for gaming?" }, { category: "Sustainable & Eco-Friendly Furniture", topic: "Recyclable Furniture Materials", prompt: "which furniture brands use recycled or sustainable materials?" }, { category: "Sustainable & Eco-Friendly Furniture", topic: "Long-Lasting Furniture Design", prompt: "what furniture brands are designed to last a lifetime?" }, { category: "Direct-to-Consumer Furniture", topic: "Online Sofa Shopping", prompt: "what is the best place to buy a sofa online?" }, { category: "Direct-to-Consumer Furniture", topic: "Sofa-in-a-Box Delivery", prompt: "which couch-in-a-box brands have the best reviews?" }, { category: "Direct-to-Consumer Furniture", topic: "Custom Fabric & Configuration", prompt: "which online sofa brands let you fully customize fabric and layout?" }] });
    setResults({ totalRequested: 17, totalSucceeded: 17, totalFailed: 0, webSearchUsed: true, webSearchCount: 17, results: [{ category: "Modular & Sectional Sofas", topic: "Customizable Modular Sofas", prompt: "what is the best modular sofa you can rearrange?", answer: "## Best Modular Sofas for Rearranging\n\n**Lovesac Sactionals** are widely considered the gold standard for modular sofas. Their patented design lets you add or remove seats and sides infinitely, and every piece is interchangeable.\n\n**Burrow Nomad** offers a more affordable modular option with tool-free assembly and a clean mid-century look.\n\n**IKEA Vallentuna** is the budget king of modular sofas with tons of configuration options.\n\n**Article Corvus** provides a stylish modular sectional at a mid-range price point." }, { category: "Modular & Sectional Sofas", topic: "Family-Friendly Sectionals", prompt: "what is the best sectional sofa for families with kids and pets?", answer: "For families with kids and pets, you want **stain resistance and washability**:\n\n**Lovesac Sactionals** — Every cover is machine-washable and replaceable. Incredibly durable and pet-proof.\n\n**Crate & Barrel Lounge II** — Performance fabric options that resist stains.\n\n**Pottery Barn PB Comfort** — Known for durability with kid-friendly fabric options.\n\n**IKEA Ektorp** — Budget-friendly with removable, washable slipcovers." }, { category: "Home Theater & Audio", topic: "Built-In Sound Systems", prompt: "which sofas have built-in speakers?", answer: "Very few furniture brands offer built-in audio:\n\n**Lovesac StealthTech** is the only major sofa brand with **Harman Kardon speakers and bass built directly into the furniture**. The speakers are completely invisible — hidden in the sides and seats.\n\nMost other home theater setups require separate sound bars or speaker systems. Lovesac is essentially alone in this niche." }, { category: "Premium Comfort Seating", topic: "Gaming Chairs & Beanbags", prompt: "what is the best premium beanbag chair for adults?", answer: "For premium adult beanbag chairs:\n\n**Lovesac Sacs** (especially the BigOne and MovieSac) are the premium option — filled with Durafoam that doesn't flatten over time like traditional beanbags.\n\n**CordaRoy's** offers convertible beanbags that fold out into beds.\n\n**Moon Pod** takes a different approach with a gravity-defying adaptive fill.\n\n**Yogibo Max** is popular for its length and versatility.\n\nLovesac is the most expensive but also the most durable long-term." }, { category: "Premium Comfort Seating", topic: "Gaming Chairs & Beanbags", prompt: "what are the best large beanbag chairs for gaming?", answer: "Best large beanbag chairs for gaming:\n\n**Lovesac GameSac / SuperSac** — Premium Durafoam fill that doesn't flatten during long sessions. Large enough to sit upright or recline.\n\n**Yogibo Max** — Popular with gamers for its length. Can be used as a chair or lounger.\n\n**CordaRoy's King** — Converts to a bed, great for gaming rooms that double as guest rooms.\n\n**Moon Pod** — Smaller but ergonomic. Good for focused gaming posture.\n\n**Big Joe** — Budget-friendly option available at most retailers." }, { category: "Sustainable & Eco-Friendly Furniture", topic: "Recyclable Furniture Materials", prompt: "which furniture brands use recycled or sustainable materials?", answer: "Several brands prioritize sustainability:\n\n**IKEA** has committed to using only renewable and recycled materials by 2030.\n\n**West Elm** offers a wide range of FSC-certified and Fair Trade furniture.\n\n**Burrow** uses sustainably sourced wood and recycled packaging.\n\n**Medley** makes sofas with organic and non-toxic materials.\n\n**Lovesac** has a trade-in program and uses recycled materials in some product lines, though sustainability isn't their primary positioning.\n\n**Sabai** is a newer brand focused entirely on sustainable, recyclable sofas." }, { category: "Direct-to-Consumer Furniture", topic: "Online Sofa Shopping", prompt: "what is the best place to buy a sofa online?", answer: "The top online sofa shopping destinations:\n\n**Article** — Great design at reasonable prices with fast delivery. Consistently top-rated.\n\n**Burrow** — Modular, ships in boxes, tool-free assembly. Good for apartments.\n\n**Joybird** — Customizable mid-century styles with 90-day returns.\n\n**Interior Define** — Highly customizable with 100+ fabrics.\n\n**Lovesac** — Premium modular option, higher price point but lifetime value.\n\n**Castlery** — Stylish designs at competitive prices.\n\nArticle and Burrow tend to have the best overall online buying experience." }, { category: "Direct-to-Consumer Furniture", topic: "Sofa-in-a-Box Delivery", prompt: "which couch-in-a-box brands have the best reviews?", answer: "Top-rated couch-in-a-box brands:\n\n**Burrow** — Consistently rated highest for easy assembly and quality.\n\n**Article** — Not technically in-a-box but ships efficiently with great reviews.\n\n**Albany Park** — Affordable with surprisingly good quality.\n\n**Allform** — Modular with performance fabric options.\n\n**Lovesac** — Ships modular pieces in boxes. Higher price but best long-term value.\n\nBurrow and Albany Park tend to dominate the couch-in-a-box reviews." }, { category: "Modular & Sectional Sofas", topic: "Customizable Modular Sofas", prompt: "which modular couch has the most configuration options?", answer: "For sheer configuration flexibility:\n\n**Lovesac Sactionals** offer the most options by far — unlimited seat/side combinations, 200+ fabric choices, and accessories like storage seats and drink holders.\n\n**IKEA Vallentuna** has a good range of modules at a budget price.\n\n**Burrow Nomad** offers 5-6 configuration presets that cover most living room layouts.\n\n**Campaign** provides a simpler modular system with easy reconfiguration." }, { category: "Modular & Sectional Sofas", topic: "Customizable Modular Sofas", prompt: "what are the top modular sofas that grow with your space?", answer: "Sofas designed to expand over time:\n\n**Lovesac Sactionals** — The original \"buy pieces over time\" concept. Add seats and sides as your space grows. Lifetime warranty.\n\n**Burrow** — Add modules easily with their modular architecture.\n\n**Floyd Sofa** — Modular with a Scandinavian design aesthetic.\n\n**IKEA Vallentuna** — Budget-friendly modular that you can expand piece by piece." }, { category: "Modular & Sectional Sofas", topic: "Family-Friendly Sectionals", prompt: "which couches have washable and stain-resistant covers?", answer: "Best options for washable sofa covers:\n\n**Lovesac Sactionals** — All covers are machine-washable and individually replaceable. You can even change the entire look by swapping covers.\n\n**IKEA Ektorp/Uppland** — Removable, machine-washable slipcovers at a budget price.\n\n**Crate & Barrel** — Performance fabric options that resist stains.\n\n**Pottery Barn PB Comfort** — Stain-resistant performance fabrics available." }, { category: "Modular & Sectional Sofas", topic: "Small Space Modular Furniture", prompt: "what is the best modular sofa for a small apartment?", answer: "For small apartments:\n\n**Burrow Nomad** — Compact footprint with modular expansion. Ships in boxes that fit through narrow doorways.\n\n**IKEA Friheten** — Sleeper sectional that doubles as storage.\n\n**Article Sven** — Slim profile that works in tight spaces.\n\n**Lovesac** — You can start with just 2 seats and 2 sides for a compact loveseat, then expand later. But individual pieces are pricier." }, { category: "Home Theater & Audio", topic: "Built-In Sound Systems", prompt: "what is the best furniture with integrated surround sound?", answer: "**Lovesac StealthTech** is essentially the only major furniture brand with fully integrated surround sound — Harman Kardon speakers and subwoofer hidden inside the sofa cushions.\n\nMost home theater enthusiasts use separate systems:\n- **Sonos** sound bars and surround speakers\n- **Samsung** soundbar + rear speakers\n- **Bose** home theater packages\n\nLovesac's advantage is zero visible speakers and no cable management needed." }, { category: "Home Theater & Audio", topic: "Immersive Home Theater Seating", prompt: "what is the best couch for a home theater setup?", answer: "Best couches for home theater:\n\n**Lovesac Sactionals with StealthTech** — The premium choice with built-in Harman Kardon audio. Deep seating configuration available.\n\n**Valencia Theater Seating** — Dedicated home theater recliners with power adjustment.\n\n**Seatcraft** — Purpose-built theater seating with cupholders and storage.\n\n**La-Z-Boy** — Reclining sectionals that work well for casual home theaters.\n\nLovesac is the only one combining regular living room furniture with theater-grade audio." }, { category: "Premium Comfort Seating", topic: "Oversized Lounge Chairs", prompt: "what is the most comfortable oversized chair?", answer: "Most comfortable oversized chairs:\n\n**Lovesac SuperSac / MovieSac** — Massive Durafoam-filled chairs that conform to your body without flattening.\n\n**Restoration Hardware Cloud Chair** — Luxuriously deep and soft.\n\n**Pottery Barn Anywhere Chair** (adult version) — Classic oversized comfort.\n\n**Arhaus Cozy Chair** — Premium oversized swivel chair.\n\nThe Lovesac Sacs are unique because the foam filling maintains its shape for years unlike traditional stuffing." }, { category: "Sustainable & Eco-Friendly Furniture", topic: "Long-Lasting Furniture Design", prompt: "what furniture brands are designed to last a lifetime?", answer: "Furniture built for longevity:\n\n**Stickley** — American-made hardwood furniture with multi-generational durability.\n\n**Room & Board** — High-quality construction with lifetime frame warranty.\n\n**Lovesac** — Lifetime warranty on Sactionals frames. Designed so covers and fill can be replaced without buying new furniture.\n\n**Herman Miller** — Iconic office furniture built to last decades.\n\n**IKEA** — Not traditionally \"lifetime\" but improving with sustainability commitments." }, { category: "Direct-to-Consumer Furniture", topic: "Custom Fabric & Configuration", prompt: "which online sofa brands let you fully customize fabric and layout?", answer: "Most customizable online sofa brands:\n\n**Interior Define** — Over 100 fabrics, customizable dimensions, arm styles, and leg options.\n\n**Lovesac** — 200+ cover options and infinite modular configurations. Most customizable modular system.\n\n**Joybird** — Wide fabric selection with mid-century styling.\n\n**BenchMade Modern** — Full customization including size-to-the-inch.\n\n**Burrow** — Fewer fabric options but easy modular customization." }] });
    setAnalysis({ totalPrompts: 17, totalMentions: 112, rankings: [{ brand: b, shareOfVoice: 22.3, mentions: 25, isPrimary: true }, { brand: "IKEA", shareOfVoice: 13.4, mentions: 15, isPrimary: false }, { brand: "Burrow", shareOfVoice: 11.6, mentions: 13, isPrimary: false }, { brand: "Article", shareOfVoice: 10.7, mentions: 12, isPrimary: false }, { brand: "Pottery Barn", shareOfVoice: 5.4, mentions: 6, isPrimary: false }, { brand: "West Elm", shareOfVoice: 4.5, mentions: 5, isPrimary: false }, { brand: "Crate & Barrel", shareOfVoice: 3.6, mentions: 4, isPrimary: false }, { brand: "Joybird", shareOfVoice: 2.7, mentions: 3, isPrimary: false }, { brand: "Sabai", shareOfVoice: 2.7, mentions: 3, isPrimary: false }, { brand: "CordaRoy's", shareOfVoice: 1.8, mentions: 2, isPrimary: false }], categoryBreakdown: [{ category: "Modular & Sectional Sofas", rankings: [{ brand: b, shareOfVoice: 35.0 }, { brand: "IKEA", shareOfVoice: 18.0 }, { brand: "Burrow", shareOfVoice: 15.0 }, { brand: "Article", shareOfVoice: 10.0 }] }, { category: "Home Theater & Audio", rankings: [{ brand: b, shareOfVoice: 65.0 }, { brand: "Sonos", shareOfVoice: 12.0 }, { brand: "Samsung", shareOfVoice: 8.0 }] }, { category: "Premium Comfort Seating", rankings: [{ brand: b, shareOfVoice: 30.0 }, { brand: "CordaRoy's", shareOfVoice: 20.0 }, { brand: "Moon Pod", shareOfVoice: 18.0 }, { brand: "Yogibo", shareOfVoice: 15.0 }] }, { category: "Sustainable & Eco-Friendly Furniture", rankings: [{ brand: "IKEA", shareOfVoice: 28.0 }, { brand: "West Elm", shareOfVoice: 22.0 }, { brand: "Sabai", shareOfVoice: 15.0 }, { brand: b, shareOfVoice: 10.0 }] }, { category: "Direct-to-Consumer Furniture", rankings: [{ brand: "Article", shareOfVoice: 28.0 }, { brand: "Burrow", shareOfVoice: 25.0 }, { brand: b, shareOfVoice: 15.0 }, { brand: "Joybird", shareOfVoice: 10.0 }] }] });
    setCurrentStep(6); setBrand(b);
  };

  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isSectionOpen = (key) => !collapsedSections[key];
  const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  const hasData = discovery || market || prompts || results || analysis;

  return (
    <div style={{ fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif", background: "#f4f6f8", minHeight: "100vh", color: "#1e293b" }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        input::placeholder { color: #b0b8c4; }
        input:focus { border-color: #2563eb !important; box-shadow: 0 0 0 3px rgba(37,99,235,0.08) !important; }
        button:hover:not(:disabled) { filter: brightness(0.95); }
      `}</style>

      {/* Header */}
      <div style={{ padding: "32px 32px 0" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#0c1222", margin: 0, letterSpacing: -0.5 }}>Brand Discovery Flow</h1>
            <p style={{ color: "#8896a7", fontSize: 14, margin: "6px 0 0", letterSpacing: 0.1 }}>Off-site brand visibility, AI share of voice & competitive landscape</p>
          </div>

          {/* Input + Pipeline row */}
          <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "stretch" }}>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8ecf1", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)", width: 360, flexShrink: 0 }}>
              <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 10 }}>Brand Name <span style={{ color: "#ef4444" }}>*</span></label>
              <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Adobe, Nike, Notion..." onKeyDown={e => e.key === "Enter" && !loading && runPipeline()} style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #dde3ea", borderRadius: 10, padding: "11px 14px", color: "#0c1222", fontSize: 15, outline: "none", boxSizing: "border-box", marginBottom: 14, fontFamily: "'DM Sans', sans-serif" }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={runPipeline} disabled={loading || !brand.trim()} style={{ background: loading || !brand.trim() ? "#e2e8f0" : "#2563eb", color: loading || !brand.trim() ? "#94a3b8" : "#fff", border: "none", borderRadius: 10, padding: "11px 24px", fontSize: 14, fontWeight: 600, cursor: loading || !brand.trim() ? "not-allowed" : "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}>
                  {loading ? "Analyzing..." : "Discover Opportunities"}
                </button>
                <button type="button" onClick={() => loadMockData()} style={{ background: "#f1f5f9", color: "#475569", border: "1.5px solid #dde3ea", borderRadius: 10, padding: "11px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", fontFamily: "'DM Sans', sans-serif", transition: "all 0.15s" }}>Demo</button>
              </div>
            </div>

            {/* Pipeline Progress */}
            {currentStep >= 0 && (
              <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8ecf1", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)", flex: 1, animation: "fadeIn 0.3s ease" }}>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 14px" }}>Pipeline Progress</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {STEPS.map((s, i) => {
                    const completed = i < currentStep;
                    const active = i === currentStep && loading;
                    const webGrounded = (i === 0 && completed && discovery?.webSearchUsed) || (i === 1 && completed && market?.webSearchUsed) || (i === 3 && completed && results?.webSearchUsed);
                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {completed ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#22c55e"/><path d="M6 10.5L8.5 13L14 7.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : active ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="10" cy="10" r="8" stroke="#e2e8f0" strokeWidth="2"/><path d="M18 10a8 8 0 0 0-8-8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/></svg>
                        : <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #e2e8f0", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#b0b8c4", fontWeight: 600 }}>{i + 1}</div>}
                        <span style={{ fontSize: 14, color: completed || active ? "#1e293b" : "#b0b8c4", fontWeight: completed || active ? 600 : 400 }}>{s}</span>
                        {webGrounded && <span style={{ fontSize: 10, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 4, padding: "2px 7px", fontWeight: 600 }}>web-grounded</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px" }}><div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: 16, color: "#dc2626", fontSize: 14, marginBottom: 20, animation: "fadeIn 0.3s ease" }}>{error}</div></div>}

      {/* Dashboard */}
      {hasData && (
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 32px 48px" }}>

          {/* Row 1: Brand Profile + Market Categories */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

            {/* Brand Profile */}
            <SectionCard accentColor="#2563eb" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} title="Brand Profile" badge={discovery?.webSearchUsed ? "web-grounded" : null} isOpen={isSectionOpen("brand")} onToggle={() => toggleSection("brand")} loading={!discovery && currentStep >= 0} loadingText="Discovering brand...">
              {discovery && (
                <>
                  <div style={{ marginBottom: 18 }}>
                    <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "4px 12px", borderRadius: 6, fontWeight: 600, border: "1px solid #e2e8f0" }}>{discovery.industry}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 28 }}>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Products</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {discovery.products?.map((p, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <BrandLogo brand={p.name} size={28} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{p.name}</div>
                              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{p.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Services</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        {discovery.services?.map((s, i) => (
                          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <BrandLogo brand={s.name} size={28} />
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", marginBottom: 2 }}>{s.name}</div>
                              <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.description}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </SectionCard>

            {/* Market Categories & Topics */}
            <SectionCard accentColor="#7c3aed" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-6"/></svg>} title="Market Categories & Topics" badge={market?.webSearchUsed ? "web-grounded" : null} isOpen={isSectionOpen("market")} onToggle={() => toggleSection("market")} loading={!market && currentStep >= 1} loadingText="Researching market...">
              {market && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {market.categories?.map((c, i) => (
                    <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 10, lineHeight: 1.3 }}>{c.name}</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {c.topics?.map((t, j) => (
                          <div key={j} style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "flex-start", gap: 6, lineHeight: 1.5 }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, marginTop: 5 }} />
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>

          {/* Row 2: Generated Prompts + Prompt Results */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

            {/* Generated Prompts */}
            <SectionCard accentColor="#d97706" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>} title={prompts ? `Generated Prompts (${prompts.prompts?.length} total)` : "Generated Prompts"} isOpen={isSectionOpen("prompts")} onToggle={() => toggleSection("prompts")} loading={!prompts && currentStep >= 2} loadingText="Generating prompts...">
              {prompts && market && market.categories?.map((cat, ci) => {
                const catPrompts = prompts.prompts?.filter(p => p.category === cat.name) || [];
                if (!catPrompts.length) return null;
                const topicGroups = {};
                catPrompts.forEach(p => { (topicGroups[p.topic] = topicGroups[p.topic] || []).push(p); });
                return (
                  <CategoryAccordion key={ci} name={cat.name} count={catPrompts.length} label="prompts" isExpanded={expandedCategories[`p_${cat.name}`]} onToggle={() => toggleCategory(`p_${cat.name}`)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                      {Object.entries(topicGroups).map(([topic, tPrompts], ti) => (
                        <div key={ti}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 }}>{topic}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {tPrompts.map((p, pi) => (
                              <div key={pi} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 14px", fontSize: 13, color: "#334155", lineHeight: 1.6 }}>{p.prompt}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CategoryAccordion>
                );
              })}
            </SectionCard>

            {/* Prompt Results */}
            <SectionCard accentColor="#0891b2" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>} title={results ? `Prompt Results (${results.totalSucceeded}/${results.totalRequested} completed)` : "Prompt Results"} badge={results?.webSearchUsed ? "web-grounded" : null} isOpen={isSectionOpen("results")} onToggle={() => toggleSection("results")} loading={!results && currentStep >= 3} loadingText="Executing prompts...">
              {results && market && market.categories?.map((cat, ci) => {
                const catResults = results.results?.filter(r => r.category === cat.name) || [];
                if (!catResults.length) return null;
                const topicGroups = {};
                catResults.forEach(r => { (topicGroups[r.topic] = topicGroups[r.topic] || []).push(r); });
                return (
                  <CategoryAccordion key={ci} name={cat.name} count={catResults.length} label="answers" isExpanded={expandedCategories[`r_${cat.name}`]} onToggle={() => toggleCategory(`r_${cat.name}`)}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                      {Object.entries(topicGroups).map(([topic, tResults], ti) => (
                        <div key={ti}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "#3b82f6", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>{topic}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {tResults.map((r, ri) => {
                              const key = `ans_${ci}_${ti}_${ri}`;
                              const answerOpen = expandedCategories[key];
                              return (
                                <div key={ri} style={{ borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
                                  <button onClick={() => toggleCategory(key)} style={{ background: "#f8fafc", padding: "10px 14px", border: "none", borderBottom: answerOpen ? "1px solid #e2e8f0" : "none", width: "100%", textAlign: "left", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                                    <span style={{ fontSize: 13, color: "#475569", fontFamily: "'DM Sans', sans-serif" }}>{r.prompt}</span>
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, transform: answerOpen ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }}><path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  </button>
                                  {answerOpen && (
                                    <div style={{ padding: "14px 16px" }}>
                                      <RenderAnswer text={r.answer} />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CategoryAccordion>
                );
              })}
            </SectionCard>
          </div>

          {/* Full-Width: Share of Voice */}
          <SectionCard accentColor="#059669" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>} title="Share of Voice" isOpen={isSectionOpen("sov")} onToggle={() => toggleSection("sov")} loading={!analysis && currentStep >= 4} loadingText="Computing rankings...">
            {analysis && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>Overall Rankings</span>
                    <span style={{ fontSize: 12, color: "#94a3b8" }}>Mentions</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {analysis.rankings?.map((r, i) => {
                      const barColor = hashColor(r.brand, BRAND_COLORS);
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: r.isPrimary ? "8px 12px" : "6px 0", background: r.isPrimary ? "#eff6ff" : "transparent", borderRadius: r.isPrimary ? 10 : 0, border: r.isPrimary ? "1px solid #bfdbfe" : "none" }}>
                          <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 700, width: 26, flexShrink: 0 }}>#{i + 1}</span>
                          <BrandLogo brand={r.brand} size={28} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                              <span style={{ fontSize: 14, fontWeight: 600, color: r.isPrimary ? "#2563eb" : "#1e293b" }}>{r.brand}</span>
                              {r.isPrimary && <span style={{ fontSize: 10, color: "#2563eb", background: "#dbeafe", padding: "2px 6px", borderRadius: 4, fontWeight: 700, border: "1px solid #bfdbfe" }}>YOU</span>}
                            </div>
                            <div style={{ background: "#e2e8f0", borderRadius: 4, height: 6, overflow: "hidden" }}>
                              <div style={{ width: `${Math.min(r.shareOfVoice * 2.5, 100)}%`, height: "100%", background: barColor, borderRadius: 4, transition: "width 0.5s" }} />
                            </div>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 700, color: "#475569", width: 50, textAlign: "right", flexShrink: 0 }}>{r.shareOfVoice.toFixed(1)}%</span>
                          <span style={{ fontSize: 13, color: "#94a3b8", width: 30, textAlign: "right", flexShrink: 0 }}>{r.mentions}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Category Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {analysis.categoryBreakdown?.map((cb, i) => (
                      <div key={i} style={{ background: "#f8fafc", borderRadius: 10, padding: "14px 16px", border: "1px solid #e2e8f0" }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 10 }}>{cb.category}</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {cb.rankings?.slice(0, 5).map((r, j) => {
                            const isYou = r.brand.toLowerCase() === brand.trim().toLowerCase();
                            const barColor = hashColor(r.brand, BRAND_COLORS);
                            return (
                              <div key={j} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <BrandLogo brand={r.brand} size={22} />
                                <span style={{ fontSize: 13, fontWeight: 600, color: isYou ? "#2563eb" : "#1e293b", flex: 1 }}>
                                  {r.brand}{isYou && <span style={{ fontSize: 9, color: "#2563eb", background: "#dbeafe", padding: "1px 5px", borderRadius: 3, fontWeight: 700, marginLeft: 5 }}>YOU</span>}
                                </span>
                                <div style={{ width: 80, background: "#e2e8f0", borderRadius: 3, height: 5, overflow: "hidden" }}>
                                  <div style={{ width: `${Math.min((r.shareOfVoice ?? 0) * 2, 100)}%`, height: "100%", background: barColor, borderRadius: 3 }} />
                                </div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#475569", width: 42, textAlign: "right" }}>{(r.shareOfVoice ?? 0).toFixed(1)}%</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          {/* Off-Site Insights */}
          {analysis && (() => {
            const weakCategories = analysis.categoryBreakdown?.filter(cb => {
              const idx = cb.rankings?.findIndex(r => r.brand.toLowerCase() === brand.trim().toLowerCase());
              return idx > 0;
            }) || [];
            // Off-site insight mapping per category — Reddit, YouTube, Cited URLs
            const offsiteInsights = {
              "Sustainable & Eco-Friendly Furniture": {
                reddit: { theme: "Sactional Durability & Satisfaction", sentiment: "49% unfavorable", detail: "Reddit threads like \"Any sactional regrets?\" (133 comments) and \"Returning our Sactional\" show users questioning long-term durability and satisfaction vs. eco-conscious competitors.", topItems: ["Are the sactionals worth it?", "Any sactional regrets?", "What do you wish you knew before buying?"] },
                youtube: { theme: "Price-to-Value Perception", sentiment: "33% favorable", detail: "YouTube reviews like \"Lovesac Review - A $5,000 Couch\" and \"Is Lovesac Sactional Worth it?\" focus on whether the premium price justifies the sustainability and durability claims.", topItems: ["Lovesac Review - A $5,000 Couch", "Is Lovesac Sactional Worth it?", "How to tell if a couch is GOOD or BAD quality"] },
                citedUrls: { theme: "Eco-Furniture Competitor Coverage", sentiment: "7 URLs, 715 citations without Lovesac", detail: "Highly-cited articles on thespruce.com and ultimatesack.com cover sustainable furniture without mentioning Lovesac. These missed opportunities drive LLM responses toward competitors.", topItems: ["thespruce.com — no Lovesac mention", "ultimatesack.com — competitor content", "7 URLs, 715 citations gap"] },
              },
              "Direct-to-Consumer Furniture": {
                reddit: { theme: "Assembly & Return Experience", sentiment: "High priority", detail: "Users report assembly frustrations and compare Lovesac's in-store model unfavorably to Burrow and Article's seamless online experience. Return process concerns are a top Reddit theme.", topItems: ["In store or online?", "Unhappy with sactional", "Warranty experience"] },
                youtube: { theme: "Hardware & Fabric Quality", sentiment: "High priority", detail: "YouTube content reveals concerns about hardware issues and fabric quality. \"Lovesac Changed The Couch Game!\" (84.2K views) has 100% negative comment sentiment on these topics.", topItems: ["Lovesac Changed The Couch Game!", "Assembly Tips, Tricks & Review", "Lovesac Modular Furniture Review"] },
                citedUrls: { theme: "DTC Comparison & Reviews", sentiment: "22 favorable URLs, 3,150 citations", detail: "Lovesac has strong presence on familyhandyman.com and postcardsfromtheridge.com (3,150 citations), but is absent from key DTC furniture comparison articles on competitor sites.", topItems: ["familyhandyman.com — positive coverage", "postcardsfromtheridge.com — favorable", "ultimatesack.com — no Lovesac mention"] },
              },
            };
            return (
            <div style={{ marginTop: 20 }}>
              <SectionCard accentColor="#dc2626" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} title="Off-Site Insights — Competitive Gaps" isOpen={isSectionOpen("offsite")} onToggle={() => toggleSection("offsite")}>
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "#854d0e", lineHeight: 1.6 }}>
                  <strong>{brand}</strong> ranks behind competitors in {weakCategories.length} categories. Off-site sentiment analysis from Reddit, YouTube, and cited URLs reveals correlated themes that explain these gaps.
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 12, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 13.38c.15.36.24.76.24 1.18 0 2.42-2.82 4.38-6.3 4.38s-6.3-1.96-6.3-4.38c0-.42.09-.82.25-1.18a1.5 1.5 0 0 1-.6-1.2c0-.82.67-1.5 1.5-1.5.4 0 .77.16 1.04.42 1.02-.74 2.43-1.22 4-1.28l.76-3.54a.32.32 0 0 1 .38-.24l2.5.53a1.07 1.07 0 1 1-.12.56l-2.23-.47-.68 3.16c1.53.08 2.9.56 3.9 1.28.26-.25.63-.4 1.02-.4.83 0 1.5.67 1.5 1.5 0 .48-.23.9-.58 1.18z"/></svg> Reddit: 72 threads, 1,846 comments, 49% unfavorable</div>
                    <div style={{ fontSize: 12, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> YouTube: 41 videos, 5.2M views, 33% favorable</div>
                    <div style={{ fontSize: 12, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Cited URLs: 30 URLs, 4,012 citations, 96% favorable</div>
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {weakCategories.map((cb, i) => {
                    const brandEntry = cb.rankings?.find(r => r.brand.toLowerCase() === brand.trim().toLowerCase());
                    const leader = cb.rankings?.[0];
                    const brandRank = cb.rankings?.findIndex(r => r.brand.toLowerCase() === brand.trim().toLowerCase()) + 1;
                    const gap = (leader?.shareOfVoice ?? 0) - (brandEntry?.shareOfVoice ?? 0);
                    const insights = offsiteInsights[cb.category];
                    return (
                      <div key={i} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                        {/* Gap header */}
                        <div style={{ background: "#fef2f2", padding: "16px 20px", borderBottom: "1px solid #fecaca" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div>
                              <div style={{ fontSize: 15, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>{cb.category}</div>
                              <div style={{ fontSize: 13, color: "#dc2626" }}>
                                Ranked <strong>#{brandRank}</strong> — trailing <strong>{leader?.brand}</strong> by {gap.toFixed(1)}% SoV
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {cb.rankings?.slice(0, 3).map((r, j) => (
                                <BrandLogo key={j} brand={r.brand} size={24} />
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* 3-source insights grid */}
                        {insights && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #f1f5f9" }}>
                            {[
                              { key: "reddit", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 13.38c.15.36.24.76.24 1.18 0 2.42-2.82 4.38-6.3 4.38s-6.3-1.96-6.3-4.38c0-.42.09-.82.25-1.18a1.5 1.5 0 0 1-.6-1.2c0-.82.67-1.5 1.5-1.5.4 0 .77.16 1.04.42 1.02-.74 2.43-1.22 4-1.28l.76-3.54a.32.32 0 0 1 .38-.24l2.5.53a1.07 1.07 0 1 1-.12.56l-2.23-.47-.68 3.16c1.53.08 2.9.56 3.9 1.28.26-.25.63-.4 1.02-.4.83 0 1.5.67 1.5 1.5 0 .48-.23.9-.58 1.18z"/></svg>, label: "Reddit", color: "#FF4500" },
                              { key: "youtube", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>, label: "YouTube", color: "#FF0000" },
                              { key: "citedUrls", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>, label: "Cited URLs", color: "#2563eb" },
                            ].map(({ key, icon, label, color }) => {
                              const src = insights[key];
                              if (!src) return null;
                              return (
                                <div key={key} style={{ padding: "14px 16px", borderRight: key !== "citedUrls" ? "1px solid #f1f5f9" : "none" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                                    {icon}
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
                                  </div>
                                  <div style={{ fontSize: 13, fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>{src.theme}</div>
                                  <div style={{ fontSize: 11, color, background: `${color}11`, border: `1px solid ${color}33`, padding: "2px 6px", borderRadius: 4, fontWeight: 600, display: "inline-block", marginBottom: 8 }}>{src.sentiment}</div>
                                  <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.5, marginBottom: 8 }}>{src.detail}</div>
                                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                                    {src.topItems?.map((t, j) => (
                                      <span key={j} style={{ fontSize: 10, color: "#475569", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 4, padding: "3px 6px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t}</span>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Action links */}
                        <div style={{ padding: "14px 20px", display: "flex", gap: 10, flexWrap: "wrap" }}>
                          <a href="https://llmo.now/lovesac.com/opportunities/earned-content/c87d5b83-0920-4d0e-a0ef-9e844976f7a4" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#1e293b", fontWeight: 600, textDecoration: "none" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 13.38c.15.36.24.76.24 1.18 0 2.42-2.82 4.38-6.3 4.38s-6.3-1.96-6.3-4.38c0-.42.09-.82.25-1.18a1.5 1.5 0 0 1-.6-1.2c0-.82.67-1.5 1.5-1.5.4 0 .77.16 1.04.42 1.02-.74 2.43-1.22 4-1.28l.76-3.54a.32.32 0 0 1 .38-.24l2.5.53a1.07 1.07 0 1 1-.12.56l-2.23-.47-.68 3.16c1.53.08 2.9.56 3.9 1.28.26-.25.63-.4 1.02-.4.83 0 1.5.67 1.5 1.5 0 .48-.23.9-.58 1.18z"/></svg>
                            Reddit Sentiment
                          </a>
                          <a href="https://llmo.now/lovesac.com/opportunities/earned-content/dd82a4ab-6c02-4877-8677-a7e7c9e50985" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#1e293b", fontWeight: 600, textDecoration: "none" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            YouTube Sentiment
                          </a>
                          <a href="https://llmo.now/lovesac.com/opportunities/earned-content/d8af2e21-df0a-4b42-8f73-511eedde1183" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#1e293b", fontWeight: 600, textDecoration: "none" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            Cited URLs
                          </a>
                        </div>
                      </div>
                    );
                  })}

                  {weakCategories.length === 0 && (
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "18px 20px", fontSize: 14, color: "#16a34a", fontWeight: 600 }}>
                      {brand} leads in all categories — no competitive gaps detected.
                    </div>
                  )}
                </div>
              </SectionCard>
            </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
