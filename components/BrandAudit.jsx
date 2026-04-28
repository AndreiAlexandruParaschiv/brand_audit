// components/BrandAudit.jsx
"use client";
import { useMemo, useState } from "react";
import { aggregateSources, buildExclusion, classifySource, extractSubreddit, extractYoutubeId } from "../lib/sources.js";
import { downloadCsv, slugifyForFile, todayStamp } from "../lib/csv.js";

const PIPELINE_STEPS = [
  "Brand Discovery",
  "Market Discovery",
  "Generating Prompts",
  "Executing Prompts",
  "Analyzing Share of Voice",
  "Cited Sources",
];

const DEMO_STEPS = [
  ...PIPELINE_STEPS,
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
  // Sporting goods & retail
  academy: "academy.com", "academy sports": "academy.com",
  "dick's sporting goods": "dickssportinggoods.com", dicks: "dickssportinggoods.com",
  rei: "rei.com", "bass pro shops": "basspro.com", "cabela's": "cabelas.com",
  "foot locker": "footlocker.com", "new balance": "newbalance.com",
  brooks: "brooksrunning.com", asics: "asics.com", hoka: "hoka.com",
  "under armour": "underarmour.com", peloton: "onepeloton.com",
  walmart: "walmart.com", amazon: "amazon.com", target: "target.com",
  rawlings: "rawlings.com", easton: "easton.com", "louisville slugger": "slugger.com",
  demarini: "demarini.com", bowflex: "bowflex.com", coleman: "coleman.com",
  samsung: "samsung.com", sonos: "sonos.com",
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

// Plausible third-party sources keyed by topic — used only in demo mode.
// Production sources come from Tavily via app/api/execute-prompts/route.js.
const DEMO_TOPIC_SOURCES = {
  "Performance Running Shoes": [
    { url: "https://www.runnersworld.com/gear/a20865505/best-running-shoes/", title: "Best Running Shoes 2024 - Runner's World" },
    { url: "https://www.reddit.com/r/running/comments/1abcde1/best_marathon_shoes_2024/", title: "Best marathon shoes 2024 - r/running" },
    { url: "https://www.youtube.com/watch?v=runShoeReview1", title: "Top 10 Marathon Running Shoes Reviewed" },
    { url: "https://www.runningwarehouse.com/learning_center/expert_advice/", title: "Expert Advice - Running Warehouse" },
  ],
  "Basketball Footwear": [
    { url: "https://www.reddit.com/r/Sneakers/comments/2basket1/best_basketball_shoes/", title: "Best basketball shoes for ankle support - r/Sneakers" },
    { url: "https://www.youtube.com/watch?v=basketShoeRev2", title: "Best Basketball Shoes for Ankle Support 2024" },
    { url: "https://hoopshype.com/lists/best-basketball-shoes/", title: "Best Basketball Shoes - HoopsHype" },
    { url: "https://www.complex.com/sneakers/best-basketball-shoes", title: "The Best Basketball Shoes Right Now - Complex" },
  ],
  "Trail Running & Hiking Shoes": [
    { url: "https://www.outdoorgearlab.com/topics/shoes-and-boots/best-hiking-shoes", title: "Best Hiking Shoes - OutdoorGearLab" },
    { url: "https://www.cleverhiker.com/best-hiking-shoes/", title: "Best Hiking Shoes - CleverHiker" },
    { url: "https://www.reddit.com/r/Ultralight/comments/3hike1/waterproof_hiking_shoes/", title: "Waterproof hiking shoes - r/Ultralight" },
    { url: "https://www.youtube.com/watch?v=hikeShoeRev3", title: "Best Trail Running Shoes for Beginners" },
  ],
  "Cross-Training & Gym Shoes": [
    { url: "https://barbend.com/best-crossfit-shoes/", title: "Best CrossFit Shoes - BarBend" },
    { url: "https://www.reddit.com/r/crossfit/comments/4cross1/best_shoes_for_crossfit/", title: "Best shoes for CrossFit - r/crossfit" },
    { url: "https://www.youtube.com/watch?v=crossShoeRev4", title: "Top 5 CrossFit Shoes 2024" },
    { url: "https://www.menshealth.com/style/g19536100/best-cross-training-shoes/", title: "The Best Cross-Training Shoes - Men's Health" },
  ],
  "Camping Gear & Tents": [
    { url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-camping-tent", title: "Best Camping Tents - OutdoorGearLab" },
    { url: "https://www.reddit.com/r/camping/comments/5camp1/family_tent_under_200/", title: "Family tent under $200 - r/camping" },
    { url: "https://www.youtube.com/watch?v=tentReview5", title: "Top 5 Family Camping Tents Under $200" },
    { url: "https://www.cleverhiker.com/best-tents/", title: "Best Backpacking Tents - CleverHiker" },
  ],
  "Hunting & Fishing Gear": [
    { url: "https://www.fieldandstream.com/gear/best-fishing-rod-combos/", title: "Best Fishing Rod Combos - Field & Stream" },
    { url: "https://www.reddit.com/r/Fishing/comments/6fish1/beginner_setup/", title: "Best beginner fishing rod setup - r/Fishing" },
    { url: "https://www.youtube.com/watch?v=fishGearRev6", title: "Best Bass Lures for Beginners 2024" },
    { url: "https://www.bassmaster.com/news/best-bass-fishing-lures-2024/", title: "Best Bass Fishing Lures - Bassmaster" },
  ],
  "Hiking & Backpacking Equipment": [
    { url: "https://www.outdoorgearlab.com/topics/camping-and-hiking/best-daypack", title: "Best Daypacks - OutdoorGearLab" },
    { url: "https://www.reddit.com/r/Ultralight/comments/7pack1/cold_weather_sleeping_bag/", title: "Cold weather sleeping bag - r/Ultralight" },
    { url: "https://www.youtube.com/watch?v=backpackRev7", title: "Best Day Hiking Backpacks Reviewed" },
    { url: "https://www.backpacker.com/gear/best-trekking-poles/", title: "Best Trekking Poles - Backpacker" },
  ],
  "Outdoor Cooking & Grilling": [
    { url: "https://www.seriouseats.com/the-best-portable-grills", title: "Best Portable Grills - Serious Eats" },
    { url: "https://www.reddit.com/r/pelletgrills/comments/8grill1/best_pellet_grill_brands/", title: "Best pellet grill brands - r/pelletgrills" },
    { url: "https://www.youtube.com/watch?v=grillReview8", title: "Top Pellet Grill Brands 2024 Comparison" },
    { url: "https://www.cleverhiker.com/best-camping-stoves/", title: "Best Camping Stoves - CleverHiker" },
  ],
  "Home Gym Equipment": [
    { url: "https://www.garagegymreviews.com/best-home-gyms", title: "Best Home Gyms - Garage Gym Reviews" },
    { url: "https://www.reddit.com/r/homegym/comments/9gym1/budget_setup/", title: "Budget home gym setup - r/homegym" },
    { url: "https://www.youtube.com/watch?v=homeGymRev9", title: "Best Adjustable Dumbbells 2024" },
    { url: "https://www.menshealth.com/fitness/g32474438/best-adjustable-dumbbells/", title: "Best Adjustable Dumbbells - Men's Health" },
  ],
  "Cardio & Endurance Training": [
    { url: "https://www.runnersworld.com/gear/a20857381/best-treadmills/", title: "Best Home Treadmills - Runner's World" },
    { url: "https://www.reddit.com/r/homegym/comments/acard1/treadmill_under_1000/", title: "Treadmill under $1000 - r/homegym" },
    { url: "https://www.youtube.com/watch?v=cardioRev10", title: "Best Stationary Bikes for Beginners 2024" },
    { url: "https://www.shape.com/fitness/gear/best-treadmills", title: "The Best Treadmills - Shape" },
  ],
  "Strength & Weight Training": [
    { url: "https://www.garagegymreviews.com/best-barbells", title: "Best Barbells - Garage Gym Reviews" },
    { url: "https://www.reddit.com/r/Fitness/comments/bstr1/home_pull_up_bar/", title: "Best home pull-up bar - r/Fitness" },
    { url: "https://www.youtube.com/watch?v=strengthRev11", title: "Top Resistance Bands for Strength Training" },
    { url: "https://barbend.com/best-resistance-bands/", title: "Best Resistance Bands - BarBend" },
  ],
  "Youth Baseball & Softball": [
    { url: "https://www.justbaseball.com/best-youth-baseball-gloves/", title: "Best Youth Baseball Gloves - Just Baseball" },
    { url: "https://www.reddit.com/r/baseball/comments/cbase1/youth_glove_size/", title: "Youth glove size for 10-year-old - r/baseball" },
    { url: "https://www.youtube.com/watch?v=youthBatRev12", title: "Top Youth Baseball Bats 2024" },
    { url: "https://www.justbatreviews.com/best-youth-baseball-bats/", title: "Best Youth Baseball Bats - Just Bat Reviews" },
  ],
  "Youth Football & Soccer": [
    { url: "https://www.virginiatech.edu/star-helmet-ratings/", title: "STAR Helmet Safety Ratings - Virginia Tech" },
    { url: "https://www.reddit.com/r/football/comments/dyfoot1/youth_helmet_safety/", title: "Youth football helmet safety - r/football" },
    { url: "https://www.youtube.com/watch?v=cleatRev13", title: "Best Youth Soccer Cleats 2024" },
    { url: "https://www.soccerbible.com/performance/footwear/", title: "Soccer Cleats Reviews - SoccerBible" },
  ],
  "Basketball Equipment": [
    { url: "https://www.reddit.com/r/basketball/comments/ebask1/driveway_hoop/", title: "Best driveway basketball hoop - r/basketball" },
    { url: "https://www.youtube.com/watch?v=hoopRev14", title: "Best Basketball Hoops for Driveway 2024" },
    { url: "https://www.thespruce.com/best-basketball-hoops-4801252", title: "Best Basketball Hoops - The Spruce" },
    { url: "https://www.complex.com/sneakers/best-outdoor-basketball-shoes", title: "Best Outdoor Basketball Shoes - Complex" },
  ],
  "Sports Protective Gear & Apparel": [
    { url: "https://www.outdoorgearlab.com/topics/shoes-and-boots/best-sport-sunglasses", title: "Best Sport Sunglasses - OutdoorGearLab" },
    { url: "https://www.reddit.com/r/running/comments/fapparel1/compression_shorts/", title: "Best compression shorts - r/running" },
    { url: "https://www.youtube.com/watch?v=apparelRev15", title: "Best Athletic Shorts for Working Out" },
    { url: "https://www.menshealth.com/style/g19536100/best-athletic-shorts/", title: "Best Athletic Shorts - Men's Health" },
  ],
  "Sports Gear Value & Deals": [
    { url: "https://thekrazycouponlady.com/tips/store-hacks/best-sporting-goods-deals", title: "Best Sporting Goods Deals - The Krazy Coupon Lady" },
    { url: "https://www.reddit.com/r/frugalmalefashion/comments/gdeals1/sporting_goods_deals/", title: "Sporting goods deals - r/frugalmalefashion" },
    { url: "https://www.youtube.com/watch?v=dealsRev16", title: "Best Loyalty Programs Sporting Goods" },
    { url: "https://www.consumerreports.org/cro/news/best-sporting-goods-stores/", title: "Best Sporting Goods Stores - Consumer Reports" },
  ],
  "Online vs In-Store Shopping": [
    { url: "https://www.runnersworld.com/gear/a20865200/buying-running-shoes-online-vs-in-store/", title: "Buying Running Shoes Online vs In-Store - Runner's World" },
    { url: "https://www.reddit.com/r/running/comments/honoff1/online_or_in_store/", title: "Buy running shoes online or in-store? - r/running" },
    { url: "https://www.youtube.com/watch?v=onlineRev17", title: "Top Sporting Goods Websites 2024" },
    { url: "https://www.nytimes.com/wirecutter/reviews/best-running-shoe-stores/", title: "Best Online Running Stores - Wirecutter" },
  ],
};

function attachDemoSources(resultsArr) {
  if (!Array.isArray(resultsArr)) return resultsArr;
  return resultsArr.map((r) => {
    const pool = DEMO_TOPIC_SOURCES[r.topic] || [];
    return { ...r, sources: pool };
  });
}

// Single source row used inside the Cited Sources section
function SourceRow({ entry, kind, accent, compact }) {
  const host = entry.host || "";
  const favicon = host ? `https://www.google.com/s2/favicons?domain=${host}&sz=32` : "";
  const display = entry.title?.trim() || entry.url;
  return (
    <a href={entry.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: compact ? 8 : 10, padding: compact ? "6px 8px" : "8px 12px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, textDecoration: "none", color: "#1e293b" }}>
      <div style={{ width: compact ? 18 : 22, height: compact ? 18 : 22, borderRadius: 4, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, overflow: "hidden", border: "1px solid #e8ecf1" }}>
        {favicon ? <img src={favicon} alt="" width={compact ? 14 : 18} height={compact ? 14 : 18} style={{ display: "block" }} onError={(e) => { e.currentTarget.style.display = "none"; }} /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <div style={{ fontSize: compact ? 12 : 13, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{display}</div>
        <div style={{ fontSize: compact ? 10 : 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{host}</div>
      </div>
      <span style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: accent, background: `${accent}11`, border: `1px solid ${accent}33`, borderRadius: 4, padding: "2px 7px", flexShrink: 0 }}>{entry.count}x</span>
    </a>
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
  const [isDemo, setIsDemo] = useState(false);
  const [region, setRegion] = useState("US");

  const callAPI = async (url, body) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Request failed"); }
    return res.json();
  };

  const runPipeline = async () => {
    if (!brand.trim()) return;
    setLoading(true); setIsDemo(false); setDiscovery(null); setMarket(null); setPrompts(null); setResults(null); setAnalysis(null); setError(null); setCollapsedSections({}); setExpandedCategories({});
    try {
      setCurrentStep(0);
      const disc = await callAPI("/api/discover", { brand: brand.trim(), region });
      setDiscovery(disc);
      setCurrentStep(1);
      const mkt = await callAPI("/api/market-discovery", { industry: disc.industry, products: disc.products, services: disc.services, region });
      setMarket(mkt);
      setCurrentStep(2);
      const prm = await callAPI("/api/generate-prompts", { industry: disc.industry, categories: mkt.categories, region });
      setPrompts(prm);
      setCurrentStep(3);
      const execResults = await callAPI("/api/execute-prompts", { prompts: prm.prompts });
      setResults(execResults);
      setCurrentStep(4);
      const sov = await callAPI("/api/analyze-sov", { brand: brand.trim(), results: execResults.results });
      setAnalysis(sov);
      setCurrentStep(6);
    } catch (e) { setError(e.message || "Something went wrong."); } finally { setLoading(false); }
  };

  const loadMockData = () => {
    const b = "Academy";
    setRegion("US");
    setDiscovery({ brand: b, industry: "Sporting Goods & Outdoor Recreation Retail", region: "US", availableRegions: ["US", "CA"], webSearchUsed: true, officialDomains: ["academy.com"], socialHandles: [{ platform: "youtube", handle: "@AcademySportsOutdoors" }, { platform: "reddit", handle: "r/AcademySports" }, { platform: "instagram", handle: "@academy" }], products: [{ name: "Athletic Footwear", description: "Performance running shoes, basketball footwear, training shoes, and casual sneakers from Nike, Adidas, Under Armour, Brooks, ASICS, New Balance, and Hoka across all price points." }, { name: "Outdoor & Camping Gear", description: "Tents, sleeping bags, backpacks, camp stoves, and outdoor cooking equipment. Includes Academy's exclusive Magellan Outdoors brand and top names like Coleman and MSR." }, { name: "Hunting & Fishing Equipment", description: "Fishing rods, reels, tackle, ammunition, and hunting apparel including exclusive Mossy Oak and Magellan Outdoors lines." }, { name: "Fitness & Exercise Equipment", description: "Home gym equipment including dumbbells, barbells, weight benches, treadmills, and resistance training accessories from leading brands and Academy's BCG label." }, { name: "Team & Youth Sports", description: "Baseball, softball, basketball, football, and soccer equipment for all ages from Rawlings, Easton, Louisville Slugger, Wilson, and DeMarini." }], services: [{ name: "In-Store Expert Advice", description: "Knowledgeable staff across specialized departments including footwear fitting, outdoor gear selection, firearms, and team sports equipment." }, { name: "Price Match Guarantee", description: "Academy matches competitor prices on identical items, helping shoppers get the best value without searching multiple stores." }, { name: "Academy.com Online Shopping", description: "Full e-commerce with ship-to-home, buy online pick up in store (BOPIS), and same-day delivery options across most categories." }] });
    setMarket({ webSearchUsed: true, categories: [{ name: "Athletic Footwear", topics: ["Performance Running Shoes", "Basketball Footwear", "Trail Running & Hiking Shoes", "Cross-Training & Gym Shoes"] }, { name: "Outdoor & Camping", topics: ["Camping Gear & Tents", "Hunting & Fishing Gear", "Hiking & Backpacking Equipment", "Outdoor Cooking & Grilling"] }, { name: "Fitness Equipment", topics: ["Home Gym Equipment", "Cardio & Endurance Training", "Strength & Weight Training"] }, { name: "Team & Youth Sports", topics: ["Youth Baseball & Softball", "Youth Football & Soccer", "Basketball Equipment", "Sports Protective Gear & Apparel"] }, { name: "Sporting Goods Retail", topics: ["Sports Gear Value & Deals", "Online vs In-Store Shopping"] }] });
    setPrompts({ prompts: [
      { category: "Athletic Footwear", topic: "Performance Running Shoes", prompt: "what is the best running shoe for marathon training?" },
      { category: "Athletic Footwear", topic: "Performance Running Shoes", prompt: "which running shoes have the best cushioning for long runs?" },
      { category: "Athletic Footwear", topic: "Performance Running Shoes", prompt: "what are the top running shoe brands for beginners?" },
      { category: "Athletic Footwear", topic: "Basketball Footwear", prompt: "what is the best basketball shoe for ankle support?" },
      { category: "Athletic Footwear", topic: "Basketball Footwear", prompt: "which basketball shoes do NBA players wear most?" },
      { category: "Athletic Footwear", topic: "Basketball Footwear", prompt: "what are the best budget basketball shoes?" },
      { category: "Athletic Footwear", topic: "Trail Running & Hiking Shoes", prompt: "what is the best trail running shoe for beginners?" },
      { category: "Athletic Footwear", topic: "Trail Running & Hiking Shoes", prompt: "which hiking shoe brands are the most durable?" },
      { category: "Athletic Footwear", topic: "Trail Running & Hiking Shoes", prompt: "what are the best waterproof hiking shoes?" },
      { category: "Athletic Footwear", topic: "Cross-Training & Gym Shoes", prompt: "what is the best shoe for CrossFit training?" },
      { category: "Athletic Footwear", topic: "Cross-Training & Gym Shoes", prompt: "which cross-training shoes are best for weightlifting?" },
      { category: "Athletic Footwear", topic: "Cross-Training & Gym Shoes", prompt: "what are the best gym shoes for flat feet?" },
      { category: "Outdoor & Camping", topic: "Camping Gear & Tents", prompt: "what is the best tent for camping in the rain?" },
      { category: "Outdoor & Camping", topic: "Camping Gear & Tents", prompt: "which camping gear brands are the most reliable?" },
      { category: "Outdoor & Camping", topic: "Camping Gear & Tents", prompt: "what are the best family camping tents for under $200?" },
      { category: "Outdoor & Camping", topic: "Hunting & Fishing Gear", prompt: "what is the best fishing rod setup for beginners?" },
      { category: "Outdoor & Camping", topic: "Hunting & Fishing Gear", prompt: "where can I buy affordable hunting and fishing gear?" },
      { category: "Outdoor & Camping", topic: "Hunting & Fishing Gear", prompt: "what are the best freshwater fishing lures for bass?" },
      { category: "Outdoor & Camping", topic: "Hiking & Backpacking Equipment", prompt: "what is the best backpack for day hiking?" },
      { category: "Outdoor & Camping", topic: "Hiking & Backpacking Equipment", prompt: "which sleeping bag brands are best for cold weather camping?" },
      { category: "Outdoor & Camping", topic: "Hiking & Backpacking Equipment", prompt: "what are the best trekking poles for beginners?" },
      { category: "Outdoor & Camping", topic: "Outdoor Cooking & Grilling", prompt: "what is the best portable camping stove?" },
      { category: "Outdoor & Camping", topic: "Outdoor Cooking & Grilling", prompt: "which pellet grill brands have the best reviews?" },
      { category: "Outdoor & Camping", topic: "Outdoor Cooking & Grilling", prompt: "what are the best portable charcoal grills?" },
      { category: "Fitness Equipment", topic: "Home Gym Equipment", prompt: "what is the best home gym setup on a budget?" },
      { category: "Fitness Equipment", topic: "Home Gym Equipment", prompt: "which brand makes the best adjustable dumbbells?" },
      { category: "Fitness Equipment", topic: "Home Gym Equipment", prompt: "what are the best cardio machines for a home gym?" },
      { category: "Fitness Equipment", topic: "Cardio & Endurance Training", prompt: "what is the best treadmill for home use under $1,000?" },
      { category: "Fitness Equipment", topic: "Cardio & Endurance Training", prompt: "which stationary bike is best for beginners?" },
      { category: "Fitness Equipment", topic: "Cardio & Endurance Training", prompt: "what are the best jump ropes for cardio?" },
      { category: "Fitness Equipment", topic: "Strength & Weight Training", prompt: "what is the best barbell set for a home gym?" },
      { category: "Fitness Equipment", topic: "Strength & Weight Training", prompt: "which pull-up bar is the best for home workouts?" },
      { category: "Fitness Equipment", topic: "Strength & Weight Training", prompt: "what are the best resistance bands for strength training?" },
      { category: "Team & Youth Sports", topic: "Youth Baseball & Softball", prompt: "what is the best youth baseball glove for a 10 year old?" },
      { category: "Team & Youth Sports", topic: "Youth Baseball & Softball", prompt: "which sporting goods stores have the best baseball equipment?" },
      { category: "Team & Youth Sports", topic: "Youth Baseball & Softball", prompt: "what are the top youth baseball bat brands?" },
      { category: "Team & Youth Sports", topic: "Youth Football & Soccer", prompt: "what is the best youth football helmet for safety?" },
      { category: "Team & Youth Sports", topic: "Youth Football & Soccer", prompt: "which soccer cleats are best for youth players?" },
      { category: "Team & Youth Sports", topic: "Youth Football & Soccer", prompt: "what are the best youth football pads for beginners?" },
      { category: "Team & Youth Sports", topic: "Basketball Equipment", prompt: "what is the best basketball hoop for the driveway?" },
      { category: "Team & Youth Sports", topic: "Basketball Equipment", prompt: "which brand makes the best outdoor basketballs?" },
      { category: "Team & Youth Sports", topic: "Basketball Equipment", prompt: "what are the best basketball shoes for outdoor courts?" },
      { category: "Team & Youth Sports", topic: "Sports Protective Gear & Apparel", prompt: "what are the best sports sunglasses for outdoor activities?" },
      { category: "Team & Youth Sports", topic: "Sports Protective Gear & Apparel", prompt: "which compression shorts are best for athletes?" },
      { category: "Team & Youth Sports", topic: "Sports Protective Gear & Apparel", prompt: "what are the best athletic shorts for working out?" },
      { category: "Sporting Goods Retail", topic: "Sports Gear Value & Deals", prompt: "where can I find the best deals on sporting goods?" },
      { category: "Sporting Goods Retail", topic: "Sports Gear Value & Deals", prompt: "which sporting goods store has the best price match guarantee?" },
      { category: "Sporting Goods Retail", topic: "Sports Gear Value & Deals", prompt: "what sporting goods stores offer the best loyalty rewards?" },
      { category: "Sporting Goods Retail", topic: "Online vs In-Store Shopping", prompt: "is it better to buy running shoes online or in store?" },
      { category: "Sporting Goods Retail", topic: "Online vs In-Store Shopping", prompt: "which online sporting goods stores have the best return policies?" },
      { category: "Sporting Goods Retail", topic: "Online vs In-Store Shopping", prompt: "what are the top-rated sporting goods websites?" }
    ] });
    const _demoExec = { totalRequested: 51, totalSucceeded: 51, totalFailed: 0, webSearchUsed: true, webSearchCount: 51, results: [{ category: "Athletic Footwear", topic: "Performance Running Shoes", prompt: "what is the best running shoe for marathon training?", answer: "## Best Marathon Running Shoes\n\n**Nike Alphafly 3 / Vaporfly 3** — The elite choice. Carbon plate with ZoomX foam. What the pros wear at Boston and Chicago.\n\n**Adidas Adizero Adios Pro 3** — Nike's closest rival. Excellent energy return for race day.\n\n**Brooks Ghost 16** — The most popular non-elite marathon shoe. Neutral ride, very durable.\n\n**ASICS Gel-Kayano 31** — Great stability option for overpronators logging big miles.\n\n**New Balance Fresh Foam More v4** — Maximum cushion for high-mileage training.\n\nYou can find most of these at **Dick's Sporting Goods**, **Academy**, **Foot Locker**, or directly from brand sites." }, { category: "Athletic Footwear", topic: "Performance Running Shoes", prompt: "which running shoes have the best cushioning for long runs?", answer: "For maximum cushion on long runs:\n\n**Hoka Clifton 9** — The cushion king. Tall stack height with a soft, forgiving feel.\n\n**Brooks Glycerin 21** — Incredibly plush and smooth for easy days and long runs.\n\n**Nike Invincible 3** — Nike's softest shoe. Like running on marshmallows.\n\n**New Balance Fresh Foam 1080v13** — A luxury long-run shoe loved by runners.\n\n**ASICS Gel-Nimbus 26** — Premium cushion with great durability.\n\nAll available at **Dick's Sporting Goods**, **Foot Locker**, **Academy Sports**, and **REI**." }, { category: "Athletic Footwear", topic: "Performance Running Shoes", prompt: "what are the top running shoe brands for beginners?", answer: "Best brands for beginner runners:\n\n**Brooks** — Consistently rated the most beginner-friendly. The Ghost 16 is a perfect all-around starter shoe.\n\n**ASICS** — The Gel-Nimbus and Kayano lines are excellent for new runners.\n\n**New Balance** — Comfortable with wide width options. The 880 is a great starter.\n\n**Nike** — The Pegasus 41 is beloved by beginners and veterans alike.\n\n**Hoka** — Maximal cushioning is forgiving for new legs.\n\nGet fitted at specialty stores or buy from **Dick's Sporting Goods**, **Academy**, or **Running Warehouse**." }, { category: "Athletic Footwear", topic: "Basketball Footwear", prompt: "what is the best basketball shoe for ankle support?", answer: "## Best Basketball Shoes for Ankle Support\n\n**Nike LeBron 21** — High-top design with excellent lateral stability.\n\n**Adidas Harden Vol. 8** — Great lockdown fit.\n\n**Under Armour Curry 11** — Stephen Curry's signature with excellent ankle support.\n\n**Jordan Luka 3** — Solid ankle support with great court feel.\n\n**Nike Zoom Freak 5** — Built for bigger players who need stability.\n\nAll available at **Dick's Sporting Goods**, **Foot Locker**, **Academy Sports**, and most major retailers." }, { category: "Athletic Footwear", topic: "Basketball Footwear", prompt: "which basketball shoes do NBA players wear most?", answer: "In the current NBA season, the most popular brands are:\n\n**Nike / Jordan Brand** — By far the most worn. LeBron, KD, Luka, and Tatum all have Nike signatures.\n\n**Adidas** — Harden wears his own line. Smaller but significant market presence.\n\n**Under Armour** — Steph Curry's signature is the most popular non-Nike/Adidas option.\n\n**New Balance** — Growing presence with Kawhi Leonard's signature line.\n\n**Puma** — LaMelo Ball's signature has gained traction.\n\nNike holds roughly 70%+ of NBA player endorsements." }, { category: "Athletic Footwear", topic: "Basketball Footwear", prompt: "what are the best budget basketball shoes?", answer: "Best basketball shoes under $80:\n\n**Nike Precision 6** — Nike quality at a budget price point. Great for recreational play.\n\n**Adidas Pro Bounce** — Solid cushioning and support without the premium markup.\n\n**Under Armour Lockdown 6** — UA's entry-level shoe punches above its weight.\n\n**AND1 Impact 4** — Ultra-budget option great for outdoor courts.\n\n**Champion Focus** — Available at **Walmart** and **Academy** for under $30.\n\n**Academy Sports** and **Walmart** carry the widest range of budget basketball shoes in stores." }, { category: "Outdoor & Camping", topic: "Camping Gear & Tents", prompt: "what is the best tent for camping in the rain?", answer: "## Best Waterproof Camping Tents\n\n**REI Co-op Half Dome 2 Plus** — REI's top-rated all-weather tent. 2500mm waterproof rating, fully taped seams.\n\n**Big Agnes Copper Spur HV UL2** — Ultralight and genuinely waterproof. Popular with backpackers.\n\n**MSR Hubba Hubba** — Battle-tested in harsh conditions. 1500mm fly with taped seams.\n\n**Coleman Skydome** — Budget option with decent rain protection for car camping. At **Walmart**, **Academy**, and **Target**.\n\n**NatureHike Cloud Up 3** — Budget-friendly with excellent waterproofing for the price." }, { category: "Outdoor & Camping", topic: "Camping Gear & Tents", prompt: "which camping gear brands are the most reliable?", answer: "Most trusted camping gear brands:\n\n**REI Co-op** — Consistently rated for value and reliability.\n\n**MSR (Mountain Safety Research)** — Industry standard for backcountry reliability. Tents, stoves, and water filters used by professionals.\n\n**Black Diamond** — Technical climbing and camping gear built for real conditions.\n\n**Osprey** — The best backpacks in the business with a lifetime guarantee.\n\n**Coleman** — The benchmark for affordable car camping. Available at **Academy**, **Walmart**, and **Target**.\n\n**Magellan Outdoors** (Academy's private label) — Solid value for casual campers." }, { category: "Outdoor & Camping", topic: "Camping Gear & Tents", prompt: "what are the best family camping tents for under $200?", answer: "Best family tents under $200:\n\n**Coleman Sundome 6-Person** — The classic budget family tent. Under $100 at **Walmart**, **Academy**, and **Target**.\n\n**Coleman Skydome 6-Person** — Newer design with faster setup. Excellent value.\n\n**Core 10-Person Straight Wall** — Excellent room-to-price ratio. Under $200 on **Amazon**.\n\n**Ozark Trail 10-Person** — Walmart's house brand, surprisingly well-reviewed.\n\n**Magellan Outdoors tents** — Good mid-range options exclusive to **Academy**.\n\n**Dick's Sporting Goods** and **Academy** carry the best in-store selection of family tents." }, { category: "Outdoor & Camping", topic: "Hunting & Fishing Gear", prompt: "what is the best fishing rod setup for beginners?", answer: "Best beginner fishing rod combos:\n\n**Zebco 33 Spinning Combo** — The classic starter. $30-40 at virtually every outdoor store.\n\n**Shakespeare Ugly Stik Combo** — Gold standard for beginners. Exceptionally durable fiberglass construction.\n\n**Shimano Sienna FE Spinning Combo** — A step up. Smooth drag and good sensitivity.\n\nFor freshwater fishing, a 6'6\" medium-power spinning rod with 10lb monofilament is the best all-around setup.\n\nBuy at **Bass Pro Shops**, **Academy Sports**, **Walmart**, or **Cabela's**." }, { category: "Outdoor & Camping", topic: "Hunting & Fishing Gear", prompt: "where can I buy affordable hunting and fishing gear?", answer: "Best places for affordable hunting and fishing gear:\n\n**Academy Sports + Outdoors** — Best value in the South and Southeast. Competitive pricing on tackle, ammunition, and Mossy Oak apparel. Academy-exclusive Magellan Outdoors brand delivers solid quality.\n\n**Walmart** — Hard to beat for basic tackle and budget hunting accessories.\n\n**Bass Pro Shops / Cabela's** — Larger selection but typically higher prices. Best for specialty items.\n\n**Amazon** — Wide selection but you can't test gear or get in-person advice.\n\n**Dick's Sporting Goods** — More limited hunting selection compared to Academy or Bass Pro." }, { category: "Fitness Equipment", topic: "Home Gym Equipment", prompt: "what is the best home gym setup on a budget?", answer: "## Best Budget Home Gym\n\nFor under $500 you can build a solid foundation:\n\n**Adjustable Dumbbells** — Bowflex SelectTech 552 ($300) or Amazon Basics set ($100). Best ROI for any home gym.\n\n**Resistance Bands Set** — $20-40. Essential for warm-ups and accessory work.\n\n**Pull-Up Bar** — $25-40 doorframe bar. Lat work, rows, and ab work covered.\n\n**Jump Rope** — $10. Excellent cardio in a tiny footprint.\n\nAffordable options at **Amazon**, **Walmart**, **Target**, **Dick's Sporting Goods**, and **Academy**. Dick's and Academy have the best in-store selection." }, { category: "Fitness Equipment", topic: "Home Gym Equipment", prompt: "which brand makes the best adjustable dumbbells?", answer: "Best adjustable dumbbell brands:\n\n**Bowflex SelectTech 552** — The market leader. Replaces 15 sets of weights. At **Dick's Sporting Goods** and **Amazon**.\n\n**PowerBlock Elite EXP** — More durable than Bowflex with a better commercial feel.\n\n**NordicTrack Select-a-Weight** — Great value, sold at **Dick's Sporting Goods**.\n\n**NÜOBELL** — Most compact and premium feel. Great for small spaces.\n\n**CAP Barbell** — Budget option available at **Walmart** and **Academy**." }, { category: "Fitness Equipment", topic: "Home Gym Equipment", prompt: "what are the best cardio machines for a home gym?", answer: "Best home cardio machines by type:\n\n**Treadmill:** NordicTrack Commercial 1750 or Peloton Tread. Both at **Dick's Sporting Goods**. Budget option: Horizon T101 ($600).\n\n**Rowing Machine:** Concept2 RowErg is the gold standard. **Dick's** and **Academy** carry Sunny Health for budget options.\n\n**Stationary Bike:** Peloton Bike+ is premium. Echelon, NordicTrack, and Schwinn IC4 at lower price points.\n\n**Elliptical:** NordicTrack FS7i or Schwinn 470.\n\n**Jump Rope:** $15 at **Academy**, **Walmart**, or **Target** — best ROI in cardio." }, { category: "Team & Youth Sports", topic: "Youth Baseball & Softball", prompt: "what is the best youth baseball glove for a 10 year old?", answer: "Best youth baseball gloves for a 10-year-old:\n\n**Rawlings Players Series** — Most recommended entry-level glove. Pre-oiled and game-ready. $30-50 at **Dick's**, **Academy**, and **Walmart**.\n\n**Wilson A200** — Step up in quality. Good for players practicing regularly.\n\n**Mizuno Prospect** — Excellent leather quality for youth players.\n\n**Franklin CFX Pro** — Budget-friendly, often at **Walmart** and **Amazon**.\n\nFor 10-year-olds, look for 11\" to 11.5\". **Dick's** and **Academy** have the best in-store selection where kids can try gloves on." }, { category: "Team & Youth Sports", topic: "Youth Baseball & Softball", prompt: "which sporting goods stores have the best baseball equipment?", answer: "## Best Stores for Baseball Equipment\n\n**Dick's Sporting Goods** — The widest national selection. Carries Rawlings, Wilson, Easton, Louisville Slugger, and DeMarini under one roof.\n\n**Academy Sports + Outdoors** — Strong selection in the South/Southeast. Competitive pricing with knowledgeable staff. Excellent for youth equipment.\n\n**Baseball Express / JustBallGloves** — Online specialists with the deepest selection.\n\n**Amazon** — Best price comparison but no ability to try equipment.\n\nFor youth leagues, **Dick's** and **Academy** are the most convenient one-stop shops." }, { category: "Team & Youth Sports", topic: "Youth Baseball & Softball", prompt: "what are the top youth baseball bat brands?", answer: "Top youth baseball bat brands:\n\n**Easton** — The most popular youth bat brand. The ADV Hype is a consistent top seller at **Dick's** and **Academy**.\n\n**Louisville Slugger** — American icon. Meta and Atlas lines are excellent youth options.\n\n**DeMarini** — CF Glitch and Voodoo One are top performers. Slightly premium priced.\n\n**Rawlings** — 5150 and Quatro lines popular for USSSA leagues.\n\n**Marucci** — Growing with the CAT9 Connect series.\n\nAll available at **Dick's Sporting Goods**, **Academy**, and **Baseball Express**." },
      { category: "Athletic Footwear", topic: "Trail Running & Hiking Shoes", prompt: "what is the best trail running shoe for beginners?", answer: "Best trail running shoes for beginners:\n\n**Hoka Speedgoat 5** — The best all-around trail shoe. Maximal cushion, aggressive tread, handles most terrain.\n\n**Salomon Speedcross 6** — Aggressive lugs for muddy trails. Very popular with beginners.\n\n**Brooks Cascadia 16** — Cushioned and protective. Great for new trail runners.\n\n**New Balance Fresh Foam Hierro v7** — Road-to-trail crossover that's forgiving on varied terrain.\n\nAvailable at **REI**, **Dick's Sporting Goods**, **Academy**, and outdoor specialty stores." },
      { category: "Athletic Footwear", topic: "Trail Running & Hiking Shoes", prompt: "which hiking shoe brands are the most durable?", answer: "Most durable hiking shoe brands:\n\n**Merrell** — The benchmark for hiking footwear. The Moab series is essentially indestructible.\n\n**Keen** — Known for wide toe boxes and rugged construction. The Targhee III is a bestseller.\n\n**Salomon** — Technical precision and durability. Preferred by serious hikers.\n\n**Columbia** — Good durability at a mid-range price.\n\n**Danner** — Premium boots built for lifetime use.\n\nAvailable at **REI**, **Academy**, **Dick's Sporting Goods**, and **Bass Pro Shops**." },
      { category: "Athletic Footwear", topic: "Trail Running & Hiking Shoes", prompt: "what are the best waterproof hiking shoes?", answer: "Best waterproof hiking shoes:\n\n**Merrell Moab 3 Mid GTX** — The most popular waterproof hiking boot. GORE-TEX liner, excellent value.\n\n**Keen Targhee III Waterproof** — Wide toe box, great for wider feet.\n\n**Salomon X Ultra 4 GTX** — Technical trail shoe with GORE-TEX. Lightweight and fast.\n\n**Columbia Newton Ridge Plus II** — Excellent budget waterproof option.\n\nAvailable at **REI**, **Dick's Sporting Goods**, **Academy**, and **Bass Pro Shops**. REI has the best in-store selection." },
      { category: "Athletic Footwear", topic: "Cross-Training & Gym Shoes", prompt: "what is the best shoe for CrossFit training?", answer: "Best CrossFit shoes:\n\n**Nike Metcon 9** — The most popular CrossFit shoe. Stable for lifting, enough flex for rope climbs.\n\n**Reebok Nano X4** — Reebok's signature CrossFit shoe. Wide toe box, durable rubber sole.\n\n**New Balance Minimus TR** — Minimal shoe popular with barefoot-style CrossFitters.\n\n**Nobull Trainer** — Growing fast for its durability and versatility.\n\nAvailable at **Dick's Sporting Goods**, **Academy**, and brand sites." },
      { category: "Athletic Footwear", topic: "Cross-Training & Gym Shoes", prompt: "which cross-training shoes are best for weightlifting?", answer: "Best cross-training shoes for lifting:\n\n**Nike Metcon 9** — Flat, stable heel. Great for squats and deadlifts.\n\n**Adidas Adipower 3** — Purpose-built weightlifting shoe with elevated heel.\n\n**Reebok Legacy Lifter III** — 3/4\" heel raise, very popular in Olympic lifting.\n\n**New Balance Minimus TR** — Minimal stack height helps with proprioception.\n\nAvailable at **Dick's Sporting Goods**, **Academy**, and **Amazon**." },
      { category: "Athletic Footwear", topic: "Cross-Training & Gym Shoes", prompt: "what are the best gym shoes for flat feet?", answer: "Best gym shoes for flat feet:\n\n**Brooks Adrenaline GTS 23** — The gold standard stability shoe. Motion control keeps flat feet aligned.\n\n**ASICS Gel-Kayano 31** — Excellent medial post support for overpronators.\n\n**New Balance 860v13** — Great stability at a mid-range price.\n\n**Saucony Guide 16** — Lighter stability shoe for gym and casual running.\n\nGet fitted at **Fleet Feet** or check **Dick's Sporting Goods** and **Academy** for in-store fitting." },
      { category: "Outdoor & Camping", topic: "Hunting & Fishing Gear", prompt: "what are the best freshwater fishing lures for bass?", answer: "Best freshwater bass lures:\n\n**Rapala Original Floating** — The iconic crankbait. Works everywhere, year-round.\n\n**Strike King Red Eye Shad** — Lipless crankbait that excels in clear water.\n\n**Zoom Trick Worm** — Classic soft plastic. Unbeatable in heavily pressured lakes.\n\n**Gary Yamamoto Senko** — The most effective soft stickbait ever made.\n\n**Booyah Spinnerbait** — Great in murky water or heavy cover.\n\nAll available at **Bass Pro Shops**, **Academy**, **Cabela's**, and **Walmart**." },
      { category: "Outdoor & Camping", topic: "Hiking & Backpacking Equipment", prompt: "what is the best backpack for day hiking?", answer: "Best day hiking backpacks:\n\n**Osprey Talon 22** — The top-rated day hike pack. Great fit system and ventilation.\n\n**REI Flash 22** — REI's own pack. Excellent value, lightweight, and feature-rich.\n\n**Deuter Speed Lite 20** — Light and very durable. German engineering.\n\n**Gregory Zulu 30** — Slightly larger for longer days. Great ventilation.\n\nAvailable at **REI** (best selection), **Dick's Sporting Goods**, and **Academy**." },
      { category: "Outdoor & Camping", topic: "Hiking & Backpacking Equipment", prompt: "which sleeping bag brands are best for cold weather camping?", answer: "Best cold weather sleeping bags:\n\n**Marmot Trestles** — Best budget-to-value cold weather bag. At **REI** and **Dick's**.\n\n**REI Co-op Magma 15** — REI's own down bag. Exceptional at its price point.\n\n**Nemo Disco 15** — Great comfort for side sleepers. Spoon shape design.\n\n**Sea to Summit Spark** — Ultralight down for backpackers who count grams.\n\n**Coleman North Rim** — Budget option for car camping. At **Walmart**, **Target**, and **Academy**." },
      { category: "Outdoor & Camping", topic: "Hiking & Backpacking Equipment", prompt: "what are the best trekking poles for beginners?", answer: "Best beginner trekking poles:\n\n**REI Co-op Trailbreak** — REI's own pole. Affordable, adjustable, solid for beginners.\n\n**Black Diamond Trail** — The benchmark entry-level trekking pole. Durable and reliable.\n\n**Leki Cressida FX Carbon** — Ultralight for those who want to upgrade immediately.\n\n**Cascade Mountain Tech Aluminum** — The best budget pole. At **Costco** and **Amazon**.\n\nAvailable at **REI** (best selection), **Dick's Sporting Goods**, and **Academy**." },
      { category: "Outdoor & Camping", topic: "Outdoor Cooking & Grilling", prompt: "what is the best portable camping stove?", answer: "Best portable camping stoves:\n\n**Jetboil Flash** — The fastest boil time. Perfect for backpackers.\n\n**MSR PocketRocket Deluxe** — Gold standard ultralight stove. Simmers well.\n\n**Camp Chef Everest 2X** — Best two-burner for car camping. Very stable and powerful.\n\n**Coleman Classic Propane** — The iconic two-burner. Available everywhere for $50-70.\n\nAvailable at **REI**, **Bass Pro Shops**, **Academy**, and **Walmart**." },
      { category: "Outdoor & Camping", topic: "Outdoor Cooking & Grilling", prompt: "which pellet grill brands have the best reviews?", answer: "Top-rated pellet grill brands:\n\n**Traeger** — The original and most recognized brand. Pro 575 is the most popular model.\n\n**Pit Boss** — The best value in pellet grills. Available at **Walmart**, **Academy**, and **Lowe's**.\n\n**Weber SmokeFire EX4** — Strong reputation for quality from a trusted brand.\n\n**Camp Chef Woodwind** — Excellent temperature control with slide-and-grill feature.\n\n**Z Grills** — Budget-friendly option at **Amazon** and **Academy**.\n\n**Academy Sports** and **Walmart** carry the widest in-store selection of pellet grills." },
      { category: "Outdoor & Camping", topic: "Outdoor Cooking & Grilling", prompt: "what are the best portable charcoal grills?", answer: "Best portable charcoal grills:\n\n**Weber Original Kettle 22\"** — The undisputed king. Available at virtually every retailer.\n\n**Weber Go-Anywhere** — The best portable for camping or tailgating.\n\n**Cuisinart CCG-190 Portable** — Compact and affordable. Great for picnics.\n\n**Lodge 12\" Cast Iron Sportsman** — For the serious outdoor cook.\n\nAvailable at **Walmart**, **Academy**, **Target**, **Home Depot**, and **Amazon**." },
      { category: "Fitness Equipment", topic: "Cardio & Endurance Training", prompt: "what is the best treadmill for home use under $1,000?", answer: "Best home treadmills under $1,000:\n\n**NordicTrack T 6.5 Si** — Most popular home treadmill. iFit integration, folds up. At **Dick's Sporting Goods** and **Academy**.\n\n**Horizon T101** — Consistently rated for quality at a budget price.\n\n**Sole F63** — Excellent commercial-grade feel at a consumer price.\n\n**Sunny Health SF-T7515** — Best budget option under $600. On **Amazon**.\n\nDick's and Academy have the most models available to try in-store." },
      { category: "Fitness Equipment", topic: "Cardio & Endurance Training", prompt: "which stationary bike is best for beginners?", answer: "Best stationary bikes for beginners:\n\n**Peloton Bike** — Premium experience with live classes. Best motivation tool in its class.\n\n**Echelon EX-3** — Best value Peloton alternative. At **Dick's Sporting Goods**.\n\n**Schwinn IC4** — Indoor cycling at a mid-range price. Works with many apps.\n\n**NordicTrack S22i** — Best screen and incline simulation in this price range.\n\n**Marcy Upright Fan Bike** — Budget air bike for HIIT at **Walmart** and **Academy**.\n\nDick's Sporting Goods and Academy are best for trying bikes in-store." },
      { category: "Fitness Equipment", topic: "Cardio & Endurance Training", prompt: "what are the best jump ropes for cardio?", answer: "Best jump ropes:\n\n**Crossrope Get Lean Set** — The premium weighted rope system for serious cardio.\n\n**RPM Speed Rope** — The most popular rope for double-unders in CrossFit.\n\n**WOD Nation Speed Rope** — Great beginner speed rope under $15.\n\n**Buddy Lee Aero Speed** — Used by professional boxers. On **Amazon**.\n\nBasic jump ropes available at **Academy**, **Walmart**, and **Target** for under $15." },
      { category: "Fitness Equipment", topic: "Strength & Weight Training", prompt: "what is the best barbell set for a home gym?", answer: "Best home gym barbell sets:\n\n**Rep Fitness Sabre Bar** — Best value Olympic barbell. Great knurl and spin at $200-300.\n\n**Rogue Ohio Bar** — The benchmark mid-tier barbell. Lifetime warranty.\n\n**Titan Fitness Olympic Barbell** — Budget-friendly alternative to Rogue.\n\n**CAP Barbell Olympic 7' Bar** — Entry-level option at **Walmart**, **Academy**, and **Amazon**.\n\nFor full sets with weights, **Dick's Sporting Goods** and **Academy** have the best in-store selection." },
      { category: "Fitness Equipment", topic: "Strength & Weight Training", prompt: "which pull-up bar is the best for home workouts?", answer: "Best home pull-up bars:\n\n**Iron Gym Total Upper Body** — The original doorframe pull-up bar. No screws needed. Available everywhere.\n\n**Perfect Fitness Multi-Gym Pro** — Multi-grip positions for pull-ups, dips, and sit-ups.\n\n**Weider Power Tower** — Freestanding with dip station, leg raise, and pull-up bar.\n\n**Valor Fitness BD-62** — Wall-mounted. Most stable option for serious training.\n\nAvailable at **Amazon**, **Dick's Sporting Goods**, **Walmart**, and **Academy**." },
      { category: "Fitness Equipment", topic: "Strength & Weight Training", prompt: "what are the best resistance bands for strength training?", answer: "Best resistance bands:\n\n**Rogue Monster Bands** — The most durable bands used in CrossFit boxes.\n\n**Rep Fitness Pull-Up Bands** — Best value for serious training.\n\n**Fit Simplify Resistance Loop Bands** — Best for rehab and warm-ups. Set of 5 for under $15.\n\n**WOD Nation Band** — Good mid-tier option.\n\nAvailable at **Amazon**, **Dick's Sporting Goods**, **Academy**, and **Target**." },
      { category: "Team & Youth Sports", topic: "Youth Football & Soccer", prompt: "what is the best youth football helmet for safety?", answer: "Best youth football helmets by safety rating:\n\n**Riddell SpeedFlex** — Top safety rating, used in youth programs nationwide. At **Dick's** and **Academy**.\n\n**VICIS Zero2** — Highest STAR safety rating. Premium but best protection available.\n\n**Schutt F7 VTD** — Great protection at a mid-range price.\n\n**Xenith Shadow XR** — Good safety rating and fit at under $200.\n\n**Dick's Sporting Goods** and **Academy** carry the widest selection of youth football helmets." },
      { category: "Team & Youth Sports", topic: "Youth Football & Soccer", prompt: "which soccer cleats are best for youth players?", answer: "Best soccer cleats for youth players:\n\n**Nike Mercurial Vapor** — The most popular youth cleat brand. Speed-focused, used at every level.\n\n**Adidas Predator** — Best for control and touch. Slightly wider fit than Nike.\n\n**Puma Future 7** — Growing fast in youth soccer. Good value.\n\n**New Balance Furon** — Often overlooked but excellent quality for youth players.\n\nAvailable at **Dick's Sporting Goods**, **Academy**, **Soccer.com**, and **Amazon**." },
      { category: "Team & Youth Sports", topic: "Youth Football & Soccer", prompt: "what are the best youth football pads for beginners?", answer: "Best youth football shoulder pads:\n\n**Riddell Alpha** — Most popular in youth leagues. Good protection at an accessible price.\n\n**Douglas CP Series** — Excellent mobility without sacrificing protection.\n\n**Schutt All-Star XV HD** — Lightweight option good for skill positions.\n\n**Adams Pro Elite** — Budget-friendly entry into organized play.\n\n**Dick's Sporting Goods** and **Academy** both carry a strong selection. Academy typically has better everyday pricing." },
      { category: "Team & Youth Sports", topic: "Basketball Equipment", prompt: "what is the best basketball hoop for the driveway?", answer: "Best driveway basketball hoops:\n\n**Lifetime Pro Court Height-Adjustable** — Best value at $300-400. At **Walmart**, **Target**, and **Academy**.\n\n**Spalding 60-inch In-Ground** — Premium in-ground option with glass backboard.\n\n**Goalsetter G25** — Best adjustable residential hoop. Very stable pole system.\n\n**Goaliath GoTek54** — Mid-range in-ground at a reasonable price.\n\nWalmart and Academy have the best in-store portable hoops." },
      { category: "Team & Youth Sports", topic: "Basketball Equipment", prompt: "which brand makes the best outdoor basketballs?", answer: "Best outdoor basketballs:\n\n**Wilson Evolution** — The most popular basketball. Used in high school gyms nationwide.\n\n**Spalding NBA Official Game Ball** — The official NBA ball. At **Dick's** and **Academy**.\n\n**Nike Elite Competition** — Official ball of multiple top leagues. Excellent grip.\n\n**Molten GG7X** — FIBA-approved. Popular with international players.\n\n**Wilson NCAA** — Best budget option. At **Walmart**, **Target**, and **Academy**." },
      { category: "Team & Youth Sports", topic: "Basketball Equipment", prompt: "what are the best basketball shoes for outdoor courts?", answer: "Best basketball shoes for outdoor courts:\n\n**Nike Air Force 1** — The most iconic outdoor basketball sneaker. Durable rubber sole.\n\n**Adidas Forum Low** — Classic outdoor court shoe. Excellent durability on asphalt.\n\n**Jordan 1 Low** — Great for outdoor play with solid rubber outsole.\n\n**Under Armour Lockdown 6** — Best budget outdoor court shoe. At **Academy** and **Dick's**.\n\nAvailable at **Foot Locker**, **Dick's Sporting Goods**, **Academy**, and **Walmart**." },
      { category: "Team & Youth Sports", topic: "Sports Protective Gear & Apparel", prompt: "what are the best sports sunglasses for outdoor activities?", answer: "Best sports sunglasses:\n\n**Oakley Flak 2.0 XL** — The benchmark sports sunglass. Polarized, lightweight, impact-resistant.\n\n**Nike Vision Windshield** — Wide lens for cycling, running, and outdoor sports.\n\n**Under Armour Hustle** — Good everyday sports sunglass at a mid-range price.\n\n**Maui Jim Peahi** — Best polarization for water sports and fishing.\n\nAvailable at **Dick's Sporting Goods**, **Academy**, **REI**, and **Sunglass Hut**." },
      { category: "Team & Youth Sports", topic: "Sports Protective Gear & Apparel", prompt: "which compression shorts are best for athletes?", answer: "Best compression shorts for athletes:\n\n**Nike Pro Compression** — The most worn compression shorts in athletics. Great fit and durability.\n\n**Under Armour HeatGear** — Top competitor to Nike. Excellent moisture-wicking.\n\n**2XU Core Compression** — Premium compression used by serious athletes.\n\n**Tommie Copper** — Popular for recovery compression. At **Target** and **Amazon**.\n\nNike and Under Armour compression shorts are available at **Dick's Sporting Goods**, **Academy**, **Amazon**, and **Target**." },
      { category: "Team & Youth Sports", topic: "Sports Protective Gear & Apparel", prompt: "what are the best athletic shorts for working out?", answer: "Best athletic shorts for the gym:\n\n**Nike Dri-FIT 7\"** — The best-selling athletic short in America. Comfortable and durable.\n\n**Under Armour Launch 7\"** — Excellent moisture-wicking for high-intensity workouts.\n\n**Lululemon Pace Breaker** — Premium feel. Popular with gym-goers who want performance and style.\n\n**Champion 9\" Training Short** — Best budget option. At **Target**, **Walmart**, and **Academy**.\n\n**BCG Performance Short** — Academy's private label. Excellent value, exclusive to **Academy Sports**.\n\nDick's Sporting Goods and Academy carry the widest in-store selection." },
      { category: "Sporting Goods Retail", topic: "Sports Gear Value & Deals", prompt: "where can I find the best deals on sporting goods?", answer: "Best places for sporting goods deals:\n\n**Academy Sports + Outdoors** — Known for everyday low prices. Consistently competitive without needing to wait for sales.\n\n**Dick's Sporting Goods** — Semi-annual sales (Black Friday, back-to-school) offer the deepest discounts.\n\n**Amazon** — Prime Day deals on fitness equipment and footwear are excellent.\n\n**Walmart** — Unbeatable on basics and kids' gear.\n\n**REI Garage Sale** — REI's annual member sale has heavily discounted outdoor gear." },
      { category: "Sporting Goods Retail", topic: "Sports Gear Value & Deals", prompt: "which sporting goods store has the best price match guarantee?", answer: "Price match policies compared:\n\n**Dick's Sporting Goods** — Matches competitor prices in-store and online within 14 days.\n\n**Academy Sports** — Price match within 30 days. Matches Amazon, Walmart, and major competitors.\n\n**Target** — Price match on sports gear within 14 days, including Amazon.\n\n**Walmart** — Matches local competitor in-store prices.\n\n**REI** — Does not price match but offers members 10% back annually.\n\nAcademy's 30-day window is the most generous." },
      { category: "Sporting Goods Retail", topic: "Sports Gear Value & Deals", prompt: "what sporting goods stores offer the best loyalty rewards?", answer: "Best loyalty programs in sporting goods:\n\n**REI Co-op Membership** — $30 lifetime membership earns 10% back on most purchases annually. Best long-term value.\n\n**Dick's ScoreCard** — Free program, earns points toward rewards. Platinum level unlocks 4% back.\n\n**Academy Credit Card** — Special financing and periodic rewards for cardholders.\n\n**Foot Locker FLX** — Good for sneaker buyers. Early access to releases plus rewards points.\n\n**Nike Membership** — Free, earns points toward gear and exclusive early access." },
      { category: "Sporting Goods Retail", topic: "Online vs In-Store Shopping", prompt: "is it better to buy running shoes online or in store?", answer: "Online vs in-store for running shoes:\n\n**In-store is better** if you're new to running — getting fitted at **Fleet Feet**, **Dick's Sporting Goods**, or **Academy** helps avoid buying the wrong shoe.\n\n**Online is better** for reordering a shoe you know fits, price comparison (**Running Warehouse**, **Amazon**, **Road Runner Sports**), and finding wide/narrow widths.\n\nFor serious runners: get fitted in-store, then reorder online at a discount." },
      { category: "Sporting Goods Retail", topic: "Online vs In-Store Shopping", prompt: "which online sporting goods stores have the best return policies?", answer: "Best return policies for sporting goods:\n\n**REI** — The gold standard. Return within 1 year (members). No-questions-asked.\n\n**Zappos** — Best for footwear. 365-day return, free return shipping.\n\n**Dick's Sporting Goods** — 60-day return on most items including worn footwear.\n\n**Academy Sports** — 60-day return policy on most items.\n\n**Amazon** — 30 days; third-party items vary.\n\n**Foot Locker** — 45-day return on unworn footwear." },
      { category: "Sporting Goods Retail", topic: "Online vs In-Store Shopping", prompt: "what are the top-rated sporting goods websites?", answer: "Top sporting goods websites by selection and experience:\n\n**Dickssportinggoods.com** — Widest general sporting goods selection online.\n\n**REI.com** — Best for outdoor gear. Excellent editorial content and reviews.\n\n**Academy.com** — Strong value, especially for hunting/fishing, team sports, and footwear.\n\n**Amazon Sports** — Best pricing and selection for fitness equipment.\n\n**RunningWarehouse.com** — Best for running shoes. Deepest selection and expert reviews.\n\n**Eastbay.com** — Best for athletic footwear and team sports gear." }
    ] };
    _demoExec.results = attachDemoSources(_demoExec.results);
    setResults(_demoExec);
    setAnalysis({ totalPrompts: 51, totalMentions: 2800, rankings: [{ brand: "Dick's Sporting Goods", shareOfVoice: 18.2, mentions: 510, isPrimary: false }, { brand: "Amazon", shareOfVoice: 14.6, mentions: 409, isPrimary: false }, { brand: "Walmart", shareOfVoice: 11.4, mentions: 319, isPrimary: false }, { brand: "Nike", shareOfVoice: 8.9, mentions: 249, isPrimary: false }, { brand: b, shareOfVoice: 6.8, mentions: 190, isPrimary: true }, { brand: "REI", shareOfVoice: 6.1, mentions: 171, isPrimary: false }, { brand: "Under Armour", shareOfVoice: 5.4, mentions: 151, isPrimary: false }, { brand: "Foot Locker", shareOfVoice: 4.3, mentions: 120, isPrimary: false }, { brand: "Adidas", shareOfVoice: 3.6, mentions: 101, isPrimary: false }, { brand: "Bass Pro Shops", shareOfVoice: 2.9, mentions: 81, isPrimary: false }], categoryBreakdown: [{ category: "Athletic Footwear", rankings: [{ brand: "Nike", shareOfVoice: 28.0 }, { brand: "Dick's Sporting Goods", shareOfVoice: 20.0 }, { brand: "Foot Locker", shareOfVoice: 16.0 }, { brand: b, shareOfVoice: 12.0 }, { brand: "Under Armour", shareOfVoice: 8.0 }] }, { category: "Outdoor & Camping", rankings: [{ brand: "REI", shareOfVoice: 26.0 }, { brand: "Bass Pro Shops", shareOfVoice: 18.0 }, { brand: b, shareOfVoice: 15.0 }, { brand: "Amazon", shareOfVoice: 12.0 }, { brand: "Walmart", shareOfVoice: 9.0 }] }, { category: "Fitness Equipment", rankings: [{ brand: "Amazon", shareOfVoice: 24.0 }, { brand: "Dick's Sporting Goods", shareOfVoice: 18.0 }, { brand: "Walmart", shareOfVoice: 14.0 }, { brand: "Peloton", shareOfVoice: 10.0 }, { brand: b, shareOfVoice: 6.0 }] }, { category: "Team & Youth Sports", rankings: [{ brand: "Dick's Sporting Goods", shareOfVoice: 24.0 }, { brand: b, shareOfVoice: 20.0 }, { brand: "Amazon", shareOfVoice: 14.0 }, { brand: "Walmart", shareOfVoice: 12.0 }, { brand: "Rawlings", shareOfVoice: 8.0 }] }, { category: "Sporting Goods Retail", rankings: [{ brand: "Dick's Sporting Goods", shareOfVoice: 22.0 }, { brand: "Amazon", shareOfVoice: 18.0 }, { brand: b, shareOfVoice: 15.0 }, { brand: "Walmart", shareOfVoice: 12.0 }, { brand: "REI", shareOfVoice: 8.0 }] }], llmBreakdown: { platforms: ["All Platforms", "ChatGPT", "Gemini", "Perplexity", "Copilot", "AI Overviews"], brands: [{ brand: "Dick's Sporting Goods", isPrimary: false, scores: [18.2, 20.1, 17.4, 15.8, 19.3, 22.6] }, { brand: "Amazon", isPrimary: false, scores: [14.6, 16.8, 13.9, 11.2, 15.4, 17.8] }, { brand: "Walmart", isPrimary: false, scores: [11.4, 12.3, 10.8, 9.6, 12.1, 13.5] }, { brand: "Nike", isPrimary: false, scores: [8.9, 8.2, 10.1, 9.4, 8.6, 7.8] }, { brand: b, isPrimary: true, scores: [6.8, 5.2, 6.1, 9.4, 7.8, 4.1] }, { brand: "REI", isPrimary: false, scores: [6.1, 5.9, 7.2, 8.3, 6.0, 4.2] }, { brand: "Under Armour", isPrimary: false, scores: [5.4, 5.9, 4.8, 4.2, 5.6, 5.1] }, { brand: "Bass Pro Shops", isPrimary: false, scores: [2.9, 2.4, 3.5, 4.1, 2.8, 1.9] }] } });
    setIsDemo(true); setCurrentStep(7); setBrand(b);
  };

  const toggleSection = (key) => setCollapsedSections(prev => ({ ...prev, [key]: !prev[key] }));
  const isSectionOpen = (key) => !collapsedSections[key];
  const toggleCategory = (cat) => setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  const hasData = discovery || market || prompts || results || analysis;

  // Cited Sources — aggregate URLs returned by execute-prompts, filtered by brand-owned domains.
  const sourcesAggregate = useMemo(() => {
    if (!results?.results?.length) return null;
    return aggregateSources(results.results, buildExclusion(discovery));
  }, [results, discovery]);

  const sourcesAvailable = !!(sourcesAggregate && (sourcesAggregate.totals.reddit + sourcesAggregate.totals.youtube + sourcesAggregate.totals.url) > 0);
  const webSearchOff = !!results && results.webSearchUsed === false;

  const handleSourcesCsv = (kind) => {
    if (!sourcesAggregate) return;
    const brandSlug = slugifyForFile(discovery?.brand || brand);
    const stamp = todayStamp();

    const flatRows = [];
    for (const cat of Object.keys(sourcesAggregate.byCategory)) {
      const entries = sourcesAggregate.byCategory[cat][kind] || [];
      for (const e of entries) {
        const topics = Array.from(e.topics || []);
        if (topics.length === 0) topics.push("");
        for (const topic of topics) {
          flatRows.push({ category: cat, topic, entry: e });
        }
      }
    }

    if (kind === "reddit") {
      const rows = flatRows.map(({ category, topic, entry }) => ({
        category,
        topic,
        url: entry.url,
        subreddit: extractSubreddit(entry.url),
        thread_title: entry.title,
        mention_count: entry.perTopic?.[topic] ?? entry.count,
      }));
      downloadCsv(`${brandSlug}-cited-reddit-${stamp}.csv`, rows, [
        { key: "category", header: "category" },
        { key: "topic", header: "topic" },
        { key: "url", header: "url" },
        { key: "subreddit", header: "subreddit" },
        { key: "thread_title", header: "thread_title" },
        { key: "mention_count", header: "mention_count" },
      ]);
      return;
    }
    if (kind === "youtube") {
      const rows = flatRows.map(({ category, topic, entry }) => ({
        category,
        topic,
        url: entry.url,
        video_id: extractYoutubeId(entry.url),
        channel_or_title: entry.title,
        mention_count: entry.perTopic?.[topic] ?? entry.count,
      }));
      downloadCsv(`${brandSlug}-cited-youtube-${stamp}.csv`, rows, [
        { key: "category", header: "category" },
        { key: "topic", header: "topic" },
        { key: "url", header: "url" },
        { key: "video_id", header: "video_id" },
        { key: "channel_or_title", header: "channel_or_title" },
        { key: "mention_count", header: "mention_count" },
      ]);
      return;
    }
    const rows = flatRows.map(({ category, topic, entry }) => ({
      category,
      topic,
      url: entry.url,
      host: entry.host,
      title: entry.title,
      mention_count: entry.perTopic?.[topic] ?? entry.count,
    }));
    downloadCsv(`${brandSlug}-cited-urls-${stamp}.csv`, rows, [
      { key: "category", header: "category" },
      { key: "topic", header: "topic" },
      { key: "url", header: "url" },
      { key: "host", header: "host" },
      { key: "title", header: "title" },
      { key: "mention_count", header: "mention_count" },
    ]);
  };

  const handleAllSourcesCsv = () => {
    if (!sourcesAggregate) return;
    const brandSlug = slugifyForFile(discovery?.brand || brand);
    const stamp = todayStamp();
    const rows = [];
    for (const [kind, kindLabel] of [["url", "url"], ["reddit", "reddit"], ["youtube", "youtube"]]) {
      for (const cat of Object.keys(sourcesAggregate.byCategory)) {
        const entries = sourcesAggregate.byCategory[cat][kind] || [];
        for (const e of entries) {
          const topics = Array.from(e.topics || []);
          if (topics.length === 0) topics.push("");
          for (const topic of topics) {
            rows.push({
              type: kindLabel,
              category: cat,
              topic,
              url: e.url,
              host: e.host,
              title: e.title,
              subreddit: kind === "reddit" ? extractSubreddit(e.url) : "",
              video_id: kind === "youtube" ? extractYoutubeId(e.url) : "",
              mention_count: e.perTopic?.[topic] ?? e.count,
            });
          }
        }
      }
    }
    downloadCsv(`${brandSlug}-cited-sources-${stamp}.csv`, rows, [
      { key: "type", header: "type" },
      { key: "category", header: "category" },
      { key: "topic", header: "topic" },
      { key: "url", header: "url" },
      { key: "host", header: "host" },
      { key: "title", header: "title" },
      { key: "subreddit", header: "subreddit" },
      { key: "video_id", header: "video_id" },
      { key: "mention_count", header: "mention_count" },
    ]);
  };

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
            <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color: "#0c1222", margin: 0, letterSpacing: -0.5 }}>Off-Site Market Discovery</h1>
            <p style={{ color: "#8896a7", fontSize: 14, margin: "6px 0 0", letterSpacing: 0.1 }}>Off-site brand visibility, AI share of voice & competitive landscape</p>
          </div>

          {/* Input + Pipeline row */}
          <div style={{ display: "flex", gap: 20, marginBottom: 24, alignItems: "stretch" }}>
            <div style={{ background: "#fff", borderRadius: 16, border: "1px solid #e8ecf1", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)", width: 360, flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Brand Name <span style={{ color: "#ef4444" }}>*</span></label>
                  <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Adobe, Nike, Notion..." onKeyDown={e => e.key === "Enter" && !loading && runPipeline()} style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #dde3ea", borderRadius: 10, padding: "11px 14px", color: "#0c1222", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif" }} />
                </div>
                <div style={{ width: 90 }}>
                  <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Region</label>
                  <select value={region} onChange={e => setRegion(e.target.value)} style={{ width: "100%", background: "#f8fafc", border: "1.5px solid #dde3ea", borderRadius: 10, padding: "11px 10px", color: "#0c1222", fontSize: 14, outline: "none", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%2394a3b8' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}>
                    <option value="US">US</option>
                    <option value="CA">CA</option>
                    <option value="UK">UK</option>
                    <option value="DE">DE</option>
                    <option value="FR">FR</option>
                    <option value="AU">AU</option>
                    <option value="JP">JP</option>
                    <option value="BR">BR</option>
                    <option value="IN">IN</option>
                    <option value="Global">Global</option>
                  </select>
                </div>
              </div>
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
                  {(isDemo ? DEMO_STEPS : PIPELINE_STEPS).map((s, i) => {
                    const completed = i < currentStep;
                    const active = i === currentStep && loading;

                    return (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {completed ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="10" fill="#22c55e"/><path d="M6 10.5L8.5 13L14 7.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        : active ? <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: "spin 1s linear infinite" }}><circle cx="10" cy="10" r="8" stroke="#e2e8f0" strokeWidth="2"/><path d="M18 10a8 8 0 0 0-8-8" stroke="#2563eb" strokeWidth="2" strokeLinecap="round"/></svg>
                        : <div style={{ width: 20, height: 20, borderRadius: "50%", border: "2px solid #e2e8f0", boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#b0b8c4", fontWeight: 600 }}>{i + 1}</div>}
                        <span style={{ fontSize: 14, color: completed || active ? "#1e293b" : "#b0b8c4", fontWeight: completed || active ? 600 : 400 }}>{s}</span>
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
            <SectionCard accentColor="#2563eb" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>} title="Brand Profile" badge={null} isOpen={isSectionOpen("brand")} onToggle={() => toggleSection("brand")} loading={!discovery && currentStep >= 0} loadingText="Discovering brand...">
              {discovery && (
                <>
                  <div style={{ marginBottom: 18 }}>
                    <span style={{ fontSize: 12, background: "#f1f5f9", color: "#475569", padding: "4px 12px", borderRadius: 6, fontWeight: 600, border: "1px solid #e2e8f0" }}>{discovery.industry}</span>
                    <span style={{ fontSize: 12, background: "#dbeafe", color: "#1e40af", padding: "4px 10px", borderRadius: 6, fontWeight: 600, border: "1px solid #bfdbfe", marginLeft: 6 }}>{region}</span>
                    {discovery.availableRegions && discovery.availableRegions.length > 1 && (
                      <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>Also available in: {discovery.availableRegions.filter(r => r !== region).join(", ")}</span>
                    )}
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
            <SectionCard accentColor="#7c3aed" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2"><path d="M3 3v18h18"/><path d="M7 16l4-8 4 4 6-6"/></svg>} title="Market Categories & Topics" badge={null} isOpen={isSectionOpen("market")} onToggle={() => toggleSection("market")} loading={!market && currentStep >= 1} loadingText="Researching market...">
              {market && (() => {
                const catColors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4"];
                const cols = market.categories?.length === 1 ? 1 : 2;
                return (
                  <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 }}>
                    {market.categories?.map((c, i) => {
                      const color = catColors[i % catColors.length];
                      const promptCount = (c.topics?.length || 0) * 3;
                      return (
                        <div key={i} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b", lineHeight: 1.3 }}>{c.name}</div>
                            <span style={{ fontSize: 10, color, background: `${color}18`, border: `1px solid ${color}35`, borderRadius: 4, padding: "2px 7px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0 }}>{promptCount} prompts</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {c.topics?.map((t, j) => (
                              <div key={j} style={{ fontSize: 12, color: "#475569", display: "flex", alignItems: "flex-start", gap: 7, lineHeight: 1.5, background: "#fff", border: "1px solid #e8ecf1", borderRadius: 7, padding: "6px 10px" }}>
                                <span style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0, marginTop: 4 }} />
                                {t}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
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
            <SectionCard accentColor="#0891b2" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>} title={results ? `Prompt Results (${results.totalSucceeded}/${results.totalRequested} completed)` : "Prompt Results"} badge={null} isOpen={isSectionOpen("results")} onToggle={() => toggleSection("results")} loading={!results && currentStep >= 3} loadingText="Executing prompts...">
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

            {/* LLM Platform Breakdown */}
            {analysis?.llmBreakdown && (() => {
              const { platforms, brands: llmBrands } = analysis.llmBreakdown;
              const platformIcons = {
                "ChatGPT": <svg width="14" height="14" viewBox="0 0 24 24" fill="#10a37f"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z"/></svg>,
                "Gemini": <svg width="14" height="14" viewBox="0 0 24 24"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0z" fill="#8E75B2"/></svg>,
                "Perplexity": <svg width="14" height="14" viewBox="0 0 24 24" fill="#1a7f64"><circle cx="12" cy="12" r="12"/></svg>,
                "Copilot": <svg width="14" height="14" viewBox="0 0 24 24" fill="#0078d4"><circle cx="12" cy="12" r="12"/></svg>,
                "AI Overviews": <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>,
              };
              return (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Share of Voice by LLM Platform</div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'DM Sans', sans-serif" }}>
                      <thead>
                        <tr>
                          <th style={{ textAlign: "left", padding: "10px 12px", color: "#64748b", borderBottom: "2px solid #e2e8f0", fontWeight: 700, fontSize: 12, width: 130 }}>Brands</th>
                          {platforms.map((p, pi) => (
                            <th key={pi} style={{ textAlign: "left", padding: "10px 12px", color: "#475569", borderBottom: "2px solid #e2e8f0", fontWeight: 700, fontSize: 12 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                {platformIcons[p] || null}
                                {p}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {llmBrands.map((row, ri) => (
                          <tr key={ri} style={{ background: row.isPrimary ? "#eff6ff" : ri % 2 === 0 ? "#f8fafc" : "#fff" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: 13, color: row.isPrimary ? "#2563eb" : "#1e293b", borderBottom: "1px solid #f1f5f9" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <BrandLogo brand={row.brand} size={20} />
                                {row.brand}
                              </div>
                            </td>
                            {row.scores.map((score, si) => {
                              const isMax = score === Math.max(...llmBrands.map(b => b.scores[si]));
                              const barColor = row.isPrimary ? "#2563eb" : "#94a3b8";
                              return (
                                <td key={si} style={{ padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <span style={{ fontSize: 13, fontWeight: isMax ? 700 : 500, color: isMax ? "#1e293b" : "#64748b", minWidth: 38 }}>{score.toFixed(1)}%</span>
                                    <div style={{ flex: 1, background: "#e2e8f0", borderRadius: 3, height: 5, overflow: "hidden", minWidth: 40 }}>
                                      <div style={{ width: `${Math.min(score * 2.5, 100)}%`, height: "100%", background: row.isPrimary ? "#2563eb" : "#94a3b8", borderRadius: 3 }} />
                                    </div>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </SectionCard>

          {/* Cited Sources — third-party URLs surfaced by web search, grouped by category/topic */}
          {results && (
            <div style={{ marginTop: 20 }}>
              <SectionCard
                accentColor="#0ea5e9"
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>}
                title="Cited Sources"
                isOpen={isSectionOpen("sources")}
                onToggle={() => toggleSection("sources")}
              >
                {webSearchOff && !sourcesAvailable ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    Cited sources require web search. Set <code style={{ background: "#fff", padding: "1px 5px", borderRadius: 4, border: "1px solid #e2e8f0" }}>TAVILY_API_KEY</code> in your environment to surface third-party citations per category and topic.
                  </div>
                ) : !sourcesAvailable ? (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px 16px", fontSize: 13, color: "#64748b" }}>
                    No third-party citations available yet.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        onClick={handleAllSourcesCsv}
                        style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#0ea5e9", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, color: "#fff", fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        Download All Sources
                      </button>
                    </div>
                    {[
                      { kind: "url", label: "Cited URLs", color: "#0ea5e9", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#0ea5e9" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> },
                      { kind: "reddit", label: "Cited Reddit", color: "#FF4500", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 13.38c.15.36.24.76.24 1.18 0 2.42-2.82 4.38-6.3 4.38s-6.3-1.96-6.3-4.38c0-.42.09-.82.25-1.18a1.5 1.5 0 0 1-.6-1.2c0-.82.67-1.5 1.5-1.5.4 0 .77.16 1.04.42 1.02-.74 2.43-1.22 4-1.28l.76-3.54a.32.32 0 0 1 .38-.24l2.5.53a1.07 1.07 0 1 1-.12.56l-2.23-.47-.68 3.16c1.53.08 2.9.56 3.9 1.28.26-.25.63-.4 1.02-.4.83 0 1.5.67 1.5 1.5 0 .48-.23.9-.58 1.18z"/></svg> },
                      { kind: "youtube", label: "Cited YouTube", color: "#FF0000", icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> },
                    ].map(({ kind, label, color, icon }) => {
                      const top = sourcesAggregate[kind] || [];
                      const total = sourcesAggregate.totals[kind] || 0;
                      const sectionKey = `sources_${kind}`;
                      return (
                        <div key={kind}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              {icon}
                              <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>{label}</span>
                              <span style={{ fontSize: 11, color, background: `${color}11`, border: `1px solid ${color}33`, borderRadius: 4, padding: "2px 7px", fontWeight: 700 }}>{top.length} unique · {total} citations</span>
                            </div>
                            <button
                              onClick={() => handleSourcesCsv(kind)}
                              disabled={!top.length}
                              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: `1.5px solid ${top.length ? color : "#e2e8f0"}`, borderRadius: 8, padding: "7px 12px", fontSize: 12, color: top.length ? color : "#94a3b8", fontWeight: 600, cursor: top.length ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              Download CSV
                            </button>
                          </div>

                          {top.length === 0 ? (
                            <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", fontSize: 12, color: "#94a3b8" }}>
                              No third-party {label.replace("Cited ", "").toLowerCase()} citations found.
                            </div>
                          ) : (
                            <>
                              {/* Top global */}
                              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                                {top.slice(0, 5).map((entry, i) => (
                                  <SourceRow key={i} entry={entry} kind={kind} accent={color} />
                                ))}
                              </div>

                              {/* Per-category breakdown */}
                              <button
                                onClick={() => toggleCategory(sectionKey)}
                                style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", color: "#475569", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left" }}
                              >
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: expandedCategories[sectionKey] ? "rotate(0)" : "rotate(-90deg)", transition: "transform 0.2s" }}><path d="M2 3.5l3 3 3-3" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                Per-category breakdown
                              </button>
                              {expandedCategories[sectionKey] && (
                                <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
                                  {Object.keys(sourcesAggregate.byCategory).map((cat) => {
                                    const list = sourcesAggregate.byCategory[cat][kind] || [];
                                    if (!list.length) return null;
                                    return (
                                      <div key={cat} style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "10px 12px" }}>
                                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8 }}>{cat}</div>
                                        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                                          {list.slice(0, 8).map((entry, j) => (
                                            <SourceRow key={j} entry={entry} kind={kind} accent={color} compact />
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    {sourcesAggregate.totals.branded > 0 && (
                      <div style={{ fontSize: 11, color: "#94a3b8", textAlign: "right" }}>
                        {sourcesAggregate.totals.branded} branded source{sourcesAggregate.totals.branded === 1 ? "" : "s"} excluded.
                      </div>
                    )}
                  </div>
                )}
              </SectionCard>
            </div>
          )}

          {/* Off-Site Insights — demo only (hidden in production pipeline runs) */}
          {analysis?.llmBreakdown && (() => {
            const weakCategories = analysis.categoryBreakdown?.filter(cb => {
              const idx = cb.rankings?.findIndex(r => r.brand.toLowerCase() === brand.trim().toLowerCase());
              return idx > 0;
            }) || [];
            // Off-site insight mapping per category — Reddit, YouTube, Cited URLs
            const offsiteInsights = {
              "Athletic Footwear": {
                reddit: { theme: "Shoe Advice & Retailer Preference", sentiment: "74% favor specialty/brand sites over Academy", detail: "Reddit's r/running and r/Sneakers threads overwhelmingly recommend Fleet Feet, Running Warehouse, Nike.com, and Foot Locker over Academy for performance footwear. Academy is rarely mentioned except as a budget fallback.", topItems: ["Best running shoe stores for beginners?", "Why does Academy have poor shoe selection?", "Fleet Feet vs Dick's vs Academy for running shoes"] },
                youtube: { theme: "Footwear Review & Retailer Coverage", sentiment: "18% favorable for Academy footwear", detail: "YouTube shoe content almost never positions Academy as a footwear destination. Brand sites and Foot Locker dominate with dedicated review series. Academy appears only in generic \"cheap shoe haul\" videos, reinforcing a low-authority perception.", topItems: ["Best Budget Running Shoes 2024", "Nike vs Adidas Running Shoes", "Top 5 Basketball Shoes Under $100"] },
                citedUrls: { theme: "Running Shoe Buying Guides", sentiment: "15 URLs, 1,240 citations — 0 mention Academy", detail: "Top-cited running articles on runnersworld.com, runningwarehouse.com, and verywellfit.com don't mention Academy at all. These 15 sources account for over 1,240 LLM citations, entirely directing users to Nike.com, Dick's, and Foot Locker.", topItems: ["runnersworld.com — Nike & Brooks only", "runningwarehouse.com — no Academy", "verywellfit.com — 15 citations gap"] },
              },
              "Outdoor & Camping": {
                reddit: { theme: "Academy vs REI Gear Quality", sentiment: "68% unfavorable toward Academy gear", detail: "Reddit's r/camping and r/ultralight communities are strongly skeptical of Academy's Magellan Outdoors brand. Posts like \"Is Academy camping gear worth it?\" consistently steer users to REI, Bass Pro, or MSR for anything serious. Academy is perceived as a clearance store for casual campers.", topItems: ["Is Academy camping gear worth it?", "Magellan Outdoors vs REI — honest review", "Best budget camping gear — REI vs Bass Pro vs Academy"] },
                youtube: { theme: "Budget vs Premium Camping Gear", sentiment: "22% favorable for Academy outdoor gear", detail: "YouTube outdoor content from creators like Big Backyard and Outdoor Boys rarely features Academy. REI and Bass Pro Shops command 4x more outdoor gear review coverage. When Academy's Magellan appears, it's in \"worst camping gear\" comparisons.", topItems: ["$50 vs $500 Camping Gear Test", "Is Magellan Outdoors Any Good?", "REI vs Bass Pro Shops — Full Comparison"] },
                citedUrls: { theme: "Outdoor Gear Buying Guides", sentiment: "22 URLs, 3,840 citations favoring REI & Bass Pro", detail: "Authoritative guides on outdoorgearlab.com, cleverhiker.com, and backpacker.com account for 3,840+ LLM training citations and don't include Academy in any top-pick lists. REI and Bass Pro Shops capture virtually all outdoor gear LLM share.", topItems: ["outdoorgearlab.com — REI top pick, no Academy", "cleverhiker.com — Bass Pro recommended", "22 URLs, 3,840 citation gap"] },
              },
              "Fitness Equipment": {
                reddit: { theme: "Home Gym Buying Advice", sentiment: "61% recommend Amazon or Dick's over Academy", detail: "Fitness subreddits like r/homegym and r/fitness consistently point users to Amazon, Dick's, and Rogue for equipment. Academy is occasionally mentioned for entry-level dumbbells but is seen as unreliable for stock availability and brand selection.", topItems: ["Best places to buy home gym equipment?", "Dick's vs Amazon for dumbbells — which is better?", "Why can't I find good barbells at Academy?"] },
                youtube: { theme: "Home Gym Setup & Equipment Reviews", sentiment: "14% favorable for Academy fitness gear", detail: "Popular home gym YouTube channels (Garage Gym Reviews, Buff Dudes) rarely recommend Academy for equipment. Amazon and Dick's Sporting Goods are the default retailer recommendations, appearing in 80%+ of home gym setup videos.", topItems: ["Best Budget Home Gym Setup 2024", "Bowflex vs PowerBlock — Where to Buy", "Peloton vs NordicTrack — Top Retailers"] },
                citedUrls: { theme: "Fitness Equipment Buying Guides", sentiment: "19 URLs, 2,610 citations — Amazon & Dick's dominant", detail: "Top fitness guides on shape.com, menshealth.com, and verywellfit.com consistently link to Amazon and Dick's for equipment purchases. Academy appears in fewer than 3% of outbound purchase links from these high-authority fitness sites.", topItems: ["menshealth.com — Amazon & Dick's links only", "shape.com — no Academy equipment coverage", "19 URLs, 2,610 citation gap vs Amazon"] },
              },
              "Team & Youth Sports": {
                reddit: { theme: "Youth Sports Gear Recommendations", sentiment: "58% prefer Dick's Sporting Goods over Academy", detail: "Parents in r/baseball, r/soccer, and r/youth_sports threads consistently mention Dick's Sporting Goods as the default for youth gear. Academy is mentioned in southern US threads only. The lack of national brand presence hurts LLM recall significantly.", topItems: ["Best place to buy youth baseball gloves?", "Dick's vs Academy for youth football pads", "Where to buy youth soccer cleats on a budget?"] },
                youtube: { theme: "Youth Sports Equipment Reviews", sentiment: "31% favorable for Academy youth sports", detail: "YouTube youth sports content is dominated by Eastbay, Dick's, and brand-specific channels (Rawlings, Nike). Academy has minimal YouTube presence in team sports, meaning LLMs trained on this content default to Dick's for youth sport queries.", topItems: ["Best Youth Baseball Bats 2024", "Youth Football Helmet Safety Rankings", "Top 5 Soccer Cleats for Kids"] },
                citedUrls: { theme: "Youth Sports Buying Guides", sentiment: "16 URLs, 1,980 citations — Dick's leads at 3x", detail: "Sports parenting sites like sportsengine.com and active.com link almost exclusively to Dick's Sporting Goods for youth equipment. Academy's regional footprint means it's excluded from nationally-focused buying guides that heavily influence LLM recommendations.", topItems: ["sportsengine.com — Dick's top pick", "active.com — no Academy listed", "16 URLs, 1,980 citation gap"] },
              },
              "Sporting Goods Retail": {
                reddit: { theme: "Best Sporting Goods Store Debate", sentiment: "52% prefer Dick's or Amazon over Academy", detail: "General retail comparison threads on r/frugal and r/deals consistently rank Dick's Sporting Goods and Amazon ahead of Academy. Users outside the South/Southeast often report not having an Academy nearby, limiting national LLM brand recognition.", topItems: ["Dick's vs Academy — which is worth it?", "Why doesn't Academy expand to more states?", "Best sporting goods store for price and selection?"] },
                youtube: { theme: "Sporting Goods Store Reviews & Hauls", sentiment: "35% favorable for Academy overall value", detail: "YouTube store comparison and haul videos heavily favor Dick's Sporting Goods in production count and view totals. Academy's YouTube presence is largely user-generated with low view counts, giving Dick's a 5:1 content advantage in this category.", topItems: ["Dick's Sporting Goods Haul 2024", "Is Academy Worth It? Honest Review", "Best Sporting Goods Store — Full Comparison"] },
                citedUrls: { theme: "Sporting Goods Retailer Comparisons", sentiment: "11 URLs, 1,420 citations — Dick's mentioned 4x more", detail: "Retailer comparison articles on consumerreports.org, nerdwallet.com, and thewirecutter.com mention Dick's Sporting Goods 4x more than Academy. Academy's limited geographic footprint means national publications rarely include it in \"best sporting goods stores\" roundups.", topItems: ["consumerreports.org — Dick's top-rated", "wirecutter.com — no Academy in top picks", "11 URLs, 1,420 citation gap vs Dick's"] },
              },
            };
            return (
            <div style={{ marginTop: 20 }}>
              <SectionCard accentColor="#dc2626" icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} title="Off-Site Insights — Competitive Gaps" isOpen={isSectionOpen("offsite")} onToggle={() => toggleSection("offsite")}>
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: 13, color: "#854d0e", lineHeight: 1.6 }}>
                  <strong>{brand}</strong> ranks behind competitors in {weakCategories.length} categories. Off-site sentiment analysis from Reddit, YouTube, and cited URLs reveals correlated themes that explain these gaps.
                  <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 3 }}>
                    <div style={{ fontSize: 12, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 13.38c.15.36.24.76.24 1.18 0 2.42-2.82 4.38-6.3 4.38s-6.3-1.96-6.3-4.38c0-.42.09-.82.25-1.18a1.5 1.5 0 0 1-.6-1.2c0-.82.67-1.5 1.5-1.5.4 0 .77.16 1.04.42 1.02-.74 2.43-1.22 4-1.28l.76-3.54a.32.32 0 0 1 .38-.24l2.5.53a1.07 1.07 0 1 1-.12.56l-2.23-.47-.68 3.16c1.53.08 2.9.56 3.9 1.28.26-.25.63-.4 1.02-.4.83 0 1.5.67 1.5 1.5 0 .48-.23.9-.58 1.18z"/></svg> Reddit: 83 threads, 2,640 comments, 63% unfavorable</div>
                    <div style={{ fontSize: 12, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg> YouTube: 47 videos, 5.8M views, 24% favorable</div>
                    <div style={{ fontSize: 12, color: "#a16207", display: "flex", alignItems: "center", gap: 6 }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Cited URLs: 83 URLs, 11,090 citations — Academy mentioned in 6%</div>
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
                          <a href="https://llmo.now/academy.com/opportunities/earned-content/a1b2c3d4-e5f6-7890-abcd-ef1234567890" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#1e293b", fontWeight: 600, textDecoration: "none" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF4500"><path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 13.38c.15.36.24.76.24 1.18 0 2.42-2.82 4.38-6.3 4.38s-6.3-1.96-6.3-4.38c0-.42.09-.82.25-1.18a1.5 1.5 0 0 1-.6-1.2c0-.82.67-1.5 1.5-1.5.4 0 .77.16 1.04.42 1.02-.74 2.43-1.22 4-1.28l.76-3.54a.32.32 0 0 1 .38-.24l2.5.53a1.07 1.07 0 1 1-.12.56l-2.23-.47-.68 3.16c1.53.08 2.9.56 3.9 1.28.26-.25.63-.4 1.02-.4.83 0 1.5.67 1.5 1.5 0 .48-.23.9-.58 1.18z"/></svg>
                            Reddit Sentiment
                          </a>
                          <a href="https://llmo.now/academy.com/opportunities/earned-content/b2c3d4e5-f6a7-8901-bcde-f12345678901" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#1e293b", fontWeight: 600, textDecoration: "none" }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            YouTube Sentiment
                          </a>
                          <a href="https://llmo.now/academy.com/opportunities/earned-content/c3d4e5f6-a7b8-9012-cdef-123456789012" target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 14px", fontSize: 12, color: "#1e293b", fontWeight: 600, textDecoration: "none" }}>
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
