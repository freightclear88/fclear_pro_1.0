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

  // 4. Consignee Number (IRS/EIN/SSN/CBP number) 
  consigneeNumber: z.string().min(1, "Consignee Number is required"),

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

  // ISF document processing handler for the new upload component
  const handleIsfDocumentProcessing = async (files: File[]) => {
    if (!files.length) return;

    setUploadedFiles(files);
    setIsScanning(true);
    setProcessedDocuments([]);

    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append("isfDocuments", file);
      });

      const response = await fetch("/api/isf/scan-documents", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process documents");
      }

      const result = await response.json();
      
      // Handle the multi-document response with consolidated extracted data
      if (result.success && result.extractedData) {
        console.log("Consolidated data received:", result.extractedData);
        setProcessedDocuments(result.processedDocuments || []);
        
        // Map extracted data to form fields - comprehensive mapping for all extracted fields
        const fieldMapping: Record<string, string> = {
          vesselName: 'vesselName',
          voyageNumber: 'voyageNumber', 
          containerNumbers: 'containerNumbers',
          billOfLading: 'billOfLading',
          portOfEntry: 'portOfEntry',
          estimatedArrivalDate: 'estimatedArrivalDate',
          estimatedDepartureDate: 'estimatedDepartureDate',
          countryOfOrigin: 'countryOfOrigin',
          htsusNumber: 'htsusNumber',
          commodityDescription: 'commodityDescription',
          mblScacCode: 'mblScacCode',
          hblScacCode: 'hblScacCode',
          amsNumber: 'amsNumber',
          containerStuffingLocation: 'containerStuffingLocation',
          consolidatorStufferInfo: 'consolidatorStufferInfo',
          consolidator: 'consolidatorStufferInfo',
          consolidatorInformation: 'consolidatorStufferInfo',
          // Enhanced party information fields
          importerName: 'importerName',
          importerAddress: 'importerAddress',
          consigneeName: 'consigneeName',
          consigneeAddress: 'consigneeAddress',
          manufacturerInformation: 'manufacturerInformation',
          sellerInformation: 'sellerInformation',
          buyerInformation: 'buyerInformation',
          shipToPartyInformation: 'shipToPartyInformation',
          // Additional comprehensive fields from extraction
          foreignPortOfLading: 'foreignPortOfLading',
          bookingNumber: 'bookingReference',
          containerType: 'containerType',
          sealNumbers: 'sealNumbers',
          numberOfPackages: 'numberOfPackages',
          packageType: 'packageType',
          grossWeight: 'grossWeight',
          dateIssued: 'dateIssued',
          onBoardDate: 'onBoardDate',
          // Key fields from the log data that need mapping
          // manufacturerCountry: 'countryOfOrigin', // Commented out to prevent override of ISF country of origin
          portOfLoading: 'foreignPortOfLading',
          placeOfReceipt: 'foreignPortOfLading',
          placeOfDelivery: 'portOfEntry',
          // ISF-specific field mappings
          stuffingLocation: 'containerStuffingLocation',
          manufacture: 'manufacturerInformation',
          'ams b/l#': 'amsNumber',
          amsBl: 'amsNumber'
        };

        // Handle consolidated party information
        const data = result.extractedData;
        
        // Debug: Log all extracted field names to identify ISF-specific fields
        console.log('All extracted field names:', Object.keys(data));
        console.log('Looking for stuffing location fields...', {
          stuffingLocation: data.stuffingLocation,
          'container stuffing location': data['container stuffing location'],
          containerStuffingLocation: data.containerStuffingLocation,
          'stuffing location': data['stuffing location']
        });
        
        // CRITICAL: Handle ISF-specific fields FIRST before automatic mapping
        // Container Stuffing Location - check multiple possible field variations
        let stuffingLocationFound = false;
        const possibleStuffingFields = [
          'stuffingLocation',
          'stuffing location', 
          'container stuffing location',
          'containerStuffingLocation',
          'Container Stuffing Location',
          'CONTAINER STUFFING LOCATION'
        ];
        
        for (const fieldName of possibleStuffingFields) {
          if (data[fieldName] && !stuffingLocationFound) {
            form.setValue('containerStuffingLocation', data[fieldName], { shouldValidate: false, shouldDirty: true });
            console.log(`Set containerStuffingLocation from ISF field "${fieldName}":`, data[fieldName]);
            stuffingLocationFound = true;
            // Remove from automatic mapping to prevent override
            delete data[fieldName];
            break;
          }
        }
        
        // Handle ISF manufacture field
        if (data.manufacture) {
          form.setValue('manufacturerInformation', data.manufacture, { shouldValidate: false, shouldDirty: true });
          console.log('Set manufacturerInformation from ISF manufacture field:', data.manufacture);
          delete data.manufacture; // Prevent override by automatic mapping
        }
        
        // Handle AMS Number from ISF-specific field
        if (data['ams b/l#'] || data.amsBl) {
          const amsNumber = data['ams b/l#'] || data.amsBl;
          form.setValue('amsNumber', amsNumber, { shouldValidate: false, shouldDirty: true });
          console.log('Set amsNumber from ISF field:', amsNumber);
          delete data['ams b/l#'];
          delete data.amsBl;
        }
        
        // Handle individual company names first for importer/consignee
        if (data.importerName && data.importerName.trim()) {
          form.setValue('importerName', data.importerName.trim(), { shouldValidate: false, shouldDirty: true });
          console.log('Set importerName to:', data.importerName);
        }
        
        if (data.consigneeName && data.consigneeName.trim()) {
          form.setValue('consigneeName', data.consigneeName.trim(), { shouldValidate: false, shouldDirty: true });
          console.log('Set consigneeName to:', data.consigneeName);
        }
        
        // Handle consolidated addresses from comprehensive extraction
        if (data.shipperAddress && data.shipperName) {
          const shipperInfo = `${data.shipperName}\n${data.shipperAddress}`;
          form.setValue('sellerInformation', shipperInfo, { shouldValidate: false, shouldDirty: true });
          console.log('Set sellerInformation from shipper data:', shipperInfo);
        }
        
        if (data.consigneeAddress && data.consigneeName) {
          const consigneeInfo = `${data.consigneeName}\n${data.consigneeAddress}`;
          form.setValue('buyerInformation', consigneeInfo, { shouldValidate: false, shouldDirty: true });
          console.log('Set buyerInformation from consignee data:', consigneeInfo);
        }
        

        
        // Handle the new consolidated info fields from backend (fallback)
        if (data.sellerInfo && data.sellerInfo.trim()) {
          form.setValue('sellerInformation', data.sellerInfo);
          console.log('Set sellerInformation to:', data.sellerInfo);
        }
        
        if (data.buyerInfo && data.buyerInfo.trim()) {
          form.setValue('buyerInformation', data.buyerInfo);
          console.log('Set buyerInformation to:', data.buyerInfo);
        }
        
        if (data.manufacturerInfo && data.manufacturerInfo.trim()) {
          form.setValue('manufacturerInformation', data.manufacturerInfo);
          console.log('Set manufacturerInformation to:', data.manufacturerInfo);
        }
        
        // Build consolidated seller information (fallback for old format)
        if (!data.sellerInfo && (data.sellerName || data.sellerAddress || data.sellerCity || data.sellerCountry)) {
          const sellerParts = [];
          if (data.sellerName) sellerParts.push(data.sellerName);
          if (data.sellerAddress) sellerParts.push(data.sellerAddress);
          if (data.sellerCity && data.sellerCountry) sellerParts.push(`${data.sellerCity}, ${data.sellerCountry}`);
          else if (data.sellerCity) sellerParts.push(data.sellerCity);
          else if (data.sellerCountry) sellerParts.push(data.sellerCountry);
          
          if (sellerParts.length > 0) {
            form.setValue('sellerInformation', sellerParts.join('\n'));
            console.log('Set sellerInformation to:', sellerParts.join('\n'));
          }
        }

        // Build consolidated buyer information (fallback for old format)
        if (!data.buyerInfo && (data.buyerName || data.buyerAddress || data.buyerCity || data.buyerCountry)) {
          const buyerParts = [];
          if (data.buyerName) buyerParts.push(data.buyerName);
          if (data.buyerAddress) buyerParts.push(data.buyerAddress);
          if (data.buyerCity && data.buyerCountry) buyerParts.push(`${data.buyerCity}, ${data.buyerCountry}`);
          else if (data.buyerCity) buyerParts.push(data.buyerCity);
          else if (data.buyerCountry) buyerParts.push(data.buyerCountry);
          
          if (buyerParts.length > 0) {
            form.setValue('buyerInformation', buyerParts.join('\n'));
            console.log('Set buyerInformation to:', buyerParts.join('\n'));
          }
        }

        // Build consolidated manufacturer information (fallback for old format)
        if (!data.manufacturerInfo && (data.manufacturerName || data.manufacturerAddress || data.manufacturerCity || data.manufacturerCountry)) {
          const manufacturerParts = [];
          if (data.manufacturerName) manufacturerParts.push(data.manufacturerName);
          if (data.manufacturerAddress) manufacturerParts.push(data.manufacturerAddress);
          if (data.manufacturerCity && data.manufacturerCountry) manufacturerParts.push(`${data.manufacturerCity}, ${data.manufacturerCountry}`);
          else if (data.manufacturerCity) manufacturerParts.push(data.manufacturerCity);
          else if (data.manufacturerCountry) manufacturerParts.push(data.manufacturerCountry);
          
          if (manufacturerParts.length > 0) {
            form.setValue('manufacturerInformation', manufacturerParts.join('\n'));
            console.log('Set manufacturerInformation to:', manufacturerParts.join('\n'));
          }
        }

        // Build consolidated ship-to party information
        if (data.shipToPartyName || data.shipToPartyAddress || data.shipToPartyCity) {
          const shipToParts = [];
          if (data.shipToPartyName) shipToParts.push(data.shipToPartyName);
          if (data.shipToPartyAddress) shipToParts.push(data.shipToPartyAddress);
          if (data.shipToPartyCity) shipToParts.push(`${data.shipToPartyCity}, USA`);
          else shipToParts.push('USA');
          
          if (shipToParts.length > 0) {
            form.setValue('shipToPartyInformation', shipToParts.join('\n'));
            console.log('Set shipToPartyInformation to:', shipToParts.join('\n'));
          }
        }

        // Handle missing critical ISF fields BEFORE the automatic field mapping
        // Ship-to Party Information - use consignee data
        if (data.consigneeName && data.consigneeAddress) {
          const shipToInfo = `${data.consigneeName}\n${data.consigneeAddress}`;
          form.setValue('shipToPartyInformation', shipToInfo, { shouldValidate: false, shouldDirty: true });
          console.log('Set shipToPartyInformation from consignee:', shipToInfo);
        }

        // Fallback for container stuffing location if not set by ISF-specific fields
        if (!stuffingLocationFound && (data.portOfLoading || data.placeOfReceipt)) {
          const stuffingLocation = data.portOfLoading || data.placeOfReceipt;
          form.setValue('containerStuffingLocation', stuffingLocation, { shouldValidate: false, shouldDirty: true });
          console.log('Set containerStuffingLocation from port (fallback):', stuffingLocation);
        }

        // Consolidator information - use shipper as consolidator if available
        if (data.shipperName && data.shipperAddress) {
          const consolidatorInfo = `${data.shipperName}\n${data.shipperAddress}`;
          form.setValue('consolidatorStufferInfo', consolidatorInfo, { shouldValidate: false, shouldDirty: true });
          console.log('Set consolidatorStufferInfo from shipper:', consolidatorInfo);
        }

        // Handle SCAC Codes - extract from carrier/vessel information
        if (data.vesselName) {
          let scacCode = '';
          if (data.vesselName.includes('COSCO')) {
            scacCode = 'COSU';
          } else if (data.vesselName.includes('MAERSK')) {
            scacCode = 'MAEU';
          } else if (data.vesselName.includes('MSC')) {
            scacCode = 'MSCU';
          } else if (data.vesselName.includes('EVERGREEN')) {
            scacCode = 'EGLV';
          } else if (data.vesselName.includes('YANG MING')) {
            scacCode = 'YMLU';
          }
          
          if (scacCode) {
            form.setValue('mblScacCode', scacCode, { shouldValidate: false, shouldDirty: true });
            form.setValue('hblScacCode', scacCode, { shouldValidate: false, shouldDirty: true });
            console.log(`Set SCAC codes for ${data.vesselName}: ${scacCode}`);
          }
        }

        // Handle AMS Number from ISF-specific field
        if (data['ams b/l#'] || data.amsBl) {
          const amsNumber = data['ams b/l#'] || data.amsBl;
          form.setValue('amsNumber', amsNumber, { shouldValidate: false, shouldDirty: true });
          console.log('Set amsNumber from ISF field:', amsNumber);
        }

        // Store extracted data and populate form
        setExtractedData(result.extractedData);
        
        // Clear any placeholder text from required fields before populating
        const requiredFields = ['manufacturerInformation', 'sellerInformation', 'buyerInformation', 'shipToPartyInformation'];
        requiredFields.forEach(field => {
          const currentValue = form.getValues(field as keyof IsfFormData);
          if (currentValue && typeof currentValue === 'string' && currentValue.includes('Enter ')) {
            form.setValue(field as keyof IsfFormData, '', { shouldValidate: false, shouldDirty: true });
          }
        });
        
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

        // Handle separate container stuffing location and consolidator/stuffer info from extracted data
        
        // Build container stuffing location info
        if (!data.containerStuffingLocation && (data.containerStuffingCity || data.containerStuffingCountry)) {
          const locationInfo = [];
          if (data.containerStuffingLocation) locationInfo.push(data.containerStuffingLocation);
          if (data.containerStuffingCity) locationInfo.push(`City: ${data.containerStuffingCity}`);
          if (data.containerStuffingCountry) locationInfo.push(`Country: ${data.containerStuffingCountry}`);
          
          if (locationInfo.length > 0) {
            form.setValue("containerStuffingLocation", locationInfo.join('\n'));
            console.log('Set containerStuffingLocation to:', locationInfo.join('\n'));
          }
        }
        
        // Build consolidator info
        if (!data.consolidatorStufferInfo && (data.consolidatorName || data.consolidatorAddress)) {
          const consolidatorInfo = [];
          if (data.consolidatorName) consolidatorInfo.push(`Company: ${data.consolidatorName}`);
          if (data.consolidatorAddress) consolidatorInfo.push(`Address: ${data.consolidatorAddress}`);
          if (data.consolidatorCity) consolidatorInfo.push(`City: ${data.consolidatorCity}`);
          if (data.consolidatorCountry) consolidatorInfo.push(`Country: ${data.consolidatorCountry}`);
          
          if (consolidatorInfo.length > 0) {
            form.setValue("consolidatorStufferInfo", consolidatorInfo.join('\n'));
            console.log('Set consolidatorStufferInfo to:', consolidatorInfo.join('\n'));
          }
        }
        
        // Note: Country of origin should use the value from the ISF document as provided
        
        // Force form re-render and clear validation errors
        setTimeout(() => {
          console.log("Form values after population:", form.getValues());
          form.clearErrors(); // Clear validation errors to allow manual entry
          form.trigger(); // Trigger validation to update the form state
          
          // Force re-render
          setIsScanning(false);
        }, 200);

        toast({
          title: "Documents Processed Successfully",
          description: `Processed ${files.length} document(s) and extracted ${result.consolidatedFields} ISF fields. Review and complete any missing information.`,
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