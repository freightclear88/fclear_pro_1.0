import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle2, Send, MessageSquare } from "lucide-react";

interface ContactFormProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORIES = [
  "Customs Clearance",
  "ISF Filing",
  "Shipment Tracking",
  "Power of Attorney",
  "Billing / Payments",
  "Import Duties & Tariffs",
  "Document Upload",
  "Account / Profile",
  "General Inquiry",
];

export default function ContactForm({ open, onClose }: ContactFormProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    company: "",
    phone: "",
    category: "",
    subject: "",
    message: "",
  });
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [ticketId, setTicketId] = useState<number | null>(null);

  const update = (field: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.error || "Submission failed");
      }

      setTicketId(data.ticketId || null);
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err.message || "Something went wrong. Please try again.");
      setStatus("error");
    }
  };

  const handleClose = () => {
    setForm({ name: "", email: "", company: "", phone: "", category: "", subject: "", message: "" });
    setStatus("idle");
    setErrorMsg("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-freight-dark">
            <MessageSquare className="w-5 h-5 text-freight-blue" />
            Contact FreightClear
          </DialogTitle>
        </DialogHeader>

        {status === "success" ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
            <h3 className="text-lg font-semibold text-gray-900">Message Received!</h3>
            {ticketId && (
              <div className="inline-flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-lg px-4 py-2">
                <span className="text-xs text-gray-500">Ticket #</span>
                <span className="text-base font-bold text-freight-blue">{ticketId}</span>
              </div>
            )}
            <p className="text-sm text-gray-600">
              Our compliance team will respond within <strong>2 business hours</strong><br />
              Mon–Fri, 9AM–7PM ET
            </p>
            {ticketId && (
              <p className="text-xs text-gray-400">Save your ticket number for reference when following up.</p>
            )}
            <Button onClick={handleClose} className="mt-2 bg-freight-blue hover:bg-freight-blue/90 text-white">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Full Name *</Label>
                <Input
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => update("name", e.target.value)}
                  required
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Email Address *</Label>
                <Input
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={(e) => update("email", e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs mb-1 block">Company</Label>
                <Input
                  placeholder="Acme Imports LLC"
                  value={form.company}
                  onChange={(e) => update("company", e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Phone</Label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={form.phone}
                  onChange={(e) => update("phone", e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Topic</Label>
              <Select value={form.category} onValueChange={(v) => update("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a topic" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs mb-1 block">Subject</Label>
              <Input
                placeholder="Brief description of your question"
                value={form.subject}
                onChange={(e) => update("subject", e.target.value)}
              />
            </div>

            <div>
              <Label className="text-xs mb-1 block">Message *</Label>
              <textarea
                className="w-full h-28 p-3 text-sm border rounded-md resize-y focus:outline-none focus:ring-2 focus:ring-freight-blue"
                placeholder="Please describe your question or request in detail..."
                value={form.message}
                onChange={(e) => update("message", e.target.value)}
                required
              />
            </div>

            {status === "error" && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleClose}
                disabled={status === "submitting"}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-freight-blue hover:bg-freight-blue/90 text-white"
                disabled={!form.name || !form.email || !form.message || status === "submitting"}
              >
                {status === "submitting" ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sending...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Send Message</>
                )}
              </Button>
            </div>

            <p className="text-[11px] text-gray-400 text-center">
              Our team responds within 2 business hours · Mon–Fri, 9AM–7PM ET
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
