import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, Upload, FileText, Database } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function XmlUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/xml' || file.type === 'text/xml' || file.name.endsWith('.xml')) {
        setSelectedFile(file);
        setUploadResult(null);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please select an XML file",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "No File Selected",
        description: "Please select an XML file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('xmlFile', selectedFile);

      const response = await fetch('/api/shipments/xml/process', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      const result = await response.json();
      setUploadResult(result);

      toast({
        title: "XML Processing Complete",
        description: `Successfully processed ${selectedFile.name}`,
      });

    } catch (error: any) {
      console.error('XML upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to process XML file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center space-x-2">
        <Database className="h-6 w-6 text-primary" />
        <h1 className="text-3xl font-bold">XML Shipment Processing</h1>
      </div>
      
      <p className="text-muted-foreground">
        Upload and process XML shipment files using the comprehensive hierarchical data structure.
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="h-5 w-5" />
            <span>Upload XML Shipment File</span>
          </CardTitle>
          <CardDescription>
            Select an XML file containing shipment data to process and store in the database.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="xmlFile">XML File</Label>
            <Input
              id="xmlFile"
              type="file"
              accept=".xml,application/xml,text/xml"
              onChange={handleFileSelect}
              disabled={isUploading}
            />
            {selectedFile && (
              <p className="text-sm text-muted-foreground">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing XML...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Process XML Shipment
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {uploadResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Processing Result</CardTitle>
            <CardDescription>
              XML file successfully processed and stored in the database
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm">Shipment ID:</h4>
                <p className="text-sm bg-muted p-2 rounded">{uploadResult.shipmentId}</p>
              </div>

              <div>
                <h4 className="font-semibold text-sm">Message:</h4>
                <p className="text-sm bg-muted p-2 rounded">{uploadResult.message}</p>
              </div>

              {uploadResult.shipment && (
                <div className="space-y-4">
                  <Separator />
                  <h4 className="font-semibold">Shipment Details:</h4>
                  
                  {/* Main Shipment */}
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <h5 className="font-medium mb-2">Main Shipment Data</h5>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="font-medium">Transaction ID:</span> {formatValue(uploadResult.shipment.shipment.transactionId)}</div>
                      <div><span className="font-medium">Shipment Type:</span> {formatValue(uploadResult.shipment.shipment.shipmentType)}</div>
                      <div><span className="font-medium">Vessel Name:</span> {formatValue(uploadResult.shipment.shipment.vesselName)}</div>
                      <div><span className="font-medium">Bill Number:</span> {formatValue(uploadResult.shipment.shipment.masterBillNumber)}</div>
                      <div><span className="font-medium">Booking Number:</span> {formatValue(uploadResult.shipment.shipment.bookingNumber)}</div>
                      <div><span className="font-medium">Transportation Method:</span> {formatValue(uploadResult.shipment.shipment.transportationMethod)}</div>
                    </div>
                  </div>

                  {/* Parties */}
                  {uploadResult.shipment.parties && uploadResult.shipment.parties.length > 0 && (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Parties ({uploadResult.shipment.parties.length})</h5>
                      <div className="space-y-2">
                        {uploadResult.shipment.parties.map((party: any, index: number) => (
                          <div key={index} className="text-sm bg-white p-2 rounded">
                            <span className="font-medium">{party.partyType}:</span> {party.name}
                            {party.cityName && ` - ${party.cityName}, ${party.countryCode}`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Locations */}
                  {uploadResult.shipment.locations && uploadResult.shipment.locations.length > 0 && (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Locations ({uploadResult.shipment.locations.length})</h5>
                      <div className="space-y-2">
                        {uploadResult.shipment.locations.map((location: any, index: number) => (
                          <div key={index} className="text-sm bg-white p-2 rounded">
                            <span className="font-medium">{location.locationType}:</span> {location.locationName}
                            {location.countryCode && ` (${location.countryCode})`}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Containers */}
                  {uploadResult.shipment.containers && uploadResult.shipment.containers.length > 0 && (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Containers ({uploadResult.shipment.containers.length})</h5>
                      <div className="space-y-2">
                        {uploadResult.shipment.containers.map((container: any, index: number) => (
                          <div key={index} className="text-sm bg-white p-2 rounded">
                            <span className="font-medium">Container:</span> {container.fullContainerNumber || `${container.equipmentInitial}${container.equipmentNumber}`}
                            <br />
                            <span className="font-medium">Type:</span> {container.equipmentTypeCode}
                            {container.sealNumber1 && (
                              <>
                                <br />
                                <span className="font-medium">Seals:</span> {[container.sealNumber1, container.sealNumber2, container.sealNumber3].filter(Boolean).join(', ')}
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contents */}
                  {uploadResult.shipment.contents && uploadResult.shipment.contents.length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Contents ({uploadResult.shipment.contents.length})</h5>
                      <div className="space-y-2">
                        {uploadResult.shipment.contents.map((content: any, index: number) => (
                          <div key={index} className="text-sm bg-white p-2 rounded">
                            <div><span className="font-medium">Description:</span> {content.description}</div>
                            <div><span className="font-medium">Quantity:</span> {content.quantityShipped} {content.unitOfMeasure}</div>
                            <div><span className="font-medium">Weight:</span> {content.grossWeight} {content.weightUnit}</div>
                            {content.value && <div><span className="font-medium">Value:</span> {content.currency} {content.value}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Charges */}
                  {uploadResult.shipment.charges && uploadResult.shipment.charges.length > 0 && (
                    <div className="bg-red-50 p-4 rounded-lg">
                      <h5 className="font-medium mb-2">Charges ({uploadResult.shipment.charges.length})</h5>
                      <div className="space-y-2">
                        {uploadResult.shipment.charges.map((charge: any, index: number) => (
                          <div key={index} className="text-sm bg-white p-2 rounded">
                            <div><span className="font-medium">{charge.chargeType}:</span> {charge.description}</div>
                            <div><span className="font-medium">Amount:</span> {charge.currency} {charge.chargeAmount}</div>
                            <div><span className="font-medium">Payment:</span> {charge.paymentMethod}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}