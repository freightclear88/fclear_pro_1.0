/**
 * FreightClear AI Support Service
 *
 * Hybrid AI assistant combining:
 * 1. Local knowledge base (FreightClear-specific content, DB-backed)
 * 2. Live web search (HTS codes, duty rates, CBP updates, tariff changes)
 *
 * Uses OpenAI gpt-4o-mini with function calling so the AI decides when
 * to search vs. answer directly. Web search via Brave or Tavily API.
 */

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db, pool } from "./db";
import { knowledgeBase } from "@shared/schema";
import { eq } from "drizzle-orm";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── Ensure DB Table ──────────────────────────────────────────────────────────

export async function ensureKnowledgeBaseTable(): Promise<void> {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS knowledge_base (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        category VARCHAR(64) NOT NULL DEFAULT 'general',
        content TEXT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    console.log("[kb] knowledge_base table ready");
  } catch (err) {
    console.error("[kb] Failed to ensure knowledge_base table:", err);
  }
}

// ─── Static KB (fallback + seed source) ──────────────────────────────────────

export const LOCAL_KNOWLEDGE: { category: string; title: string; content: string }[] = [
  {
    category: "isf",
    title: "ISF 10+2 Filing Requirements",
    content: `The Importer Security Filing (ISF), also known as "10+2", requires importers to electronically submit cargo information to U.S. Customs and Border Protection (CBP) at least 24 hours before cargo is loaded onto a vessel destined for the United States.

The 10 data elements required from the importer:
1. Seller (name and address)
2. Buyer (name and address)
3. Importer of record number / FTZ applicant ID
4. Consignee number(s)
5. Manufacturer (or supplier) name and address
6. Ship-to party name and address
7. Country of origin
8. Commodity HTSUS number (to 6-digit level)
9. Container stuffing location (name and address)
10. Consolidator (name and address)

The 2 data elements required from the carrier:
1. Vessel stow plan
2. Container status messages

Penalties: Up to $5,000 per violation. Late, inaccurate, or missing ISF filings can also trigger additional CBP exams, which cause costly delays.

FreightClear handles ISF 10+2 filing as part of our standard customs clearance service.`,
  },
  {
    category: "tariffs",
    title: "Section 301 China Tariffs Overview",
    content: `Section 301 tariffs are additional duties imposed on goods imported from China under the Trade Act of 1974. These tariffs are administered by the Office of the United States Trade Representative (USTR).

There are four "lists" (tranches) of products:
- List 1: 25% additional duty (since July 6, 2018)
- List 2: 25% additional duty (since August 23, 2018)
- List 3: Originally 10%, raised to 25% (since May 10, 2019)
- List 4A: Originally 7.5% (since September 1, 2019)

These rates are ON TOP of the standard MFN (Most Favored Nation) duty rates in the HTS. For example, if a product has a 5% MFN rate and is on List 1, the total duty is 30%.

Important: Section 301 tariff rates have continued to escalate in 2025-2026. Importers must check the current USTR Federal Register notices for the most up-to-date rates and any product exclusions.

FreightClear can help review your HTS classifications to confirm which Section 301 list (if any) applies to your goods.`,
  },
  {
    category: "compliance",
    title: "UFLPA - Uyghur Forced Labor Prevention Act",
    content: `The Uyghur Forced Labor Prevention Act (UFLPA) was signed into law on December 23, 2021, and enforcement began June 21, 2022. It establishes a rebuttable presumption that goods mined, produced, or manufactured wholly or in part in the Xinjiang Uyghur Autonomous Region (XUAR) of China, or by certain entities on the UFLPA Entity List, are made with forced labor and are prohibited from importation under 19 U.S.C. § 1307.

To rebut the presumption, importers must provide:
1. Clear and convincing evidence that the goods were not made with forced labor
2. Full supply chain traceability documentation from raw materials to finished goods
3. Evidence of due diligence on forced labor compliance

High-risk product categories include: cotton, polysilicon (solar panels), tomatoes, and goods involving raw materials commonly sourced from Xinjiang.

CBP has significantly increased UFLPA detentions and seizures. Importers with China supply chains should conduct supply chain audits and maintain detailed traceability records.`,
  },
  {
    category: "compliance",
    title: "De Minimis Rule - $800 Threshold",
    content: `The de minimis threshold under Section 321 of the Tariff Act allows goods valued at $800 or less per person per day to enter the United States free of duties and taxes, with minimal formal entry requirements.

Key points:
- The $800 threshold applies to the fair retail value of the goods
- One shipment per person per day
- Does NOT apply to goods subject to antidumping/countervailing duties or to goods on Section 301 lists (China tariffs) — these require formal entry regardless of value
- Commonly used by e-commerce platforms and direct-to-consumer shipments

Important 2025-2026 update: The de minimis exemption for goods of Chinese origin (including from Hong Kong) has been eliminated or significantly restricted as part of recent trade policy changes. Check current CBP guidance for the latest status.

FreightClear can advise on whether your shipments qualify for de minimis or require formal entry.`,
  },
  {
    category: "hts",
    title: "Reading an HTS Code",
    content: `The Harmonized Tariff Schedule of the United States (HTSUS) uses a 10-digit classification number to identify every type of imported good.

Structure of an HTS code (example: 8471.30.0100):
- Digits 1-2 (84): Chapter — broad product category (e.g., "Nuclear reactors, boilers, machinery")
- Digits 3-4 (71): Heading — more specific group within the chapter
- Digits 5-6 (.30): Subheading — the 6-digit international "HS" level used globally
- Digits 7-8 (.01): U.S. Statistical suffix — further U.S. breakdown
- Digits 9-10 (00): Additional U.S. breakdown

The duty rate is listed in the "General" column of the HTSUS. Other columns include "Special" (preferential rates under trade agreements) and "2" (Column 2 countries like Cuba, North Korea).

To look up an HTS code: www.usitc.gov (official) or hts.usitc.gov (searchable schedule).

Correct HTS classification is critical — errors can result in underpayment (CBP penalties) or overpayment (missed duty savings) of duties.`,
  },
  {
    category: "vehicles",
    title: "Importing Cars and Vehicles to the USA — DOT & NHTSA Requirements",
    content: `Importing a car or vehicle into the United States involves customs (CBP), safety (NHTSA), and emissions (EPA) compliance. Here is a full overview:

CUSTOMS DUTY RATES (CBP)
- Passenger vehicles: 2.5% of customs value
- Trucks and SUVs (classified as trucks): 25% of customs value ("chicken tax")
- Motorcycles: 0%
- Electric vehicles: 2.5% (may be subject to Section 301 if from China)
- Duty is based on the transaction value (purchase price)

NHTSA (National Highway Traffic Safety Administration)
All imported vehicles must comply with Federal Motor Vehicle Safety Standards (FMVSS). Options:
1. Vehicles manufactured to U.S. standards (e.g., Canadian-market vehicles) → relatively simple entry
2. Vehicles NOT manufactured to U.S. standards (most foreign-market cars) → must be brought into conformance by a Registered Importer (RI) OR qualify for an exemption

Key NHTSA rules:
- Vehicle must be 25 years or older to qualify for the "show or display" or classic car exemption (bypasses FMVSS conformance)
- HS-7 Declaration Form required at entry — declares the basis for importation
- Registered Importers (RIs) are NHTSA-approved companies that perform conformance modifications

EPA (Environmental Protection Agency)
- Vehicle must meet U.S. emissions standards or be modified by an Independent Commercial Importer (ICI)
- EPA Form 3520-1 required at entry
- Vehicles 21 years or older are generally exempt from EPA emissions requirements

CBP ENTRY PROCESS
- Title/MSO required
- Bill of Lading
- Commercial Invoice or purchase agreement
- HS-7 form (NHTSA declaration)
- EPA 3520-1 form
- If vehicle is dutiable, a CBP Form 7501 entry summary is filed
- Security bond may be required for non-conforming vehicles held for modification

SPECIAL SITUATIONS
- Vehicles from Canada: Generally easy if Canadian spec (close to U.S. spec)
- Vehicles from Europe/Japan/etc.: Require RI conformance unless 25+ years old
- Grey market vehicles: Require full RI/ICI process
- Electric vehicles from China: Subject to 27.5% total duty (2.5% + 25% Section 301)

FreightClear can assist with customs clearance and entry filing for vehicle imports. NHTSA/EPA conformance work must be done by a licensed RI/ICI.`,
  },
  {
    category: "fda",
    title: "FDA Compliance — Importing Food & Perishables to the USA",
    content: `Importing food and perishable goods into the United States requires compliance with FDA regulations under the Food Safety Modernization Act (FSMA) and the Federal Food, Drug, and Cosmetic Act (FD&C Act).

PRIOR NOTICE (Required for ALL food imports)
- Importers must submit Prior Notice to FDA before food arrives at a U.S. port
- Submission window: No earlier than 15 days before arrival; no later than:
  - 2 hours before arrival (air)
  - 4 hours before arrival (land)
  - 8 hours before arrival (ocean)
- Submit via FDA's Prior Notice System Interface (PNSI) or through ABI/ACE
- Failure to submit = cargo may be held or refused

FOREIGN SUPPLIER VERIFICATION PROGRAM (FSVP)
- Importers must verify that foreign food suppliers meet U.S. food safety standards
- Required under FSMA for most imported food products
- Importer must conduct hazard analysis, verify supplier performance, conduct periodic audits
- FSVP records must be maintained and available to FDA on request

FDA REGISTRATION
- Foreign food facilities that manufacture, process, pack, or hold food for U.S. consumption must be registered with FDA
- Registration must be renewed every 2 years (odd-numbered years)
- Unregistered facilities = food may be refused entry

LABELING REQUIREMENTS
- Must comply with FDA labeling rules: ingredient list, net quantity, nutrition facts, allergen declaration
- Labels must be in English
- Country of origin required

REFUSAL & DETENTION
- FDA can issue an Import Alert for products with history of violations
- Products on Import Alert are automatically detained — importer must prove compliance to release
- FDA may refuse admission — refused goods must be re-exported or destroyed

HIGH-RISK CATEGORIES
- Fresh produce, seafood, dairy, juice — subject to specific HACCP/preventive control rules
- Products from countries with food safety concerns may face automatic detention

CBP ENTRY
- Standard CBP formal or informal entry required
- FDA reviews entry through ACE/ITDS system
- May require FDA examination (physical or records review)

FreightClear coordinates FDA Prior Notice filing and entry as part of our customs clearance service.`,
  },
  {
    category: "fda",
    title: "FDA Compliance — Importing Medical Devices to the USA",
    content: `Importing medical devices into the United States requires compliance with FDA regulations under the Federal Food, Drug, and Cosmetic Act (FD&C Act) and 21 CFR Parts 800-898.

DEVICE CLASSIFICATION
FDA classifies medical devices into three classes based on risk:
- Class I: Low risk (e.g., bandages, tongue depressors) — General controls only, most exempt from 510(k)
- Class II: Moderate risk (e.g., X-ray equipment, powered wheelchairs) — Requires 510(k) Premarket Notification
- Class III: High risk (e.g., implantable pacemakers, heart valves) — Requires Premarket Approval (PMA)

FDA REGISTRATION & LISTING
- Foreign manufacturers of devices distributed in the U.S. must register with FDA annually
- Device establishments must list their devices with FDA
- Unregistered devices = may be detained/refused at port of entry

510(k) CLEARANCE
- Required for most Class II devices before they can be marketed in the U.S.
- Demonstrates device is substantially equivalent to a legally marketed predicate device
- Must obtain clearance BEFORE importing for commercial distribution

PREMARKET APPROVAL (PMA)
- Required for Class III devices
- Most stringent pathway — requires clinical data demonstrating safety and effectiveness

CBP ENTRY REQUIREMENTS
- Standard CBP entry (formal or informal depending on value)
- FDA reviews via ACE/ITDS — may flag for examination
- Importer may need to provide: FDA registration number, 510(k)/PMA number, device listing info
- Personal use importation (small quantities for personal use) — different rules apply

FDA IMPORT ALERTS
- Devices from manufacturers with compliance history may be subject to Import Alert
- Detained shipments require proof of compliance or refusal of entry

UDI (UNIQUE DEVICE IDENTIFICATION)
- Most medical devices must bear a UDI label
- Device must be listed in FDA's GUDID database

COMMON ISSUES
- Importing devices without 510(k) clearance (for Class II)
- Manufacturer not registered with FDA
- Missing or non-compliant labeling
- Device falls under a different regulatory pathway than importer expects

FreightClear can assist with CBP customs clearance for medical device imports. FDA regulatory pathway determination should be confirmed with an FDA regulatory consultant.`,
  },
  {
    category: "freightclear",
    title: "FreightClear Services",
    content: `FreightClear is a U.S. customs compliance service brand powered by World Class Shipping (WCS), a WCA-member freight forwarder with 38+ years of experience.

Our services include:

CUSTOMS CLEARANCE
- ISF 10+2 filing
- Formal entry filing (Type 01, 03, 06, 11, etc.)
- Drawback entries
- FDA, USDA, EPA, and other PGA coordination
- CBP exam coordination and de-stuffing arrangements

TRADE COMPLIANCE
- HTS classification review and binding ruling assistance
- Section 301 tariff impact analysis
- UFLPA supply chain due diligence
- First sale valuation strategies
- Protest filing for duty recovery

IMPORT CONSULTING
- Pre-shipment classification review
- Importer self-assessment (ISA) support
- C-TPAT compliance assistance
- Duty drawback program setup

COUNTRY NETWORK
FreightClear serves as the compliance layer across our global freight portal network:
- freightchina.com — China freight
- cargomexico.com — Mexico freight
- freightindia.com — India freight
- japanfreight.com — Japan freight
- korealogistics.com — Korea freight
- taiwanfreight.com — Taiwan freight

Contact: freightclear.com`,
  },
];

// ─── Web Search ───────────────────────────────────────────────────────────────

async function webSearch(query: string): Promise<string> {
  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
      const resp = await fetch(url, {
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip",
          "X-Subscription-Token": braveKey,
        },
      });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const results = data?.web?.results ?? [];
        if (results.length > 0) {
          return results
            .slice(0, 5)
            .map((r: any, i: number) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description ?? ""}`)
            .join("\n\n");
        }
      }
    } catch (err) {
      console.error("[aiSupport] Brave search error:", err);
    }
  }

  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: tavilyKey, query, search_depth: "basic", include_answer: true, max_results: 5 }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const answer = data?.answer ? `Summary: ${data.answer}\n\n` : "";
        const results = (data?.results ?? [])
          .slice(0, 5)
          .map((r: any, i: number) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 300) ?? ""}`)
          .join("\n\n");
        return `${answer}${results}`;
      }
    } catch (err) {
      console.error("[aiSupport] Tavily search error:", err);
    }
  }

  return "No web search API configured (set BRAVE_API_KEY or TAVILY_API_KEY).";
}

// ─── Local KB Search ──────────────────────────────────────────────────────────

async function searchLocalKB(query: string): Promise<string> {
  const q = query.toLowerCase();
  try {
    const dbEntries = await db.select().from(knowledgeBase).where(eq(knowledgeBase.isActive, true));
    const all = dbEntries.length > 0
      ? dbEntries.map((e) => ({ title: e.title, content: e.content }))
      : LOCAL_KNOWLEDGE;

    const matches = all.filter(
      (e) => e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().split(" ").some((w) => q.includes(w.replace(/[^a-z]/g, "")))
    );

    if (!matches.length) return "No matching entries found in the knowledge base.";
    return matches.slice(0, 3).map((m) => `## ${m.title}\n${m.content}`).join("\n\n---\n\n");
  } catch {
    const matches = LOCAL_KNOWLEDGE.filter(
      (e) => e.title.toLowerCase().includes(q) ||
        e.content.toLowerCase().split(" ").some((w) => q.includes(w.replace(/[^a-z]/g, "")))
    );
    if (!matches.length) return "No matching entries found in the knowledge base.";
    return matches.slice(0, 3).map((m) => `## ${m.title}\n${m.content}`).join("\n\n---\n\n");
  }
}

// ─── Tool Definitions ───────────────────────────────────────────────────────
// Dual format: Anthropic tool_use + OpenAI function calling (fallback)

const ANTHROPIC_TOOLS: Anthropic.Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for live, up-to-date information: current HTS codes, duty rates, CBP announcements, Federal Register tariff updates, Section 301 lists, UFLPA entity list updates. Use this for any question involving specific rates or recent regulatory changes.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Specific search query, e.g. 'HTS 8471.30 duty rate China Section 301 2025'" },
      },
      required: ["query"],
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Search FreightClear's internal knowledge base for company services, ISF requirements, UFLPA overview, de minimis rules, HTS code structure, vehicle import requirements.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Keywords to search, e.g. 'ISF filing deadline'" },
      },
      required: ["query"],
    },
  },
];

const OPENAI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for live, up-to-date information: current HTS codes, duty rates, CBP announcements, Federal Register tariff updates, Section 301 lists, UFLPA entity list updates. Use this for any question involving specific rates or recent regulatory changes.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Specific search query, e.g. 'HTS 8471.30 duty rate China Section 301 2025'" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description:
        "Search FreightClear's internal knowledge base for company services, ISF requirements, UFLPA overview, de minimis rules, HTS code structure, vehicle import requirements.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Keywords to search, e.g. 'ISF filing deadline'" },
        },
        required: ["query"],
      },
    },
  },
];

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the FreightClear AI Support Assistant — a knowledgeable U.S. customs compliance expert.

Your expertise: HTS classifications, duty rates, Section 301 tariffs, ISF 10+2 filing, UFLPA compliance, de minimis rules, CBP regulations, trade agreements, FreightClear services.

TOOL USE RULES:
- For ANY question about specific HTS codes, duty rates, or tariff percentages: use web_search FIRST. Rates change frequently.
- For CBP policy changes, USTR announcements, Federal Register updates: use web_search.
- For FreightClear services, ISF procedures, UFLPA overview, standard compliance concepts: use search_knowledge_base.
- You may use both tools. After getting results, synthesize a clear answer.

RESPONSE STYLE:
- Concise but thorough. Freight professionals are busy.
- Use bullet points for multi-step processes.
- When citing rates or codes, note the source and remind users to verify with CBP or a licensed broker.
- Never invent duty rates, HTS codes, or penalty amounts.

You represent FreightClear and World Class Shipping. Be professional and genuinely helpful.`;

// ─── Main Handler ─────────────────────────────────────────────────────────────

export interface AiSupportMessage {
  role: "user" | "assistant";
  content: string;
}

async function executeToolCall(name: string, query: string): Promise<string> {
  if (name === "web_search") return webSearch(query);
  if (name === "search_knowledge_base") return searchLocalKB(query);
  return `Unknown tool: ${name}`;
}

// Claude (primary)
async function handleWithClaude(userMessage: string, history: AiSupportMessage[]): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const anthropicTools: Anthropic.Tool[] = [
    {
      name: "web_search",
      description: "Search the web for live HTS codes, duty rates, CBP announcements, Federal Register tariff updates, Section 301 lists. Use for any question about specific rates or recent regulatory changes.",
      input_schema: { type: "object" as const, properties: { query: { type: "string" } }, required: ["query"] },
    },
    {
      name: "search_knowledge_base",
      description: "Search FreightClear's internal knowledge base for ISF requirements, customs procedures, UFLPA, de minimis rules, HTS structure, vehicle imports, and FreightClear services.",
      input_schema: { type: "object" as const, properties: { query: { type: "string" } }, required: ["query"] },
    },
  ];

  let current = [...messages];
  for (let round = 0; round < 5; round++) {
    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages: current,
    });

    if (response.stop_reason === "end_turn") {
      const text = response.content.find((b) => b.type === "text");
      return text ? (text as Anthropic.TextBlock).text : "I was unable to generate a response.";
    }

    if (response.stop_reason === "tool_use") {
      const toolBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];
      current.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolBlocks.map(async (t) => ({
          type: "tool_result" as const,
          tool_use_id: t.id,
          content: await executeToolCall(t.name, (t.input as { query: string }).query),
        }))
      );
      current.push({ role: "user", content: results });
      continue;
    }
    break;
  }
  return "I was unable to complete your request. Please try rephrasing your question.";
}

// OpenAI gpt-4o-mini (fallback if ANTHROPIC_API_KEY not set)
async function handleWithOpenAI(userMessage: string, history: AiSupportMessage[]): Promise<string> {
  const openaiTools: OpenAI.Chat.ChatCompletionTool[] = [
    { type: "function", function: { name: "web_search", description: "Search the web for live tariff/duty info.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
    { type: "function", function: { name: "search_knowledge_base", description: "Search FreightClear KB.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  ];
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];
  for (let round = 0; round < 5; round++) {
    const res = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, tools: openaiTools, tool_choice: "auto", max_tokens: 1024 });
    const choice = res.choices[0];
    if (choice.finish_reason === "stop") return choice.message.content ?? "I was unable to generate a response.";
    if (choice.finish_reason === "tool_calls" && choice.message.tool_calls?.length) {
      messages.push(choice.message);
      for (const tc of choice.message.tool_calls) {
        const args = JSON.parse(tc.function.arguments) as { query: string };
        messages.push({ role: "tool", tool_call_id: tc.id, content: await executeToolCall(tc.function.name, args.query) });
      }
      continue;
    }
    break;
  }
  return "I was unable to complete your request. Please try rephrasing your question.";
}

export async function handleAiSupportQuery(
  userMessage: string,
  history: AiSupportMessage[] = []
): Promise<string> {
  if (process.env.ANTHROPIC_API_KEY) {
    console.log("[ai-support] Using Claude claude-3-5-haiku-20241022");
    return handleWithClaude(userMessage, history);
  }
  console.log("[ai-support] ANTHROPIC_API_KEY not set — falling back to OpenAI gpt-4o-mini");
  return handleWithOpenAI(userMessage, history);
}
