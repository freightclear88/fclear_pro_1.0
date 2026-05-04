import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  Bot,
  Send,
  User,
  BookOpen,
  Calculator,
  FileText,
  AlertTriangle,
  Globe,
  HelpCircle,
  Car,
  Sparkles,
  Apple,
  Stethoscope,
  Pen,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}


// Quick prompt buttons (no UFLPA)
const QUICK_PROMPTS = [
  { label: "Calculate import duties", prompt: "How do I calculate import duties for my shipment?", icon: Calculator },
  { label: "China tariff rates", prompt: "What are the current tariff rates for goods from China?", icon: Globe },
  { label: "ISF 10+2 requirements", prompt: "What are the ISF 10+2 filing requirements and deadlines?", icon: FileText },
  { label: "De minimis rule", prompt: "Explain the de minimis rule and the $800 threshold for imports.", icon: HelpCircle },
  { label: "Read my HTS code", prompt: "How do I read and understand my HTS classification code?", icon: BookOpen },
  { label: "Import cars & vehicles", prompt: "What are the requirements for importing cars and vehicles into the USA? Include DOT and NHTSA compliance, HS security bond requirements, and current duty rates.", icon: Car },
  { label: "FDA — Food & Perishables", prompt: "What are the FDA compliance requirements for importing food and perishable goods into the USA? Include Prior Notice, FSVP, detention/refusal procedures, and labeling requirements.", icon: Apple },
  { label: "FDA — Medical Devices", prompt: "What are the FDA compliance requirements for importing medical devices into the USA? Include device classification, 510(k) clearance, PMA, registration requirements, and CBP entry procedures.", icon: Stethoscope },
  { label: "Power of Attorney", prompt: "What is a Customs Power of Attorney and why does every importer need one? What information is required, and how do I complete and submit it to FreightClear to get started?", icon: Pen },
];

const KB_LINKS = [
  {
    label: "⚡ Power of Attorney (Start Here)",
    prompt: "What is a Customs Power of Attorney and why does every importer need one? What information is required, and how do I complete and submit it to FreightClear to get started?",
    icon: Pen,
  },
  {
    label: "Duty Rate Tables",
    prompt: "What are the current US import duty rates? Give me an overview of how duty rates are structured and where to look them up.",
    icon: Calculator,
  },
  {
    label: "HTS Code Lookup Guide",
    prompt: "How do I look up and read an HTS classification code? Walk me through the structure of an HTS code and how to find the right one for my product.",
    icon: BookOpen,
  },
  {
    label: "ISF Filing Checklist",
    prompt: "Give me a complete ISF 10+2 filing checklist — what information do I need, what are the deadlines, and what are the penalties for non-compliance?",
    icon: FileText,
  },
  {
    label: "Section 301 Tariff Updates",
    prompt: "What are the latest Section 301 tariff updates for goods from China? What products are affected and what are the current rates?",
    icon: AlertTriangle,
  },
  {
    label: "Import Cars & Vehicles",
    prompt: "What are the requirements for importing cars and vehicles into the USA? Include DOT, NHTSA compliance, bond requirements, and current duty rates.",
    icon: Globe,
  },
];

export default function AiSupport() {
  const { user } = useAuth();
  const poaComplete = (user as any)?.powerOfAttorneyStatus === "validated" || (user as any)?.powerOfAttorneyStatus === "uploaded";

  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi! I'm the FreightClear AI Support assistant. I can help you with import duties, tariff rates, HTS classifications, ISF filings, and customs compliance. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build conversation history for multi-turn context (last 10 messages)
      const historyForApi = messages
        .filter((m) => m.id !== "welcome")
        .slice(-10)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/ai-support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: text.trim(), history: historyForApi }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.reply || errData?.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || data.message || "I received your question. Our AI support team is processing your request.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch (err: any) {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: err?.message && !err.message.startsWith("HTTP")
          ? err.message
          : "I'm having trouble connecting right now. Please try again in a moment, or contact our team at freightclear.com.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, fallbackMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-freight-blue to-freight-green rounded-lg">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 flex items-center gap-2">
              AI Support
              <Badge className="bg-gradient-to-r from-freight-blue to-freight-green text-white border-0 text-xs">
                <Sparkles className="w-3 h-3 mr-1" />
                Powered by AI
              </Badge>
            </h1>
            <p className="text-gray-600 text-sm lg:text-base">
              Get instant answers on duties, tariffs, calculations, and compliance
            </p>
          </div>
        </div>
      </div>



      {/* Power of Attorney Banner — shown until POA is on file */}
      {!poaComplete && (
        <div className="mb-6 rounded-xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center">
            <Pen className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900 text-sm">⚡ Step 1: Complete your Power of Attorney to get started
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              A signed POA is required before FreightClear can file customs entries, ISF filings, or any documents on your behalf. It only takes 2 minutes.
            </p>
          </div>
          <Link href="/profile">
            <Button className="flex-shrink-0 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold px-4 py-2">
              Complete POA →
            </Button>
          </Link>
        </div>
      )}

      {/* Quick Prompt Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-6">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            onClick={() => sendMessage(qp.prompt)}
            disabled={isLoading}
            className="flex flex-col items-center gap-1 p-3 bg-white border border-gray-200 rounded-lg hover:border-freight-blue hover:bg-blue-50 transition-all text-center group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <qp.icon className="w-5 h-5 text-freight-blue group-hover:scale-110 transition-transform" />
            <span className="text-xs text-gray-600 font-medium leading-tight">{qp.label}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-3">
          <Card className="flex flex-col h-[560px]">
            <CardHeader className="pb-3 border-b flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-base">
                <Bot className="w-4 h-4 text-freight-blue" />
                FreightClear AI Assistant
                <span className="ml-auto flex items-center gap-1 text-xs text-green-600 font-normal">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block animate-pulse" />
                  Online
                </span>
              </CardTitle>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      msg.role === "user"
                        ? "bg-freight-blue text-white"
                        : "bg-gradient-to-br from-freight-blue to-freight-green text-white"
                    }`}
                  >
                    {msg.role === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-freight-blue text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-800 rounded-tl-sm"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <span>{msg.content}</span>
                    ) : (
                      <div className="prose prose-sm max-w-none prose-headings:text-freight-dark prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5 prose-table:text-xs prose-th:bg-freight-blue prose-th:text-white prose-th:px-2 prose-th:py-1 prose-td:px-2 prose-td:py-1 prose-td:border prose-td:border-gray-200 prose-strong:text-freight-dark prose-hr:my-2">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </div>
                    )}
                    <div
                      className={`text-[10px] mt-1 ${
                        msg.role === "user" ? "text-blue-200 text-right" : "text-gray-400"
                      }`}
                    >
                      {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-freight-blue to-freight-green text-white flex items-center justify-center">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                    <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input */}
            <div className="border-t p-4 flex-shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about duties, tariffs, ISF filings, HTS codes..."
                  className="flex-1 text-sm"
                  disabled={isLoading}
                />
                <Button
                  type="submit"
                  disabled={!input.trim() || isLoading}
                  className="bg-freight-blue hover:bg-freight-blue/90 text-white px-4"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </form>
              <p className="text-[11px] text-gray-400 mt-2 text-center">
                AI responses are informational. Consult a licensed customs broker for binding advice.
              </p>
            </div>
          </Card>
        </div>

        {/* Knowledge Base Links */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-freight-blue" />
                Knowledge Base
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-gray-500 mb-3">Click a topic to get an instant answer</p>
              {KB_LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => sendMessage(link.prompt)}
                  className="w-full flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-100 hover:border-blue-300 transition-all group text-sm font-medium text-freight-blue text-left cursor-pointer"
                >
                  <link.icon className="w-4 h-4 text-freight-blue flex-shrink-0" />
                  <span className="flex-1">{link.label}</span>
                  <Send className="w-3 h-3 text-freight-blue opacity-50 group-hover:opacity-100 flex-shrink-0" />
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-4 text-center space-y-3">
              <div className="mx-auto w-10 h-10 bg-gradient-to-br from-freight-blue to-freight-green rounded-full flex items-center justify-center">
                <Globe className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Need Expert Help?</h3>
                <p className="text-xs text-gray-600 mt-1">
                  Our licensed customs brokers are ready to assist with complex shipments.
                </p>
              </div>
              <a href="https://freightclear.com" target="_blank" rel="noopener noreferrer">
                <Button size="sm" className="w-full bg-freight-blue hover:bg-freight-blue/90 text-white text-xs">
                  Contact FreightClear
                </Button>
              </a>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
