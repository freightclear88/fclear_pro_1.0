import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ArrowLeft, Save, CreditCard, FileText, Building2, Truck, Package, DollarSign } from "lucide-react";
import { Link } from "wouter";

// ISF Form Schema (same as fastisf.tsx but with optional fields for editing)
const isfEditSchema = z.object({
  // Required elements but can be TBD during editing
  sellerInformation: z.string().min(1, "Seller information is required"),
  buyerInformation: z.string().min(1, "Buyer information is required"),

  importerOfRecord: z.string().min(1, "Importer of Record Number is required"),
  consigneeNumber: z.string().min(1, "Consignee Number is required"),

  manufacturerInformation: z.string().min(1, "Manufacturer/Supplier information is required"),
  shipToPartyInformation: z.string().min(1, "Ship-to party information is required"),

  countryOfOrigin: z.string().min(1, "Country of origin is required"),
  htsusNumber: z.string().min(10, "HTS number must be 10 digits").max(10, "HTS number must be exactly 10 digits"),



  bookingPartyName: z.string().min(1, "Booking party name is required"),
  bookingPartyAddress: z.string().min(1, "Booking party address is required"),
  bookingPartyCity: z.string().min(1, "Booking party city is required"),
  bookingPartyCountry: z.string().min(1, "Booking party country is required"),

  // Additional fields
  billOfLading: z.string().optional(),
  vesselName: z.string().optional(),
  voyageNumber: z.string().optional(),
  portOfEntry: z.string().min(1, "Port of entry is required"),
  foreignPortOfUnlading: z.string().min(1, "Foreign port of unlading is required"),
  estimatedArrivalDate: z.string().optional(),
  containerNumbers: z.string().optional(),
  commodityDescription: z.string().min(1, "Commodity description is required"),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  invoiceValue: z.string().optional(),
  currency: z.string().default("USD"),
  terms: z.string().optional(),

  // Additional party information
  importerName: z.string().min(1, "Importer name is required"),
  importerAddress: z.string().min(1, "Importer address is required"),
  importerCity: z.string().min(1, "Importer city is required"),
  importerState: z.string().min(1, "Importer state is required"),
  importerZip: z.string().min(1, "Importer ZIP is required"),
  importerCountry: z.string().default("US"),

  consigneeName: z.string().min(1, "Consignee name is required"),
  consigneeAddress: z.string().min(1, "Consignee address is required"),
  consigneeCity: z.string().min(1, "Consignee city is required"),
  consigneeState: z.string().min(1, "Consignee state is required"),
  consigneeZip: z.string().min(1, "Consignee ZIP is required"),
  consigneeCountry: z.string().default("US"),

  // Container Stuffing Location & Consolidator (Separate)
  containerStuffingLocation: z.string().optional(),
  consolidatorStufferInfo: z.string().optional(),
  mblScacCode: z.string().optional(),
  hblScacCode: z.string().optional(),
  amsNumber: z.string().optional(),
});

type IsfEditFormData = z.infer<typeof isfEditSchema>;

// US States and Countries
const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY"
];

const COUNTRIES = [
  "China", "Mexico", "Canada", "Germany", "Japan", "United Kingdom", 
  "South Korea", "India", "Taiwan", "Vietnam", "Thailand", "Malaysia", 
  "Singapore", "Philippines", "Indonesia", "Brazil", "Italy", "France",
  "Netherlands", "Belgium", "Spain", "Turkey", "Israel", "Other"
];

const US_PORTS = [
  "Los Angeles, CA", "Long Beach, CA", "New York/New Jersey", "Savannah, GA",
  "Houston, TX", "Norfolk, VA", "Oakland, CA", "Charleston, SC", "Miami, FL",
  "Tacoma, WA", "Boston, MA", "Baltimore, MD", "Seattle, WA", "Port Everglades, FL"
];

export default function IsfEdit() {
  const [, params] = useRoute("/isf/edit/:id");
  const isfId = params?.id;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch ISF filing data
  const { data: isfFiling, isLoading } = useQuery({
    queryKey: ["/api/isf/filings", isfId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/isf/filings/${isfId}`);
      return response.json();
    },
    enabled: !!isfId,
  });

  const form = useForm<IsfEditFormData>({
    resolver: zodResolver(isfEditSchema),
    defaultValues: {
      importerCountry: "US",
      consigneeCountry: "US",
      shipToPartyCountry: "US",
      buyerCountry: "US",
      currency: "USD",
    },
  });

  // Populate form when ISF data loads
  useEffect(() => {
    if (isfFiling) {
      // Map ISF filing data to form fields
      const formData: Partial<IsfEditFormData> = {
        sellerInformation: isfFiling.sellerInformation || "Enter seller company name\nStreet Address\nCity, State\nCountry",
        buyerInformation: isfFiling.buyerInformation || "Enter buyer company name\nStreet Address\nCity, State ZIP\nCountry",
        importerOfRecord: isfFiling.importerOfRecord || "Enter IRS/EIN number",
        consigneeNumber: isfFiling.consigneeNumber || "Enter consignee IRS/EIN number",
        manufacturerInformation: isfFiling.manufacturerInformation || "Enter manufacturer/supplier name\nStreet Address\nCity, State\nCountry",
        shipToPartyInformation: isfFiling.shipToPartyInformation || "Enter ship-to party name\nStreet Address\nCity, State ZIP\nUSA",

        countryOfOrigin: isfFiling.countryOfOrigin || "TBD",
        htsusNumber: isfFiling.htsusNumber || "0000000000",

        containerStuffingLocation: isfFiling.containerStuffingLocation || "TBD",
        consolidatorStufferInfo: isfFiling.consolidatorStufferInfo || "TBD",
        mblScacCode: isfFiling.mblScacCode || "",
        hblScacCode: isfFiling.hblScacCode || "",
        amsNumber: isfFiling.amsNumber || "",

        bookingPartyName: isfFiling.bookingPartyName || "TBD",
        bookingPartyAddress: isfFiling.bookingPartyAddress || "TBD",
        bookingPartyCity: isfFiling.bookingPartyCity || "TBD",
        bookingPartyCountry: isfFiling.bookingPartyCountry || "TBD",

        billOfLading: isfFiling.billOfLading || "",
        vesselName: isfFiling.vesselName || "",
        voyageNumber: isfFiling.voyageNumber || "",
        portOfEntry: isfFiling.portOfEntry || "TBD",
        foreignPortOfUnlading: isfFiling.foreignPortOfUnlading || "TBD",
        estimatedArrivalDate: isfFiling.estimatedArrivalDate ? new Date(isfFiling.estimatedArrivalDate).toISOString().split('T')[0] : "",
        containerNumbers: isfFiling.containerNumbers || "",
        commodityDescription: isfFiling.commodityDescription || "TBD",
        invoiceNumber: isfFiling.invoiceNumber || "",
        invoiceDate: isfFiling.invoiceDate ? new Date(isfFiling.invoiceDate).toISOString().split('T')[0] : "",
        invoiceValue: isfFiling.invoiceValue?.toString() || "",
        currency: isfFiling.currency || "USD",
        terms: isfFiling.terms || "",

        importerName: isfFiling.importerName || "TBD",
        importerAddress: isfFiling.importerAddress || "TBD",
        importerCity: isfFiling.importerCity || "TBD",
        importerState: isfFiling.importerState || "",
        importerZip: isfFiling.importerZip || "",
        importerCountry: isfFiling.importerCountry || "US",

        consigneeName: isfFiling.consigneeName || "TBD",
        consigneeAddress: isfFiling.consigneeAddress || "TBD",
        consigneeCity: isfFiling.consigneeCity || "TBD",
        consigneeState: isfFiling.consigneeState || "",
        consigneeZip: isfFiling.consigneeZip || "",
        consigneeCountry: isfFiling.consigneeCountry || "US",



      };

      // Reset form with ISF data
      form.reset(formData);
    }
  }, [isfFiling, form]);

  // Save/Update ISF filing
  const updateMutation = useMutation({
    mutationFn: async (data: IsfEditFormData) => {
      const response = await apiRequest("PUT", `/api/isf/filings/${isfId}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "ISF Filing Updated",
        description: "Your changes have been saved successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/isf/filings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update ISF filing",
        variant: "destructive",
      });
    },
  });

  // Submit ISF for processing
  const submitMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/isf/filings/${isfId}/submit`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "ISF Filing Submitted",
        description: "Your ISF filing has been submitted for processing. Proceed to payment.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/isf/filings"] });
    },
    onError: (error: any) => {
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit ISF filing",
        variant: "destructive",
      });
    },
  });

  const onSave = (data: IsfEditFormData) => {
    updateMutation.mutate(data);
  };

  const onSubmit = () => {
    // First save current form data, then submit
    const formData = form.getValues();
    updateMutation.mutate(formData, {
      onSuccess: () => {
        submitMutation.mutate();
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isfFiling) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">ISF Filing Not Found</h1>
          <Link href="/fastisf">
            <Button>Back to ISF Filings</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/fastisf">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to ISF Filings
              </Button>
            </Link>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
                Edit ISF Filing
              </h1>
              <p className="text-lg text-gray-600 mt-2">
                ISF #{isfFiling.isfNumber} - Status: {isfFiling.status}
              </p>
            </div>
          </div>
          <div className="flex space-x-3">
            <Button 
              onClick={() => onSave(form.getValues())}
              disabled={updateMutation.isPending}
              variant="outline"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
            <Button 
              onClick={onSubmit}
              disabled={updateMutation.isPending || submitMutation.isPending}
              className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700"
            >
              <CreditCard className="w-4 h-4 mr-2" />
              Submit & Pay ($35.00)
            </Button>
          </div>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-8">
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

            {/* 3. Manufacturer/Supplier Information */}
            <Card className="bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200">
              <CardHeader>
                <CardTitle className="text-orange-700 flex items-center">
                  <Building2 className="w-5 h-5 mr-2" />
                  3. Manufacturer/Supplier Information
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

            {/* 4. Ship-to Party Information */}
            <Card className="bg-gradient-to-r from-teal-50 to-cyan-50 border-teal-200">
              <CardHeader>
                <CardTitle className="text-teal-700 flex items-center">
                  <Building2 className="w-5 h-5 mr-2" />
                  4. Ship-to Party Information
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

            {/* Submit Section */}
            <div className="flex justify-end space-x-4 pt-6">
              <Button 
                type="button"
                onClick={() => onSave(form.getValues())}
                disabled={updateMutation.isPending}
                variant="outline"
                size="lg"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button 
                type="button"
                onClick={onSubmit}
                disabled={updateMutation.isPending || submitMutation.isPending}
                size="lg"
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white px-8 py-3"
              >
                {submitMutation.isPending ? (
                  <>Processing...</>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Submit ISF & Proceed to Payment ($35.00)
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}