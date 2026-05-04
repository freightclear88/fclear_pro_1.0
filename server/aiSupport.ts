/**
 * FreightClear AI Support Service
 * 
 * Hybrid AI assistant combining:
 * 1. Local knowledge base (FreightClear-specific content)
 * 2. Live web search (HTS codes, duty rates, CBP updates, tariff changes)
 * 
 * Uses Claude with tool_use so the AI decides when to search vs. answer directly.
 * Web search powered by Brave Search API (BRAVE_API_KEY env var)
 * or Tavily Search API (TAVILY_API_KEY env var) as fallback.
 */

import Anthropic from "@anthropic-ai/sdk";
import { db, pool } from "./db";
import { knowledgeBase } from "@shared/schema";
import { eq } from "drizzle-orm";

// Ensure the knowledge_base table exists (runs once at startup)
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
    console.log('[kb] knowledge_base table ready');
  } catch (err) {
    console.error('[kb] Failed to ensure knowledge_base table:', err);
  }
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ─── Local Knowledge Base ────────────────────────────────────────────────────
// Seed content for FreightClear-specific knowledge.
// Phase 2 will move this to pgvector in Postgres for full CRUD management.

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
  // Try Brave Search API first
  const braveKey = process.env.BRAVE_API_KEY;
  if (braveKey) {
    try {
      const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&freshness=pm`;
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
          const formatted = results
            .slice(0, 5)
            .map(
              (r: any, i: number) =>
                `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.description ?? ""}`
            )
            .join("\n\n");
          return `Web search results for "${query}":\n\n${formatted}`;
        }
      }
    } catch (err) {
      console.error("[aiSupport] Brave search error:", err);
    }
  }

  // Fallback: Tavily Search API
  const tavilyKey = process.env.TAVILY_API_KEY;
  if (tavilyKey) {
    try {
      const resp = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: tavilyKey,
          query,
          search_depth: "basic",
          include_answer: true,
          max_results: 5,
        }),
      });
      if (resp.ok) {
        const data = (await resp.json()) as any;
        const answer = data?.answer ? `Summary: ${data.answer}\n\n` : "";
        const results = (data?.results ?? [])
          .slice(0, 5)
          .map(
            (r: any, i: number) =>
              `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.content?.slice(0, 300) ?? ""}`
          )
          .join("\n\n");
        return `${answer}Web search results for "${query}":\n\n${results}`;
      }
    } catch (err) {
      console.error("[aiSupport] Tavily search error:", err);
    }
  }

  return `No web search API configured. To enable live HTS/tariff lookups, set BRAVE_API_KEY or TAVILY_API_KEY in your environment variables.`;
}

// ─── Local KB Search ─────────────────────────────────────────────────────────

async function searchLocalKB(query: string): Promise<string> {
  const q = query.toLowerCase();

  // Try DB first
  try {
    const dbEntries = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.isActive, true));

    const allEntries = dbEntries.length > 0
      ? dbEntries.map((e) => ({ title: e.title, content: e.content, category: e.category }))
      : LOCAL_KNOWLEDGE;

    const matches = allEntries.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().split(" ").some((word) => q.includes(word.replace(/[^a-z]/g, "")))
    );

    if (matches.length === 0) return "No matching entries found in local knowledge base.";

    return matches
      .slice(0, 3)
      .map((m) => `## ${m.title}\n${m.content}`)
      .join("\n\n---\n\n");
  } catch {
    // Fallback to static KB if DB unavailable
    const matches = LOCAL_KNOWLEDGE.filter(
      (entry) =>
        entry.title.toLowerCase().includes(q) ||
        entry.content.toLowerCase().split(" ").some((word) => q.includes(word.replace(/[^a-z]/g, "")))
    );
    if (matches.length === 0) return "No matching entries found in local knowledge base.";
    return matches
      .slice(0, 3)
      .map((m) => `## ${m.title}\n${m.content}`)
      .join("\n\n---\n\n");
  }
}

// ─── Tool Definitions ─────────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "web_search",
    description:
      "Search the web for live, up-to-date information. Use this for: current HTS codes and duty rates, recent CBP or USTR announcements, Federal Register tariff updates, Section 301 product lists, UFLPA entity list updates, current trade news, and any information that may have changed recently. Always prefer this over guessing at specific duty rates or HTS classifications.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "A specific, well-formed search query. Be precise — include product names, HTS codes, country of origin, and date context when relevant. Example: 'HTS code 8471.30 duty rate Section 301 2025'",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_knowledge_base",
    description:
      "Search FreightClear's internal knowledge base for information about our services, ISF filing requirements, customs clearance procedures, UFLPA compliance, de minimis rules, and HTS code structure. Use this for company-specific questions and standard regulatory explanations.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keywords to search the knowledge base. Example: 'ISF filing deadline'",
        },
      },
      required: ["query"],
    },
  },
];

// ─── System Prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the FreightClear AI Support Assistant — a knowledgeable, professional, and helpful customs compliance expert embedded in the FreightClear.com platform.

Your expertise covers:
- U.S. import customs clearance procedures
- HTS (Harmonized Tariff Schedule) classifications and duty rates
- Section 301 tariffs on Chinese goods
- ISF 10+2 filing requirements
- UFLPA (Uyghur Forced Labor Prevention Act) compliance
- De minimis rules and exemptions
- CBP (U.S. Customs and Border Protection) regulations
- Trade agreements (USMCA, GSP, etc.)
- FreightClear services and the World Class Shipping network

TOOL USE RULES:
- For ANY question involving specific HTS codes, duty rates, or tariff percentages: ALWAYS use web_search first. Rates change frequently and must be current.
- For questions about CBP policy changes, USTR announcements, or Federal Register updates: use web_search.
- For FreightClear services, ISF procedures, UFLPA overview, and standard compliance concepts: use search_knowledge_base.
- You may use both tools in one response if needed.
- After searching, synthesize the results into a clear, actionable answer.

RESPONSE STYLE:
- Be concise but thorough. Freight professionals are busy.
- Use bullet points or numbered lists for multi-step processes.
- When citing duty rates or HTS codes, always note the date/source and remind users to verify with CBP or a licensed broker.
- End complex answers with: "For binding classification or duty advice, consult a licensed customs broker."
- Never make up duty rates, HTS codes, or CBP penalty amounts — always search or acknowledge uncertainty.

You represent FreightClear and World Class Shipping. Be professional, accurate, and genuinely helpful.`;

// ─── Main Handler ─────────────────────────────────────────────────────────────

export interface AiSupportMessage {
  role: "user" | "assistant";
  content: string;
}

export async function handleAiSupportQuery(
  userMessage: string,
  history: AiSupportMessage[] = []
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  let currentMessages = [...messages];

  // Agentic loop: let Claude call tools until it has a final answer
  for (let round = 0; round < 5; round++) {
    const response = await anthropic.messages.create({
      model: "claude-3-5-haiku-20241022",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: currentMessages,
    });

    // If Claude is done, return its text response
    if (response.stop_reason === "end_turn") {
      const textBlock = response.content.find((b) => b.type === "text");
      return textBlock ? (textBlock as Anthropic.TextBlock).text : "I was unable to generate a response. Please try again.";
    }

    // Process tool calls
    if (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];

      // Add Claude's response (with tool calls) to message history
      currentMessages.push({ role: "assistant", content: response.content });

      // Execute all tool calls in parallel
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          let result: string;
          try {
            const input = toolUse.input as { query: string };
            if (toolUse.name === "web_search") {
              result = await webSearch(input.query);
            } else if (toolUse.name === "search_knowledge_base") {
              result = await searchLocalKB(input.query);
            } else {
              result = `Unknown tool: ${toolUse.name}`;
            }
          } catch (err) {
            result = `Tool error: ${String(err)}`;
          }

          return {
            type: "tool_result" as const,
            tool_use_id: toolUse.id,
            content: result,
          };
        })
      );

      // Feed tool results back to Claude
      currentMessages.push({ role: "user", content: toolResults });
      continue;
    }

    // Unexpected stop reason
    break;
  }

  return "I was unable to complete your request. Please try rephrasing your question.";
}
