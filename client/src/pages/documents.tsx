import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import DocumentUpload from "@/components/DocumentUpload";
import DocumentList from "@/components/DocumentList";
import {
  FolderOpen,
  Ship,
  Plane,
  Truck,
  Package,
  FileText,
  Upload,
  Search,
  Tag,
  Calendar,
  File,
  Plus,
  Download,
  Eye,
} from "lucide-react";
import type { Shipment, Document } from "@shared/schema";
import { format } from "date-fns";

const STANDALONE_CATEGORIES = [
  { value: "customs_compliance", label: "Customs & Compliance", color: "bg-blue-100 text-blue-800" },
  { value: "power_of_attorney", label: "Power of Attorney", color: "bg-purple-100 text-purple-800" },
  { value: "isf_related", label: "ISF Related", color: "bg-green-100 text-green-800" },
  { value: "regulatory", label: "Regulatory / CBP", color: "bg-amber-100 text-amber-800" },
  { value: "company_docs", label: "Company Documents", color: "bg-slate-100 text-slate-800" },
  { value: "templates", label: "Templates", color: "bg-teal-100 text-teal-800" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
];

const DOC_CATEGORY_LABELS: Record<string, string> = {
  bill_of_lading: "Bill of Lading",
  commercial_invoice: "Commercial Invoice",
  packing_list: "Packing List",
  certificate_of_origin: "Certificate of Origin",
  delivery_order: "Delivery Order",
  customs_entry: "Customs Entry",
  isf_filing: "ISF Filing",
  air_waybill: "Air Waybill",
  other: "Other",
};

function getTransportIcon(mode: string) {
  switch (mode?.toLowerCase()) {
    case "air": return Plane;
    case "ocean": return Ship;
    case "trucking": case "last_mile": return Truck;
    default: return Package;
  }
}

function getCategoryBadge(cat: string) {
  const found = STANDALONE_CATEGORIES.find((c) => c.value === cat);
  return found
    ? <Badge className={`text-xs ${found.color} border-0`}>{found.label}</Badge>
    : <Badge variant="outline" className="text-xs">{cat}</Badge>;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Standalone Upload Dialog ─────────────────────────────────────────────────

function StandaloneUploadDialog({ onUploaded }: { onUploaded: () => void }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("other");
  const [label, setLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.append("documents", file);
    form.append("category", "other");
    form.append("documentCategory", category);
    form.append("documentLabel", label || file.name);
    form.append("isStandalone", "true");
    try {
      await fetch("/api/documents/upload", { method: "POST", body: form, credentials: "include" });
      onUploaded();
      setOpen(false);
      setFile(null);
      setLabel("");
      setCategory("other");
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-freight-blue hover:bg-freight-blue/90 text-white">
          <Plus className="w-4 h-4 mr-2" /> Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-freight-blue" /> Upload General Document
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-xs mb-1 block">Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STANDALONE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Label (optional)</Label>
            <Input placeholder="e.g. POA for Acme Imports 2026" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">File</Label>
            <input
              type="file"
              className="w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-freight-blue file:text-white file:cursor-pointer"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.xml,.txt"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="flex-1 bg-freight-blue hover:bg-freight-blue/90 text-white"
              disabled={!file || uploading}
              onClick={handleUpload}
            >
              {uploading ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Standalone Doc Row ───────────────────────────────────────────────────────

function StandaloneDocRow({ doc }: { doc: Document }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-blue-100 hover:bg-blue-50/30 transition-all group">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center">
        <File className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {(doc as any).documentLabel || doc.originalName}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
          {doc.uploadedAt && (
            <span className="text-xs text-gray-400">· {format(new Date(doc.uploadedAt), "MMM d, yyyy")}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {getCategoryBadge((doc as any).documentCategory || "other")}
        <a
          href={`/api/documents/${doc.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-freight-blue">
            <Download className="w-3.5 h-3.5" />
          </Button>
        </a>
        <a
          href={`/api/documents/${doc.id}/view`}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Button size="icon" variant="ghost" className="w-7 h-7 text-gray-400 hover:text-freight-blue">
            <Eye className="w-3.5 h-3.5" />
          </Button>
        </a>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: shipments = [] } = useQuery<Shipment[]>({ queryKey: ["/api/shipments"] });
  const { data: standaloneDocs = [], refetch: refetchStandalone } = useQuery<Document[]>({
    queryKey: ["/api/documents/standalone"],
  });
  const { data: docStats } = useQuery({
    queryKey: ["/api/documents/stats"],
  });

  const filteredStandalone = standaloneDocs.filter((doc) => {
    const matchSearch =
      !searchTerm ||
      (doc as any).documentLabel?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchCat =
      categoryFilter === "all" || (doc as any).documentCategory === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <Card className="gradient-primary border-0 mb-2">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-white mb-1 flex items-center gap-2">
                <FolderOpen className="w-7 h-7" /> Documents
              </h1>
              <p className="text-blue-100 text-sm">
                Manage your shipping documents, compliance files, and templates
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/20 rounded-lg px-4 py-2 text-center">
                <p className="text-white text-xl font-bold">{(docStats as any)?.total || 0}</p>
                <p className="text-blue-100 text-xs">Total Documents</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="shipment" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="shipment" className="flex items-center gap-2">
            <Ship className="w-4 h-4" /> Shipment Documents
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4" /> General Documents
          </TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Shipment Documents ─────────────────────────────────── */}
        <TabsContent value="shipment" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Ship className="w-5 h-5 text-freight-blue" /> Shipment Documents
                </CardTitle>
                {selectedShipmentId !== "all" && selectedShipmentId && (
                  <DocumentUpload
                    shipmentId={parseInt(selectedShipmentId)}
                    trigger={
                      <Button size="sm" className="bg-freight-blue hover:bg-freight-blue/90 text-white">
                        <Upload className="w-4 h-4 mr-1" /> Upload to Shipment
                      </Button>
                    }
                    onShipmentCreated={() => {
                      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
                      queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
                    }}
                  />
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Shipment selector */}
              <div className="mb-4">
                <Label className="text-xs mb-1.5 block text-gray-500">Select a shipment to view its documents</Label>
                <Select value={selectedShipmentId} onValueChange={setSelectedShipmentId}>
                  <SelectTrigger className="max-w-sm">
                    <SelectValue placeholder="Choose a shipment..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">— All Shipments —</SelectItem>
                    {(shipments as Shipment[]).map((s) => {
                      const Icon = getTransportIcon(s.transportMode || "");
                      return (
                        <SelectItem key={s.id} value={String(s.id)}>
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-freight-blue" />
                            {s.shipmentId} — {s.origin} → {s.destination}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Shipment document list */}
              {selectedShipmentId && selectedShipmentId !== "all" ? (
                <DocumentList shipmentId={parseInt(selectedShipmentId)} />
              ) : (
                <div className="text-center py-10 text-gray-400">
                  <Ship className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm">Select a shipment above to view and manage its documents.</p>
                  {(shipments as Shipment[]).length === 0 && (
                    <p className="text-xs mt-2 text-gray-300">No shipments found. Upload documents from the Shipments page.</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab 2: General Documents ──────────────────────────────────── */}
        <TabsContent value="general" className="mt-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FolderOpen className="w-5 h-5 text-freight-blue" /> General Documents
                  <Badge variant="outline" className="text-xs ml-1">{standaloneDocs.length}</Badge>
                </CardTitle>
                <StandaloneUploadDialog onUploaded={() => {
                  refetchStandalone();
                  queryClient.invalidateQueries({ queryKey: ["/api/documents/stats"] });
                }} />
              </div>
            </CardHeader>
            <CardContent>
              {/* Filters */}
              <div className="flex flex-col sm:flex-row gap-3 mb-5">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9 text-sm"
                    placeholder="Search documents..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-48">
                    <Tag className="w-3.5 h-3.5 mr-2 text-gray-400" />
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {STANDALONE_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Category summary pills */}
              <div className="flex flex-wrap gap-2 mb-4">
                {STANDALONE_CATEGORIES.map((cat) => {
                  const count = standaloneDocs.filter((d) => (d as any).documentCategory === cat.value).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={cat.value}
                      onClick={() => setCategoryFilter(categoryFilter === cat.value ? "all" : cat.value)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        categoryFilter === cat.value
                          ? "border-freight-blue bg-blue-50 text-freight-blue"
                          : "border-gray-200 bg-white text-gray-600 hover:border-blue-200"
                      }`}
                    >
                      {cat.label}
                      <span className="bg-gray-200 text-gray-600 rounded-full px-1.5 py-0 text-[10px]">{count}</span>
                    </button>
                  );
                })}
              </div>

              {/* Document list */}
              {filteredStandalone.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <FolderOpen className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                  <p className="text-sm font-medium">
                    {searchTerm || categoryFilter !== "all"
                      ? "No documents match your filters."
                      : "No general documents yet."}
                  </p>
                  <p className="text-xs mt-1">
                    {!searchTerm && categoryFilter === "all"
                      ? "Upload compliance docs, templates, POAs, and reference files here."
                      : ""}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredStandalone.map((doc) => (
                    <StandaloneDocRow key={doc.id} doc={doc} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
