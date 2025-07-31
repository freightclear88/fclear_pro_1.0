import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { FileText, Upload, CreditCard, Ship, Plane, Truck, Calendar, MapPin, Building2, DollarSign, CheckCircle, Clock, AlertCircle, FileUp } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { IsfFiling } from "@shared/schema";

// ISF 10+2 Form Schema with all mandatory CBP fields
const isfFormSchema = z.object({
  // ISF 10 Required Data Elements (from Importer)
  
  // 1. Seller (Entity that sold the goods to the buyer)
  sellerName: z.string().min(1, "Seller name is required"),
  sellerAddress: z.string().min(1, "Seller address is required"),
  sellerCity: z.string().min(1, "Seller city is required"),
  sellerState: z.string().optional(),
  sellerCountry: z.string().min(1, "Seller country is required"),

  // 2. Buyer (Entity to whom the goods are sold) 
  buyerName: z.string().min(1, "Buyer name is required"),
  buyerAddress: z.string().min(1, "Buyer address is required"),
  buyerCity: z.string().min(1, "Buyer city is required"),
  buyerState: z.string().optional(),
  buyerZip: z.string().optional(),
  buyerCountry: z.string().min(1, "Buyer country is required"),

  // 3. Importer of Record Number (IRS/EIN/SSN/CBP number)
  importerOfRecord: z.string().min(1, "Importer of Record Number is required"),

  // 4. Consignee Number (IRS/EIN/SSN/CBP number) 
  consigneeNumber: z.string().min(1, "Consignee Number is required"),

  // 5. Manufacturer/Supplier (Last entity that manufactured/assembled the goods)
  manufacturerName: z.string().min(1, "Manufacturer name is required"),
  manufacturerAddress: z.string().min(1, "Manufacturer address is required"),
  manufacturerCity: z.string().min(1, "Manufacturer city is required"),
  manufacturerState: z.string().optional(),
  manufacturerCountry: z.string().min(1, "Manufacturer country is required"),

  // 6. Ship-to Party (First party to receive goods after customs release)
  shipToPartyName: z.string().min(1, "Ship-to party name is required"),
  shipToPartyAddress: z.string().min(1, "Ship-to party address is required"),
  shipToPartyCity: z.string().min(1, "Ship-to party city is required"),
  shipToPartyState: z.string().min(1, "Ship-to party state is required"),
  shipToPartyZip: z.string().min(1, "Ship-to party ZIP is required"),
  shipToPartyCountry: z.string().default("US"),

  // 7. Country of Origin (Where goods were manufactured/produced/grown)
  countryOfOrigin: z.string().min(1, "Country of origin is required"),

  // 8. Harmonized Tariff Schedule Number (10-digit for unified filing)
  htsusNumber: z.string().min(10, "HTS number must be 10 digits for unified filing").max(10, "HTS number must be exactly 10 digits"),

  // 9. Container Stuffing Location (Can be filed later - flexible timing)
  containerStuffingLocation: z.string().optional(),
  containerStuffingCity: z.string().optional(),
  containerStuffingState: z.string().optional(),
  containerStuffingCountry: z.string().optional(),

  // 10. Consolidator/Stuffer (Can be filed later - flexible timing)
  consolidatorName: z.string().optional(),
  consolidatorAddress: z.string().optional(),
  consolidatorCity: z.string().optional(),
  consolidatorState: z.string().optional(),
  consolidatorCountry: z.string().optional(),

  // Additional Required Fields for Complete ISF
  
  // Bill of Lading (Links ISF to manifest data)
  billOfLading: z.string().optional(),
  
  // Vessel Information
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  
  // Port Information
  foreignPortOfLading: z.string().optional(),
  portOfEntry: z.string().optional(),
  
  // Dates
  estimatedDepartureDate: z.string().optional(),
  estimatedArrivalDate: z.string().optional(),

  // Container Information
  containerNumbers: z.string().optional(),

  // Commercial Information (Optional but commonly included)
  commodityDescription: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  invoiceValue: z.string().optional(),
  currency: z.string().default("USD"),
  terms: z.string().optional(), // FOB, CIF, etc.
  
  // Additional party information for completeness
  importerName: z.string().optional(),
  importerAddress: z.string().optional(),
  importerCity: z.string().optional(),
  importerState: z.string().optional(),
  importerZip: z.string().optional(),
  importerCountry: z.string().default("US"),

  consigneeName: z.string().optional(),
  consigneeAddress: z.string().optional(),
  consigneeCity: z.string().optional(),
  consigneeState: z.string().optional(),
  consigneeZip: z.string().optional(),
  consigneeCountry: z.string().default("US"),
});

type IsfFormData = z.infer<typeof isfFormSchema>;

// US States for dropdowns
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

// Common Countries
const COUNTRIES = [
  "China", "Mexico", "Canada", "Germany", "Japan", "United Kingdom", 
  "South Korea", "India", "Taiwan", "Vietnam", "Thailand", "Malaysia", 
  "Singapore", "Philippines", "Indonesia", "Brazil", "Italy", "France",
  "Netherlands", "Belgium", "Spain", "Turkey", "Israel", "Other"
];

// Major US Ports
const US_PORTS = [
  "Los Angeles, CA", "Long Beach, CA", "New York/New Jersey", "Savannah, GA",
  "Houston, TX", "Norfolk, VA", "Oakland, CA", "Charleston, SC", "Miami, FL",
  "Tacoma, WA", "Boston, MA", "Baltimore, MD", "Seattle, WA", "Port Everglades, FL"
];

function IsfFilingForm({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);

  const form = useForm<IsfFormData>({
    resolver: zodResolver(isfFormSchema),
    defaultValues: {
      // Company Information
      importerName: "",
      importerAddress: "",
      importerCity: "",
      importerState: "",
      importerZip: "",
      importerCountry: "US",
      importerOfRecord: "",
      
      consigneeName: "",
      consigneeAddress: "",
      consigneeCity: "",
      consigneeState: "",
      consigneeZip: "",
      consigneeCountry: "US",
      consigneeNumber: "",
      
      // Shipping Information (will be populated from document scan)
      vesselName: "",
      voyageNumber: "",
      containerNumbers: "",
      billOfLading: "",
      portOfEntry: "",
      foreignPortOfLading: "",
      estimatedDepartureDate: "",
      estimatedArrivalDate: "",
      
      // Manufacturer/Supplier
      manufacturerName: "",
      manufacturerAddress: "",
      manufacturerCity: "",
      manufacturerState: "",
      manufacturerCountry: "",
      
      // Seller/Buyer
      sellerName: "",
      sellerAddress: "",
      sellerCity: "",
      sellerState: "",
      sellerCountry: "",
      
      buyerName: "",
      buyerAddress: "",
      buyerCity: "",
      buyerState: "",
      buyerZip: "",
      buyerCountry: "",
      
      // Ship-to Party
      shipToPartyName: "",
      shipToPartyAddress: "",
      shipToPartyCity: "",
      shipToPartyState: "",
      shipToPartyZip: "",
      shipToPartyCountry: "US",
      
      // Container/Consolidator
      containerStuffingLocation: "",
      containerStuffingCity: "",
      containerStuffingState: "",
      containerStuffingCountry: "",
      
      consolidatorName: "",
      consolidatorAddress: "",
      consolidatorCity: "",
      consolidatorState: "",
      consolidatorCountry: "",
      
      // Commodity Information
      countryOfOrigin: "",
      htsusNumber: "",
      commodityDescription: "",
      
      // Commercial Information
      currency: "USD",
      invoiceNumber: "",
      invoiceDate: "",
      invoiceValue: "",
      terms: "",
    },
  });

  // File upload handler for PDF scanning
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Accept PDF, Excel, and other document types
    const allowedTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.(pdf|xls|xlsx|doc|docx)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload PDF, Excel, or Word files",
        variant: "destructive",
      });
      return;
    }

    setUploadedFile(file);
    setIsScanning(true);

    try {
      const formData = new FormData();
      formData.append("isfDocument", file);

      const response = await fetch("/api/isf/scan-document", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to scan document");
      }

      const result = await response.json();
      
      // Handle the response with extracted data
      if (result.success && result.extractedData) {
        console.log("Extracted data received:", result.extractedData);
        
        // Map extracted data to form fields - ensure exact field name matching
        const fieldMapping: Record<string, string> = {
          vesselName: 'vesselName',
          voyageNumber: 'voyageNumber', 
          containerNumbers: 'containerNumbers',
          billOfLading: 'billOfLading',
          portOfEntry: 'portOfEntry',
          estimatedArrivalDate: 'estimatedArrivalDate',
          importerName: 'importerName',
          consigneeName: 'consigneeName',
          manufacturerCountry: 'manufacturerCountry',
          countryOfOrigin: 'countryOfOrigin',
          htsusNumber: 'htsusNumber',
          commodityDescription: 'commodityDescription'
        };

        // Store extracted data and populate form
        setExtractedData(result.extractedData);
        
        // Populate form with extracted data
        Object.entries(result.extractedData).forEach(([extractedKey, value]) => {
          const formFieldKey = fieldMapping[extractedKey];
          
          if (formFieldKey && value && value.toString().trim() && value.toString().trim() !== 'TBD') {
            try {
              console.log(`Setting ${formFieldKey} to:`, value);
              
              // Handle date fields specially
              if (formFieldKey === 'estimatedArrivalDate' && value) {
                const dateValue = new Date(value.toString());
                if (!isNaN(dateValue.getTime())) {
                  const dateString = dateValue.toISOString().split('T')[0];
                  form.setValue(formFieldKey as keyof IsfFormData, dateString, { 
                    shouldValidate: false, 
                    shouldDirty: true 
                  });
                  console.log(`Set date field ${formFieldKey} to:`, dateString);
                }
              } else {
                const stringValue = value.toString().trim();
                form.setValue(formFieldKey as keyof IsfFormData, stringValue, { 
                  shouldValidate: false, 
                  shouldDirty: true 
                });
                console.log(`Set field ${formFieldKey} to:`, stringValue);
              }
            } catch (error) {
              console.error(`Failed to set ${formFieldKey}:`, error);
            }
          }
        });
        
        // Force form re-render and clear validation errors
        setTimeout(() => {
          console.log("Form values after population:", form.getValues());
          form.clearErrors(); // Clear validation errors to allow manual entry
          
          // Force re-render
          setIsScanning(false);
        }, 200);

        toast({
          title: "Document Scanned Successfully",
          description: `Extracted shipping data from ${file.name}. Review and complete the remaining fields before submitting.`,
        });
        
        return;

      } else {
        toast({
          title: "No data extracted",
          description: "Unable to extract ISF data from the document",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Document scanning error:", error);
      toast({
        title: "Scanning failed",
        description: "Could not extract data from document. Please fill form manually.",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const createIsfMutation = useMutation({
    mutationFn: async (data: IsfFormData) => {
      const formData = new FormData();
      
      // Add form data
      Object.entries(data).forEach(([key, value]) => {
        if (value) formData.append(key, value);
      });

      // Add uploaded file if present
      if (uploadedFile) {
        formData.append("isfDocument", uploadedFile);
      }

      return await apiRequest("/api/isf/create", {
        method: "POST",
        body: formData,
      });
    },
    onSuccess: (result) => {
      toast({
        title: "ISF Filing Created",
        description: `ISF ${result.isfNumber} created successfully. Proceed to payment.`,
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to create ISF filing",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IsfFormData) => {
    createIsfMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Document Upload Section */}
        <Card className="border-2 border-dashed border-gray-200 bg-gradient-to-br from-teal-50 to-cyan-50">
          <CardHeader>
            <CardTitle className="flex items-center text-teal-700">
              <FileUp className="w-5 h-5 mr-2" />
              Upload ISF Document (Optional)
            </CardTitle>
            <CardDescription>
              Upload your own ISF info sheet in PDF or Excel XLS format and our system will automatically extract ISF data
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-teal-300 border-dashed rounded-lg cursor-pointer bg-teal-50 hover:bg-teal-100">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                  {isScanning ? (
                    <>
                      <Clock className="w-8 h-8 mb-2 text-teal-500 animate-pulse" />
                      <p className="text-sm text-teal-600">Scanning document...</p>
                    </>
                  ) : uploadedFile ? (
                    <>
                      <CheckCircle className="w-8 h-8 mb-2 text-green-500" />
                      <p className="text-sm text-gray-700 font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-gray-500">Document uploaded successfully</p>
                      {extractedData && (
                        <div className="mt-2 p-2 bg-green-100 border border-green-300 rounded text-xs">
                          <p className="text-green-700 font-medium">✓ Data extracted and populated in form</p>
                          <p className="text-green-600">
                            Vessel: {extractedData.vesselName} | 
                            Voyage: {extractedData.voyageNumber} |
                            Container: {extractedData.containerNumbers}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <Upload className="w-8 h-8 mb-2 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Click to upload</span> ISF document
                      </p>
                      <p className="text-xs text-gray-500">PDF, Excel, DOC, and image files</p>
                    </>
                  )}
                </div>
                <input 
                  type="file" 
                  className="hidden" 
                  accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.gif"
                  onChange={handleFileUpload}
                  disabled={isScanning}
                />
              </label>
            </div>
          </CardContent>
        </Card>

        {/* ISF 10+2 Required Data Elements */}
        <div className="grid gap-6">
          {/* 1. Seller Information */}
          <Card className="bg-gradient-to-r from-red-50 to-pink-50 border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                1. Seller Information
              </CardTitle>
              <CardDescription>Last known entity that sold the goods to the buyer</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sellerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seller Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Selling company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellerCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seller Country *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellerAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Seller Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Complete seller address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellerCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sellerState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="State or Province (if applicable)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 2. Buyer Information */}
          <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-700 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                2. Buyer Information
              </CardTitle>
              <CardDescription>Entity to whom the goods are sold</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buyerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Buying company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyerCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer Country *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || "United States"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="United States">United States</SelectItem>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyerAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Buyer Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Complete buyer address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyerCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyerState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="State or Province" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="buyerZip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP/Postal Code</FormLabel>
                    <FormControl>
                      <Input placeholder="ZIP or Postal Code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 3. Importer of Record Number */}
          <Card className="bg-gradient-to-r from-purple-50 to-violet-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-700 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                3. Importer of Record Number
              </CardTitle>
              <CardDescription>IRS number, EIN, SSN, or CBP-assigned number</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="importerOfRecord"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Importer of Record Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="EIN, IRS Number, SSN, or CBP-assigned number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 4. Consignee Number */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                4. Consignee Number
              </CardTitle>
              <CardDescription>IRS number, EIN, SSN, or CBP-assigned number of US consignee</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="consigneeNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignee Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="EIN, IRS Number, SSN, or CBP-assigned number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 5. Manufacturer/Supplier */}
          <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
            <CardHeader>
              <CardTitle className="text-orange-700 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                5. Manufacturer/Supplier
              </CardTitle>
              <CardDescription>Last entity that manufactured, assembled, produced, or grew the goods</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="manufacturerName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Manufacturing company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturerCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer Country *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturerAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Manufacturer Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Complete manufacturer address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturerCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manufacturerState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="State or Province (if applicable)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 6. Ship-to Party */}
          <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
            <CardHeader>
              <CardTitle className="text-teal-700 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                6. Ship-to Party
              </CardTitle>
              <CardDescription>First party to physically receive goods after customs release</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="shipToPartyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ship-to Party Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Final delivery party name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shipToPartyCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <FormControl>
                      <Input value="US" disabled />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shipToPartyAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Ship-to Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Final delivery address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shipToPartyCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shipToPartyState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select state" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {US_STATES.map((state) => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="shipToPartyZip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code *</FormLabel>
                    <FormControl>
                      <Input placeholder="ZIP Code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 7. Country of Origin */}
          <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
            <CardHeader>
              <CardTitle className="text-yellow-700 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                7. Country of Origin
              </CardTitle>
              <CardDescription>Country where goods were manufactured, produced, or grown</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="countryOfOrigin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country of Origin *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select origin country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 8. HTS Number */}
          <Card className="bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
            <CardHeader>
              <CardTitle className="text-indigo-700 flex items-center">
                <FileText className="w-5 h-5 mr-2" />
                8. Harmonized Tariff Schedule (HTS) Number
              </CardTitle>
              <CardDescription>10-digit HTS classification number (required for unified filing)</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="htsusNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTS Number (10 digits) *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="1234567890" 
                        maxLength={10}
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 9. Container Stuffing Location */}
          <Card className="bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-700 flex items-center">
                <MapPin className="w-5 h-5 mr-2" />
                9. Container Stuffing Location
              </CardTitle>
              <CardDescription>Physical location where goods were stuffed into container (flexible timing)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="containerStuffingLocation"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Stuffing Location *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Name and address of stuffing location" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="containerStuffingCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="Stuffing city" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="containerStuffingCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 10. Consolidator/Stuffer */}
          <Card className="bg-gradient-to-r from-rose-50 to-pink-50 border-rose-200">
            <CardHeader>
              <CardTitle className="text-rose-700 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                10. Consolidator/Stuffer
              </CardTitle>
              <CardDescription>Party who stuffed the container or arranged for stuffing (flexible timing)</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="consolidatorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consolidator Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Consolidator company name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consolidatorCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consolidatorAddress"
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Consolidator Address *</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Complete consolidator address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consolidatorCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input placeholder="City" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consolidatorState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State/Province</FormLabel>
                    <FormControl>
                      <Input placeholder="State or Province (if applicable)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Shipment Information Section */}
          <Card className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200">
            <CardHeader>
              <CardTitle className="text-slate-700 flex items-center">
                <Ship className="w-5 h-5 mr-2" />
                Shipment Details
              </CardTitle>
              <CardDescription>Required shipment and vessel information</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="billOfLading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bill of Lading Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Master BL or House BL number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="containerNumbers"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container Numbers *</FormLabel>
                    <FormControl>
                      <Input placeholder="Container numbers (comma-separated)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vesselName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vessel Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="Name of carrying vessel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="voyageNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Voyage Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Voyage or trip number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="foreignPortOfLading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foreign Port of Lading *</FormLabel>
                    <FormControl>
                      <Input placeholder="Port where cargo was loaded" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="portOfEntry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port of Entry *</FormLabel>
                    <FormControl>
                      <Input placeholder="Port of entry (e.g., Long Beach, NBUC)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="foreignPortOfLading"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Foreign Port of Lading *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select foreign port" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Los Angeles">Los Angeles, CA</SelectItem>
                        <SelectItem value="Long Beach">Long Beach, CA</SelectItem>
                        <SelectItem value="New York">New York, NY</SelectItem>
                        <SelectItem value="Newark">Newark, NJ</SelectItem>
                        <SelectItem value="Savannah">Savannah, GA</SelectItem>
                        <SelectItem value="Charleston">Charleston, SC</SelectItem>
                        <SelectItem value="Houston">Houston, TX</SelectItem>
                        <SelectItem value="Seattle">Seattle, WA</SelectItem>
                        <SelectItem value="Oakland">Oakland, CA</SelectItem>
                        <SelectItem value="Miami">Miami, FL</SelectItem>
                        <SelectItem value="NBUC">NBUC (Ningbo, China)</SelectItem>
                        <SelectItem value="Other">Other Port</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedDepartureDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Departure Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="estimatedArrivalDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estimated Arrival Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
          
          {/* Submit Button */}
          <div className="flex justify-end pt-6">
            <Button 
              type="submit" 
              size="lg" 
              disabled={createIsfMutation.isPending}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-8 py-3"
            >
              {createIsfMutation.isPending ? (
                <>
                  <Clock className="w-4 h-4 mr-2 animate-spin" />
                  Creating ISF Filing...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Create ISF Filing & Proceed to Payment ($35.00)
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}

function IsfFilingsList() {
  const { data: filings = [], isLoading } = useQuery({
    queryKey: ["/api/isf/filings"],
    retry: false,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "paid":
        return <DollarSign className="w-4 h-4 text-blue-500" />;
      case "submitted":
        return <FileText className="w-4 h-4 text-orange-500" />;
      case "draft":
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "paid":
        return "bg-blue-100 text-blue-800";
      case "submitted":
        return "bg-orange-100 text-orange-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-red-100 text-red-800";
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <Clock className="w-8 h-8 mx-auto mb-4 text-gray-400 animate-spin" />
        <p className="text-gray-500">Loading ISF filings...</p>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <FileText className="w-5 h-5 mr-2 text-teal-600" />
          My ISF Filings
        </CardTitle>
        <CardDescription>
          Track the status of your ISF 10+2 filings
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filings.length === 0 ? (
          <div className="text-center py-8">
            <Ship className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 mb-2">No ISF filings yet</p>
            <p className="text-sm text-gray-400">Create your first ISF 10+2 filing to get started</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ISF Number</TableHead>
                <TableHead>Importer</TableHead>
                <TableHead>Port of Entry</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Filing Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(filings as IsfFiling[]).map((filing) => (
                <TableRow key={filing.id}>
                  <TableCell className="font-medium">{filing.isfNumber}</TableCell>
                  <TableCell>{filing.importerName}</TableCell>
                  <TableCell>{filing.portOfEntry}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(filing.status)} variant="secondary">
                      <div className="flex items-center gap-1">
                        {getStatusIcon(filing.status)}
                        {filing.status}
                      </div>
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {filing.filingDate ? new Date(filing.filingDate).toLocaleDateString() : "Draft"}
                  </TableCell>
                  <TableCell>${filing.paymentAmount || "35.00"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {filing.status === "draft" && (
                        <Link href={`/isf/edit/${filing.id}`}>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </Link>
                      )}
                      {filing.paymentStatus === "pending" && (
                        <Button size="sm" className="bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600">
                          Pay Now
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function FastIsf() {
  const [showForm, setShowForm] = useState(false);
  const queryClient = useQueryClient();

  const handleFormSuccess = () => {
    setShowForm(false);
    queryClient.invalidateQueries({ queryKey: ["/api/isf/filings"] });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Fast ISF
            </h1>
            <p className="text-lg text-gray-600 mt-2">
              Complete ISF 10+2 filing with AI-powered document scanning and instant payment processing
            </p>
          </div>
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogTrigger asChild>
              <Button 
                size="lg"
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white"
              >
                <FileText className="w-5 h-5 mr-2" />
                New ISF Filing
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-2xl text-teal-700">
                  Create New ISF 10+2 Filing
                </DialogTitle>
              </DialogHeader>
              <IsfFilingForm onSuccess={handleFormSuccess} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
          <CardHeader>
            <CardTitle className="text-teal-700 flex items-center">
              <Ship className="w-5 h-5 mr-2" />
              ISF 10+2 Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              All ocean shipments entering the US require ISF filing 24 hours before loading at origin port
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader>
            <CardTitle className="text-green-700 flex items-center">
              <FileUp className="w-5 h-5 mr-2" />
              AI Document Scanning
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Upload your commercial invoice or packing list and our AI will automatically extract ISF data
            </p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-700 flex items-center">
              <CreditCard className="w-5 h-5 mr-2" />
              $35 Fixed Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Simple, transparent pricing. Pay securely with credit card upon filing completion
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ISF Filings List */}
      <IsfFilingsList />
    </div>
  );
}