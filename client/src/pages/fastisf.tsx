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
import IsfDocumentUpload from "@/components/IsfDocumentUpload";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { IsfFiling } from "@shared/schema";

// ISF 10+2 Form Schema with all mandatory CBP fields
const isfFormSchema = z.object({
  // ISF 10 Required Data Elements (from Importer)
  
  // 1. Seller (Entity that sold the goods to the buyer)
  sellerInformation: z.string().min(1, "Seller information is required"),

  // 2. Buyer (Entity to whom the goods are sold) 
  buyerInformation: z.string().min(1, "Buyer information is required"),

  // 3. Importer of Record Number (IRS/EIN/SSN/CBP number)
  importerOfRecord: z.string().min(1, "Importer of Record Number is required"),

  // 4. Consignee (Entity receiving the goods)
  consignee: z.string().min(1, "Consignee information is required"),

  // 5. Manufacturer/Supplier (Last entity that manufactured/assembled the goods)
  manufacturerInformation: z.string().min(1, "Manufacturer/Supplier information is required"),

  // 6. Ship-to Party (First party to receive goods after customs release)
  shipToPartyInformation: z.string().min(1, "Ship-to party information is required"),

  // 7. Country of Origin (Where goods were manufactured/produced/grown)
  countryOfOrigin: z.string().min(1, "Country of origin is required"),

  // 8. Harmonized Tariff Schedule Number (10-digit for unified filing)
  htsusNumber: z.string().min(10, "HTS number must be 10 digits for unified filing").max(10, "HTS number must be exactly 10 digits"),

  // 9. Container Stuffing Location & 10. Consolidator (Separate)
  containerStuffingLocation: z.string().min(1, "Container stuffing location is required"),
  consolidatorStufferInfo: z.string().min(1, "Consolidator information is required"),

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
  mblScacCode: z.string().optional(),
  hblScacCode: z.string().optional(),
  
  // AMS Number
  amsNumber: z.string().optional(),

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
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [processedDocuments, setProcessedDocuments] = useState<any[]>([]);

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
      consignee: "",
      
      // Shipping Information (will be populated from document scan)
      vesselName: "",
      voyageNumber: "",
      containerNumbers: "",
      billOfLading: "",
      portOfEntry: "",
      foreignPortOfLading: "",
      estimatedDepartureDate: "",
      estimatedArrivalDate: "",
      
      // Consolidated party information
      manufacturerInformation: "Enter manufacturer/supplier name\nStreet Address\nCity, State\nCountry",
      sellerInformation: "Enter seller company name\nStreet Address\nCity, State\nCountry",
      buyerInformation: "Enter buyer company name\nStreet Address\nCity, State ZIP\nCountry",
      shipToPartyInformation: "Enter ship-to party name\nStreet Address\nCity, State ZIP\nUSA",
      
      // Container Stuffing Location & Consolidator (Separate)
      containerStuffingLocation: "",
      consolidatorStufferInfo: "",
      
      // SCAC Code fields
      mblScacCode: "",
      hblScacCode: "",
      
      // AMS Number
      amsNumber: "",
      
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

  // ISF document processing handler using the new consolidated backend system
  const handleIsfDocumentProcessing = async (files: File[]) => {
    if (!files.length) return;

    setUploadedFiles(files);
    setIsScanning(true);
    setProcessedDocuments([]);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("documents", file);
      });

      const response = await fetch("/api/isf/fill-form", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process documents");
      }

      const result = await response.json();
      
      // Handle the consolidated document response from the new backend system
      if (result.success && result.isfFormData) {
        console.log("ISF form data received from consolidated extraction:", result.isfFormData);
        setExtractedData(result.isfFormData);
        
        // Apply the extracted data directly to the form fields
        const data = result.isfFormData;
        
        // First, process the raw consolidated data to create proper ISF field values
        const rawConsolidated = result.consolidatedData || {};
        
        // Smart field combination and mapping
        const combinedFields: Record<string, string> = {};
        
        // Combine seller information (shipper from B/L)
        if (rawConsolidated.shipperName && rawConsolidated.shipperAddress) {
          combinedFields.sellerInformation = `${rawConsolidated.shipperName}\n${rawConsolidated.shipperAddress}`;
        } else if (rawConsolidated.shipperName) {
          combinedFields.sellerInformation = rawConsolidated.shipperName;
        }
        
        // Combine buyer information (consignee from B/L)
        if (rawConsolidated.consigneeName && rawConsolidated.consigneeAddress) {
          combinedFields.buyerInformation = `${rawConsolidated.consigneeName}\n${rawConsolidated.consigneeAddress}`;
        } else if (data.consigneeName && data.consigneeAddress) {
          combinedFields.buyerInformation = `${data.consigneeName}\n${data.consigneeAddress}`;
        }
        
        // CRITICAL: Consolidate consignee information for ISF field #4
        const consigneeParts: string[] = [];
        
        // Priority order: consigneeInformation -> consigneeName + consigneeAddress -> individual fields
        if (rawConsolidated.consigneeInformation) {
          consigneeParts.push(rawConsolidated.consigneeInformation);
        } else if (data.consigneeInformation) {
          consigneeParts.push(data.consigneeInformation);
        } else {
          // Build from individual fields
          if (rawConsolidated.consigneeName || data.consigneeName) {
            consigneeParts.push(rawConsolidated.consigneeName || data.consigneeName);
          }
          if (rawConsolidated.consigneeAddress || data.consigneeAddress) {
            consigneeParts.push(rawConsolidated.consigneeAddress || data.consigneeAddress);
          }
          if (rawConsolidated.consigneeCity || data.consigneeCity) {
            const cityState = [
              rawConsolidated.consigneeCity || data.consigneeCity,
              rawConsolidated.consigneeState || data.consigneeState
            ].filter(Boolean).join(', ');
            if (cityState) consigneeParts.push(cityState);
          }
          if (rawConsolidated.consigneeCountry || data.consigneeCountry) {
            consigneeParts.push(rawConsolidated.consigneeCountry || data.consigneeCountry);
          }
        }
        
        // Also check for alternative consignee field names from Bill of Lading
        if (!consigneeParts.length) {
          const altConsigneeFields = [
            rawConsolidated.deliverTo, data.deliverTo,
            rawConsolidated.recipient, data.recipient,
            rawConsolidated.consigneeContact, data.consigneeContact,
            rawConsolidated.consigneeCompany, data.consigneeCompany
          ].filter(Boolean);
          
          if (altConsigneeFields.length > 0) {
            consigneeParts.push(...altConsigneeFields);
          }
        }
        
        // Consolidate all consignee information
        if (consigneeParts.length > 0) {
          combinedFields.consignee = consigneeParts.join('\n');
        }
        
        // Handle ship-to party (usually same as consignee)
        if (rawConsolidated.notifyPartyName) {
          if (rawConsolidated.notifyPartyName.toLowerCase().includes('same as consignee') && combinedFields.buyerInformation) {
            combinedFields.shipToPartyInformation = combinedFields.buyerInformation;
          } else {
            combinedFields.shipToPartyInformation = rawConsolidated.notifyPartyName;
          }
        }
        
        // Handle consolidator information (required for ISF)
        if (rawConsolidated.freightPaymentTerms && rawConsolidated.shipperName) {
          combinedFields.consolidatorStufferInfo = `Consolidator: ${rawConsolidated.shipperName}\nTerms: ${rawConsolidated.freightPaymentTerms}`;
        } else if (rawConsolidated.shipperName) {
          combinedFields.consolidatorStufferInfo = rawConsolidated.shipperName;
        }
        
        // Handle manufacturer information with fallback to country of origin
        if (!data.manufacturerInformation && rawConsolidated.countryOfOrigin) {
          combinedFields.manufacturerInformation = `Manufactured in: ${rawConsolidated.countryOfOrigin}`;
        }
        
        // Map vessel and voyage information
        if (rawConsolidated.vesselAndVoyage) {
          const vesselParts = rawConsolidated.vesselAndVoyage.split(' ');
          if (vesselParts.length > 1) {
            combinedFields.vesselName = vesselParts.slice(0, -1).join(' ');
            combinedFields.voyageNumber = vesselParts[vesselParts.length - 1];
          } else {
            combinedFields.vesselName = rawConsolidated.vesselAndVoyage;
          }
        }
        
        // Enhanced field mapping
        const fieldMappings: Record<string, string> = {
          // Direct ISF field mappings
          importerName: 'importerName',
          importerAddress: 'importerAddress',
          manufacturerInformation: 'manufacturerInformation',
          countryOfOrigin: 'countryOfOrigin',
          containerStuffingLocation: 'containerStuffingLocation',
          
          // From consolidated B/L data
          billOfLadingNumber: 'billOfLading',
          containerNumber: 'containerNumbers',
          portOfLoading: 'foreignPortOfLading',
          portOfDischarge: 'portOfEntry',
          eta: 'estimatedArrivalDate',
          etd: 'estimatedDepartureDate',
          cargoDescription: 'commodityDescription',
          htsCode: 'htsusNumber',
          
          // SCAC Code mappings - CRITICAL FIX
          scacCode: 'mblScacCode',
          mblScacCode: 'mblScacCode',
          hblScacCode: 'hblScacCode',
          
          // Critical consignee field mappings - extract complete consignee information
          consigneeName: 'consignee', // Map consignee name to the new consignee field
          consigneeAddress: 'consignee', // Map consignee address to the new consignee field
          consigneeInformation: 'consignee', // Direct mapping for consignee info
          consigneeCompany: 'consignee', // Company name mapping
          consigneeContact: 'consignee', // Contact information
          consigneeDetails: 'consignee', // General consignee details
          'consignee name': 'consignee', // Alternative field name format
          'consignee address': 'consignee', // Alternative address format
          'consignee information': 'consignee', // Alternative info format
          deliverTo: 'consignee', // Delivery destination mapping
          receiveBy: 'consignee', // Receiving party mapping
          recipient: 'consignee', // Recipient information
          deliveryAddress: 'consignee', // Delivery address info
          shipperName: 'importerName', // Alternative mapping if importer not available
          shipperAddress: 'importerAddress', // Alternative mapping
          vesselAndVoyage: 'vesselName', // Will be split by combinedFields logic
          
          // Manufacturing information
          manufacturerCountry: 'countryOfOrigin',
          
          // Missing critical ISF mappings
          notifyPartyName: 'shipToPartyInformation', // Map notify party to ship-to party
          
          // From combined fields
          ...Object.keys(combinedFields).reduce((acc, key) => {
            acc[key] = key;
            return acc;
          }, {} as Record<string, string>)
        };
        
        // Set form values from both extracted data and combined fields
        const allData = { ...data, ...combinedFields, ...rawConsolidated };
        
        Object.entries(allData).forEach(([key, value]) => {
          if (value && typeof value === 'string' && value.trim() !== '') {
            const formField = fieldMappings[key];
            
            if (formField && form.setValue && typeof form.setValue === 'function') {
              try {
                form.setValue(formField as any, value, { 
                  shouldValidate: false, 
                  shouldDirty: true 
                });
                console.log(`Set ${formField}:`, value);
              } catch (error) {
                console.warn(`Failed to set form field ${formField}:`, error);
              }
            }
          }
        });
        
        toast({
          title: "Documents Processed Successfully",
          description: `${result.extractionSummary?.documentsProcessed || files.length} documents processed, ${result.extractionSummary?.fieldsExtracted || 0} fields extracted`,
        });
      } else {
        throw new Error("No data extracted from documents");
      }
    } catch (error) {
      console.error("Error processing ISF documents:", error);
      toast({
        title: "Document Processing Failed",
        description: error.message || "Failed to process documents",
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

      // Add uploaded files if present
      uploadedFiles.forEach(file => {
        formData.append("isfDocuments", file);
      });

      // Use fetch directly for FormData since apiRequest expects JSON
      const response = await fetch("/api/isf/create", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const text = (await response.text()) || response.statusText;
        throw new Error(`${response.status}: ${text}`);
      }

      return await response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "ISF Filing Created",
        description: `ISF ${result.isfNumber} created successfully. You can now view the filing details or proceed to payment.`,
        action: (
          <Link href={`/isf/detail/${result.id}`}>
            <Button variant="outline" size="sm">View Details</Button>
          </Link>
        ),
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
        {/* ISF Document Upload Section */}
        <IsfDocumentUpload 
          onFilesChange={handleIsfDocumentProcessing}
          isScanning={isScanning}
          processedDocuments={processedDocuments}
        />

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
            <CardContent>
              <FormField
                control={form.control}
                name="sellerInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Seller Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Company Name&#10;Street Address&#10;City, State&#10;Country"
                        className="min-h-24"
                        {...field} 
                      />
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
            <CardContent>
              <FormField
                control={form.control}
                name="buyerInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Buyer Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Company Name&#10;Street Address&#10;City, State ZIP&#10;Country"
                        className="min-h-24"
                        {...field} 
                      />
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

          {/* 4. Consignee */}
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardHeader>
              <CardTitle className="text-green-700 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                4. Consignee
              </CardTitle>
              <CardDescription>Entity receiving the goods in the United States</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="consignee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consignee Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Company Name&#10;Street Address&#10;City, State ZIP&#10;USA"
                        className="min-h-24"
                        {...field} 
                      />
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
            <CardContent>
              <FormField
                control={form.control}
                name="manufacturerInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer/Supplier Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Company Name&#10;Street Address&#10;City, State&#10;Country"
                        className="min-h-24"
                        {...field} 
                      />
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
            <CardContent>
              <FormField
                control={form.control}
                name="shipToPartyInformation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Ship-to Party Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Company Name&#10;Street Address&#10;City, State ZIP&#10;USA"
                        className="min-h-24"
                        {...field} 
                      />
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
              <CardDescription>Location where the container was stuffed/loaded</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="containerStuffingLocation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Container Stuffing Location Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter container stuffing location details:&#10;- Company name&#10;- Full address&#10;- City, State/Province&#10;- Country" 
                        className="min-h-[120px]"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* 10. Consolidator */}
          <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200">
            <CardHeader>
              <CardTitle className="text-purple-700 flex items-center">
                <Building2 className="w-5 h-5 mr-2" />
                10. Consolidator
              </CardTitle>
              <CardDescription>Entity that consolidated the container</CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="consolidatorStufferInfo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consolidator Information *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Enter consolidator details:&#10;- Company name&#10;- Full address&#10;- City, State/Province&#10;- Country&#10;- Contact information (optional)" 
                        className="min-h-[120px]"
                        {...field} 
                      />
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
                name="mblScacCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MBL SCAC Code</FormLabel>
                    <FormControl>
                      <Input placeholder="Master Bill of Lading SCAC Code" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="hblScacCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HBL SCAC Code</FormLabel>
                    <FormControl>
                      <Input placeholder="House Bill of Lading SCAC Code" {...field} />
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
                name="amsNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AMS No.</FormLabel>
                    <FormControl>
                      <Input placeholder="Automated Manifest System number" {...field} />
                    </FormControl>
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
        {(filings as IsfFiling[] || []).length === 0 ? (
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
                      <Link href={`/isf/detail/${filing.id}`}>
                        <Button variant="outline" size="sm">
                          View Details
                        </Button>
                      </Link>
                      {filing.status === "draft" && (
                        <Link href={`/isf/edit/${filing.id}`}>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                        </Link>
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