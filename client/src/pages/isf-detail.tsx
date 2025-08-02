import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Ship, 
  Copy, 
  Download, 
  CreditCard, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  ArrowLeft,
  Building,
  MapPin,
  Package,
  Truck
} from "lucide-react";

interface IsfDetail {
  id: number;
  isfNumber: string;
  status: string;
  filingDate: string;
  importerName: string;
  importerAddress: string;
  importerCity?: string;
  importerState?: string;
  importerZip?: string;
  importerCountry: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeCity?: string;
  consigneeState?: string;
  consigneeZip?: string;
  consigneeCountry: string;
  vesselName?: string;
  voyageNumber?: string;
  billOfLading?: string;
  containerNumbers?: string;
  portOfEntry: string;
  estimatedArrivalDate?: string;
  mblScacCode?: string;
  hblScacCode?: string;
  amsNumber?: string;
  containerStuffingLocation?: string;
  consolidatorStufferInfo?: string;
  manufacturerInformation?: string;
  sellerInformation?: string;
  buyerInformation?: string;
  countryOfOrigin?: string;
  htsusNumber?: string;
  commodityDescription?: string;
  invoiceNumber?: string;
  invoiceValue?: string;
  currency?: string;
  filingFee: number;
  paymentStatus: string;
  documents?: Array<{
    id: number;
    fileName: string;
    fileSize: number;
    uploadDate: string;
    documentType: string;
  }>;
}

export default function IsfDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();

  const { data: isfDetail, isLoading } = useQuery<IsfDetail>({
    queryKey: ['/api/isf', id],
    enabled: !!id
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: `${label} copied successfully`,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Draft</Badge>;
      case 'submitted':
        return <Badge variant="default"><FileText className="w-3 h-3 mr-1" />Submitted</Badge>;
      case 'paid':
        return <Badge variant="default"><CreditCard className="w-3 h-3 mr-1" />Paid</Badge>;
      case 'processed':
        return <Badge className="bg-blue-500"><Ship className="w-3 h-3 mr-1" />Processing</Badge>;
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const CopyField = ({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) => {
    if (!value) return null;
    
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
        <div className="flex items-center space-x-2 flex-1">
          {icon && <div className="text-gray-500">{icon}</div>}
          <div className="flex-1">
            <div className="text-xs text-gray-500 font-medium">{label}</div>
            <div className="text-sm text-gray-900 font-mono break-all">{value}</div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => copyToClipboard(value, label)}
          className="h-8 w-8 p-0 hover:bg-gray-200"
        >
          <Copy className="w-3 h-3" />
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (!isfDetail) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900 mb-2">ISF Filing Not Found</h2>
            <p className="text-gray-600 mb-4">The requested ISF filing could not be found.</p>
            <Link href="/fast-isf">
              <Button>Back to ISF Filings</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/fast-isf">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ISF Filing Details</h1>
            <p className="text-gray-600">Filing #{isfDetail.isfNumber}</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge(isfDetail.status)}
          {isfDetail.status === 'draft' && (
            <Button>
              <CreditCard className="w-4 h-4 mr-2" />
              Pay Filing Fee (${isfDetail.filingFee})
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Party Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building className="w-5 h-5 mr-2" />
                Party Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Importer of Record</h4>
                <div className="space-y-2">
                  <CopyField label="Company Name" value={isfDetail.importerName} />
                  <CopyField label="Address" value={isfDetail.importerAddress} />
                  {isfDetail.importerCity && (
                    <CopyField 
                      label="City, State ZIP" 
                      value={`${isfDetail.importerCity}${isfDetail.importerState ? `, ${isfDetail.importerState}` : ''}${isfDetail.importerZip ? ` ${isfDetail.importerZip}` : ''}`} 
                    />
                  )}
                  <CopyField label="Country" value={isfDetail.importerCountry} />
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="font-semibold text-gray-900 mb-3">Consignee</h4>
                <div className="space-y-2">
                  <CopyField label="Company Name" value={isfDetail.consigneeName} />
                  <CopyField label="Address" value={isfDetail.consigneeAddress} />
                  {isfDetail.consigneeCity && (
                    <CopyField 
                      label="City, State ZIP" 
                      value={`${isfDetail.consigneeCity}${isfDetail.consigneeState ? `, ${isfDetail.consigneeState}` : ''}${isfDetail.consigneeZip ? ` ${isfDetail.consigneeZip}` : ''}`} 
                    />
                  )}
                  <CopyField label="Country" value={isfDetail.consigneeCountry} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Ship className="w-5 h-5 mr-2" />
                Shipment Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <CopyField label="Bill of Lading" value={isfDetail.billOfLading} />
                  <CopyField label="Vessel Name" value={isfDetail.vesselName} />
                  <CopyField label="Voyage Number" value={isfDetail.voyageNumber} />
                  <CopyField label="Container Numbers" value={isfDetail.containerNumbers} />
                </div>
                <div className="space-y-2">
                  <CopyField label="Port of Entry" value={isfDetail.portOfEntry} icon={<MapPin className="w-4 h-4" />} />
                  <CopyField label="MBL SCAC Code" value={isfDetail.mblScacCode} />
                  <CopyField label="HBL SCAC Code" value={isfDetail.hblScacCode} />
                  <CopyField label="AMS Number" value={isfDetail.amsNumber} />
                </div>
              </div>
              
              {isfDetail.estimatedArrivalDate && (
                <CopyField 
                  label="Estimated Arrival Date" 
                  value={new Date(isfDetail.estimatedArrivalDate).toLocaleDateString()} 
                />
              )}
            </CardContent>
          </Card>

          {/* Commodity Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Commodity Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CopyField label="Country of Origin" value={isfDetail.countryOfOrigin} />
              <CopyField label="HTSUS Number" value={isfDetail.htsusNumber} />
              <CopyField label="Commodity Description" value={isfDetail.commodityDescription} />
            </CardContent>
          </Card>

          {/* Additional Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Truck className="w-5 h-5 mr-2" />
                Additional Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <CopyField label="Container Stuffing Location" value={isfDetail.containerStuffingLocation} />
              <CopyField label="Consolidator Information" value={isfDetail.consolidatorStufferInfo} />
              <CopyField label="Manufacturer Information" value={isfDetail.manufacturerInformation} />
              <CopyField label="Seller Information" value={isfDetail.sellerInformation} />
              <CopyField label="Buyer Information" value={isfDetail.buyerInformation} />
            </CardContent>
          </Card>

          {/* Commercial Information */}
          {(isfDetail.invoiceNumber || isfDetail.invoiceValue) && (
            <Card>
              <CardHeader>
                <CardTitle>Commercial Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <CopyField label="Invoice Number" value={isfDetail.invoiceNumber} />
                {isfDetail.invoiceValue && (
                  <CopyField 
                    label="Invoice Value" 
                    value={`${isfDetail.currency || 'USD'} ${isfDetail.invoiceValue}`} 
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Filing Status */}
          <Card>
            <CardHeader>
              <CardTitle>Filing Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Status</span>
                {getStatusBadge(isfDetail.status)}
              </div>
              
              {isfDetail.filingDate && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Filed Date</span>
                  <span className="text-sm font-medium">
                    {new Date(isfDetail.filingDate).toLocaleDateString()}
                  </span>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Filing Fee</span>
                <span className="text-sm font-medium">${isfDetail.filingFee}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Payment Status</span>
                <Badge variant={isfDetail.paymentStatus === 'paid' ? 'default' : 'secondary'}>
                  {isfDetail.paymentStatus}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full">
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
              
              {isfDetail.status === 'draft' && (
                <Button className="w-full">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Pay Filing Fee
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Documents */}
          {isfDetail.documents && isfDetail.documents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Submitted Documents</CardTitle>
                <CardDescription>
                  {isfDetail.documents.length} document(s) uploaded
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isfDetail.documents.map((doc) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.fileName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {doc.documentType} • {(doc.fileSize / 1024).toFixed(1)} KB
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(doc.uploadDate).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm">
                      <Download className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}