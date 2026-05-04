import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  User,
  BookOpen,
  Calculator,
  FileText,
  AlertTriangle,
  Globe,
  Sparkles,
  ExternalLink,
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}


const KB_LINKS = [
  { label: "Duty Rate Tables", href: "https://freightclear.com", icon: Calculator },
  { label: "HTS Code Lookup Guide", href: "https://freightclear.com", icon: BookOpen },
  { label: "ISF Filing Checklist", href: "https://freightclear.com", icon: FileText },
  { label: "Section 301 Tariff Updates", href: "https://freightclear.com", icon: AlertTriangle },
  { label: "FreightClear Services", href: "https://freightclear.com", icon: Globe },
];

export default function AiSupport() {
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
        body: JSON.stringify({ message: text.trim(), history: historyForApi }),
      });

      if (!res.ok) throw new Error("API not available");

      const data = await res.json();
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.reply || data.message || "I received your question. Our AI support team is processing your request.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    } catch {
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content:
          "Our AI support is being configured. In the meantime, you can reach our compliance team directly at freightclear.com or browse the knowledge base links on the right for answers to common import and customs questions.",
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
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-freight-blue text-white rounded-tr-sm"
                        : "bg-gray-100 text-gray-800 rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
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
              {KB_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg hover:bg-blue-50 border border-transparent hover:border-blue-100 transition-all group text-sm text-gray-700"
                >
                  <link.icon className="w-4 h-4 text-freight-blue flex-shrink-0" />
                  <span className="flex-1">{link.label}</span>
                  <ExternalLink className="w-3 h-3 text-gray-400 group-hover:text-freight-blue flex-shrink-0" />
                </a>
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
