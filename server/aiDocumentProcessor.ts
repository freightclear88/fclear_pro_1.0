import OpenAI from "openai";
import { DocumentAnalysisClient, AzureKeyCredential } from "@azure/ai-form-recognizer";
import fs from 'fs';
import pdf2pic from 'pdf2pic';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Azure Document Intelligence client
const azureClient = new DocumentAnalysisClient(
  process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT!,
  new AzureKeyCredential(process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY!)
);

interface ExtractedShipmentData {
  // Core shipping data
  billOfLadingNumber?: string;
  airWaybillNumber?: string;
  vesselAndVoyage?: string;
  containerNumber?: string;
  containerType?: string;
  sealNumbers?: string[];
  
  // Location information
  portOfLoading?: string;
  portOfDischarge?: string;
  placeOfReceipt?: string;
  placeOfDelivery?: string;
  
  // Shipper information
  shipperName?: string;
  shipperAddress?: string;
  shipperCity?: string;
  shipperState?: string;
  shipperZipCode?: string;
  shipperCountry?: string;
  shipperContactPerson?: string;
  shipperPhone?: string;
  shipperEmail?: string;
  
  // Consignee information - CRITICAL for ISF field #4
  consigneeName?: string;
  consigneeAddress?: string;
  consigneeCity?: string;
  consigneeState?: string;
  consigneeZipCode?: string;
  consigneeCountry?: string;
  consigneeInformation?: string; // Complete consolidated consignee information
  consigneeCompany?: string; // Company name specifically
  consigneeContact?: string; // Contact details
  deliverTo?: string; // Alternative consignee field name
  recipient?: string; // Recipient information
  consigneeContactPerson?: string;
  consigneePhone?: string;
  consigneeEmail?: string;
  
  // Notify party information
  notifyPartyName?: string;
  notifyPartyAddress?: string;
  notifyPartyCity?: string;
  notifyPartyState?: string;
  notifyPartyZipCode?: string;
  notifyPartyCountry?: string;
  notifyPartyContactPerson?: string;
  notifyPartyPhone?: string;
  notifyPartyEmail?: string;
  
  // Cargo information
  cargoDescription?: string;
  numberOfPackages?: number;
  packageType?: string;
  weight?: string;
  grossWeight?: number;
  measurement?: string;
  marks?: string;
  commodity?: string;
  htsCode?: string;
  countryOfOrigin?: string;
  value?: string;
  currency?: string;
  
  // Dates and other information
  dateIssued?: string;
  eta?: string;
  onBoardDate?: string;
  freightPrepaid?: boolean;
  freightCollect?: boolean;
  bookingNumber?: string;
  
  // Container stuffing fields
  containerStuffingLocation?: string;
  containerStuffing?: string;
  stuffingLocation?: string;
  
  // AMS and consolidator fields - CRITICAL for ISF
  amsNumber?: string;
  consolidator?: string;
  consolidatorName?: string;
  consolidatorInformation?: string;
  consolidatorStufferInfo?: string;
  containerStuffer?: string;
  stufferName?: string;
  cfsOperator?: string;
  cfsFacility?: string;
  
  // ISF-specific fields
  shipToPartyInformation?: string;
  hblScacCode?: string;
  mblScacCode?: string;
  sellerInformation?: string;
  manufacturerInformation?: string;
  manufacturerName?: string;
  manufacturerAddress?: string;
  manufacturerCountry?: string;
  sellerName?: string;
  sellerAddress?: string;
  buyerName?: string;
  buyerAddress?: string;
}

export class AIDocumentProcessor {
  
  /**
   * Enhance Azure results with ISF-specific extraction for ISF documents
   */
  async enhanceWithISFExtraction(filePath: string, azureResult: any, documentType: string): Promise<any> {
    try {
      console.log('🎯 STARTING ISF-SPECIFIC ENHANCEMENT...');
      
      // Extract document text for ISF processing (support both PDF and DOCX)
      let documentText = '';
      try {
        // Try PDF extraction first
        if (filePath.toLowerCase().endsWith('.pdf')) {
          documentText = await this.extractPDFText(filePath);
          console.log(`🔍 Extracted ${documentText.length} characters from PDF for ISF analysis`);
        } else {
          // For DOCX and other formats, use Azure Document Intelligence
          console.log('🔍 Using Azure Document Intelligence for DOCX text extraction...');
          const documentBuffer = fs.readFileSync(filePath);
          const poller = await azureClient.beginAnalyzeDocument("prebuilt-document", documentBuffer);
          const result = await poller.pollUntilDone();
          documentText = result.content || '';
          console.log(`🔍 Extracted ${documentText.length} characters from DOCX for ISF analysis`);
        }
        
        if (documentText.length < 50) {
          console.log('Insufficient text extracted for ISF enhancement');
          return azureResult;
        }
      } catch (error) {
        console.log('Document text extraction failed for ISF enhancement:', error);
        return azureResult;
      }

      console.log(`📄 Document Text Preview (first 500 chars): ${documentText.substring(0, 500)}`);
      
      // Run ISF-specific extraction
      const isfCompletion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are an expert ISF (Importer Security Filing) document processor. Extract data from ISF Information Sheets by reading the field labels and their corresponding values exactly as written. 

CRITICAL INSTRUCTIONS:
- Find each field label and extract the COMPLETE text that appears after or below it
- For multi-line addresses, capture ALL lines, not just the first one
- Never use placeholder text like "Same as Consignee" - extract the actual data written
- For SCAC codes, extract the exact 4-letter code shown

Required JSON structure with these exact field names:
{
  "containerStuffingLocation": "Complete address from Container Stuffing Location field (all lines)",
  "shipToParty": "Complete company name and address from Ship To Party field (NOT 'Same as Consignee')",
  "hblScacCode": "4-letter code from HBL SCAC field",
  "mblScacCode": "4-letter code from MBL SCAC field", 
  "seller": "Complete seller company name and address (actual manufacturer/seller, NOT logistics)",
  "manufacturer": "Complete manufacturer company name and address",
  "consignee": "Complete consignee company name and address"
}

If a field label is not found or has no data, use null. Extract ONLY the exact text that appears in the document.`
          },
          {
            role: "user", 
            content: `Extract ISF field data from this document text. Pay attention to field labels and extract the complete text that appears after each label:\n\n${documentText}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1
      });

      let isfData: any = {};
      try {
        const rawResponse = isfCompletion.choices[0].message.content || '{}';
        console.log('🎯 RAW ISF EXTRACTION RESPONSE:', rawResponse);
        isfData = JSON.parse(rawResponse);
        console.log('🎯 PARSED ISF-SPECIFIC EXTRACTION RESULT:', JSON.stringify(isfData, null, 2));
        
        // Merge ISF-specific data with Azure results (ISF data takes priority)
        const enhancedResult = { ...azureResult };
        
        if (isfData.containerStuffingLocation) {
          enhancedResult.containerStuffingLocation = isfData.containerStuffingLocation;
          console.log(`🎯 ISF Override - Container Stuffing Location: ${isfData.containerStuffingLocation}`);
        }
        
        if (isfData.shipToParty && !isfData.shipToParty.toLowerCase().includes('same as consignee')) {
          enhancedResult.shipToPartyInformation = isfData.shipToParty;
          console.log(`🎯 ISF Override - Ship To Party: ${isfData.shipToParty}`);
        }
        
        if (isfData.hblScacCode) {
          enhancedResult.hblScacCode = isfData.hblScacCode;
          console.log(`🎯 ISF Override - HBL SCAC Code: ${isfData.hblScacCode}`);
        }
        
        if (isfData.mblScacCode) {
          enhancedResult.mblScacCode = isfData.mblScacCode;
          console.log(`🎯 ISF Override - MBL SCAC Code: ${isfData.mblScacCode}`);
        }
        
        // Use the actual seller information from the ISF document as provided
        if (isfData.seller) {
          enhancedResult.sellerInformation = isfData.seller;
          enhancedResult.sellerName = isfData.seller.split('\n')[0];
          enhancedResult.sellerAddress = isfData.seller.split('\n').slice(1).join('\n');
          console.log(`🎯 ISF Override - Seller (as provided in ISF): ${isfData.seller}`);
        }
        
        if (isfData.manufacturer) {
          enhancedResult.manufacturerInformation = isfData.manufacturer;
          enhancedResult.manufacturerName = isfData.manufacturer.split('\n')[0];
          enhancedResult.manufacturerAddress = isfData.manufacturer.split('\n').slice(1).join('\n');
          console.log(`🎯 ISF Override - Manufacturer: ${isfData.manufacturer}`);
        }
        
        console.log('✅ ISF ENHANCEMENT COMPLETE');
        return enhancedResult;
        
      } catch (parseError) {
        console.error('Failed to parse ISF extraction JSON:', parseError);
        return azureResult;
      }
      
    } catch (error) {
      console.error('ISF enhancement failed:', error);
      return azureResult;
    }
  }

  /**
   * Test OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      // Test OpenAI connection with a simple completion
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: "test" }],
        max_tokens: 5,
      });
      return !!response.choices[0]?.message?.content;
    } catch (error) {
      console.error('OpenAI connection test failed:', error);
      return false;
    }
  }
  
  /**
   * Extract structured data from PDF document using Azure + AI
   */
  async extractShipmentData(filePath: string, documentType: string): Promise<ExtractedShipmentData> {
    console.log(`🚀 EXTRACTION START: Document type "${documentType}" at ${filePath}`);
    
    // CRITICAL DEBUG: Check if this is an ISF document right at the start
    const isISFDocument = documentType === 'isf_information_sheet' || documentType === 'isf information sheet' || documentType.toLowerCase().includes('isf');
    console.log(`🔍 IMMEDIATE ISF CHECK: documentType="${documentType}", isISFDocument=${isISFDocument}`);
    console.log(`🔍 ISF CHECK BREAKDOWN: exact match isf_information_sheet=${documentType === 'isf_information_sheet'}, exact match isf information sheet=${documentType === 'isf information sheet'}, includes isf=${documentType.toLowerCase().includes('isf')}`);
    try {
      // Try Azure Document Intelligence first (better for structured documents)
      try {
        console.log('Using Azure Document Intelligence for document processing...');
        const azureResult = await this.extractWithAzure(filePath);
        
        console.log('🔍 AZURE EXTRACTION RESULT:', Object.keys(azureResult || {}));
        console.log('🔍 AZURE SIGNIFICANT DATA CHECK...');
        const hasSignificant = this.hasSignificantData(azureResult);
        console.log(`🔍 AZURE SIGNIFICANT DATA: ${hasSignificant}`);
        
        if (hasSignificant) {
          console.log('Azure extraction successful, using Azure data');
          console.log(`🔍 AZURE DOCUMENT TYPE CHECK: "${documentType}"`);
          
          // DISABLED: ISF enhancement was causing issues, using standard Azure extraction only
          console.log(`🔍 USING STANDARD AZURE EXTRACTION for documentType="${documentType}"`);
          
          // Skip ISF enhancement entirely - use standard Azure results
          /*
          const isISFDocument = documentType === 'isf_information_sheet' || documentType === 'isf information sheet' || documentType.toLowerCase().includes('isf');
          if (isISFDocument) {
            const enhancedResult = await this.enhanceWithISFExtraction(filePath, azureResult, documentType);
            return enhancedResult;
          }
          */
          
          return azureResult;
        } else {
          console.log('Azure extraction yielded minimal data, trying OpenAI enhancement...');
          console.log('🔍 AZURE FAILED SIGNIFICANCE TEST - falling back to OpenAI');
          
          // For ISF documents, still try to enhance even if Azure extraction failed
          const isISFDocument = documentType === 'isf_information_sheet' || documentType === 'isf information sheet' || documentType.toLowerCase().includes('isf');
          console.log(`🔍 ISF CHECK DURING FALLBACK: documentType="${documentType}", isISFDocument=${isISFDocument}`);
          
          if (isISFDocument) {
            console.log('🎯 ISF DOCUMENT DETECTED DURING FALLBACK: Will enhance OpenAI results with ISF-specific extraction...');
            // Get basic OpenAI extraction first
            const openaiResult = await this.extractComprehensiveData(await this.extractPDFText(filePath));
            console.log('🔍 OPENAI RESULT BEFORE ISF ENHANCEMENT:', Object.keys(openaiResult || {}));
            
            // Then enhance with ISF-specific logic
            const enhancedResult = await this.enhanceWithISFExtraction(filePath, openaiResult, documentType);
            console.log('🎯 ISF ENHANCEMENT COMPLETE FROM FALLBACK: Returning enhanced results');
            console.log('🔍 ENHANCED RESULT FIELDS FROM FALLBACK:', Object.keys(enhancedResult || {}));
            return enhancedResult;
          }
        }
      } catch (azureError: any) {
        console.log('Azure processing failed, falling back to OpenAI:', azureError.message);
        
        // For ISF documents, still try to enhance even if Azure completely failed
        const isISFDocument = documentType === 'isf_information_sheet' || documentType === 'isf information sheet' || documentType.toLowerCase().includes('isf');
        console.log(`🔍 ISF CHECK DURING AZURE FAILURE: documentType="${documentType}", isISFDocument=${isISFDocument}`);
        
        if (isISFDocument) {
          console.log('🎯 ISF DOCUMENT DETECTED DURING AZURE FAILURE: Will enhance OpenAI results with ISF-specific extraction...');
          try {
            // Get basic OpenAI extraction first - support both PDF and DOCX
            let documentText = '';
            if (filePath.toLowerCase().endsWith('.pdf')) {
              documentText = await this.extractPDFText(filePath);
            } else {
              // For DOCX files, use Azure to get text first
              const documentBuffer = fs.readFileSync(filePath);
              const poller = await azureClient.beginAnalyzeDocument("prebuilt-document", documentBuffer);
              const result = await poller.pollUntilDone();
              documentText = result.content || '';
            }
            const openaiResult = await this.extractComprehensiveData(documentText);
            console.log('🔍 OPENAI RESULT BEFORE ISF ENHANCEMENT (AZURE FAILED):', Object.keys(openaiResult || {}));
            
            // Then enhance with ISF-specific logic
            const enhancedResult = await this.enhanceWithISFExtraction(filePath, openaiResult, documentType);
            console.log('🎯 ISF ENHANCEMENT COMPLETE FROM AZURE FAILURE: Returning enhanced results');
            console.log('🔍 ENHANCED RESULT FIELDS FROM AZURE FAILURE:', Object.keys(enhancedResult || {}));
            return enhancedResult;
          } catch (isfError) {
            console.log('ISF enhancement failed during Azure failure, continuing with normal OpenAI processing:', isfError);
          }
        }
      }

      // Fallback to OpenAI processing
      console.log('Testing OpenAI connection...');
      const connectionTest = await this.testConnection();
      if (!connectionTest) {
        throw new Error('OpenAI connection failed');
      }
      console.log('OpenAI connection successful');

      // Try to extract text from document (support both PDF and DOCX)
      let documentText = '';
      let useImageAnalysis = false;
      
      try {
        if (filePath.toLowerCase().endsWith('.pdf')) {
          documentText = await this.extractPDFText(filePath);
          console.log(`Extracted ${documentText.length} characters from PDF`);
        } else {
          // For DOCX files, use Azure Document Intelligence
          console.log('🔍 Using Azure for DOCX text extraction in fallback...');
          const documentBuffer = fs.readFileSync(filePath);
          const poller = await azureClient.beginAnalyzeDocument("prebuilt-document", documentBuffer);
          const result = await poller.pollUntilDone();
          documentText = result.content || '';
          console.log(`Extracted ${documentText.length} characters from DOCX`);
        }
      } catch (extractionError) {
        console.log('Document text extraction failed, using direct file analysis');
        useImageAnalysis = true;
        // Use filename and file metadata for AI analysis
        const fileName = filePath.split('/').pop() || '';
        const stats = fs.statSync(filePath);
        documentText = `Document: ${fileName}\nFile size: ${stats.size} bytes\nDocument type: ${documentType}\nThis document requires analysis for shipping data extraction.`;
      }

      if (!documentText || documentText.length < 10) {
        throw new Error('Unable to extract sufficient content from document');
      }

      console.log(`Sending ${documentText.length} characters to AI for analysis`);

      // Enhanced ISF-specific extraction for ISF Information Sheets
      const isISFDocument = documentType === 'isf_information_sheet' || documentType === 'isf information sheet' || documentType.toLowerCase().includes('isf');
      console.log(`🔍 DOCUMENT TYPE CHECK: "${documentType}" - ISF extraction triggered: ${isISFDocument}`);
      
      if (isISFDocument) {
        console.log('🎯 SPECIALIZED ISF EXTRACTION: Processing ISF Information Sheet with targeted field extraction');
        console.log(`📄 Document Text Preview (first 500 chars): ${documentText.substring(0, 500)}`);
        
        // Add specific pattern checks to debug the extraction
        console.log('🔍 Looking for ISF field patterns in document...');
        const hasContainerStuffing = /container\s*stuffing\s*location/i.test(documentText);
        const hasShipToParty = /ship\s*to\s*party/i.test(documentText);
        const hasHblScac = /hbl\s*scac/i.test(documentText);
        const hasMblScac = /mbl\s*scac/i.test(documentText);
        
        console.log(`Pattern checks - Container Stuffing: ${hasContainerStuffing}, Ship To Party: ${hasShipToParty}, HBL SCAC: ${hasHblScac}, MBL SCAC: ${hasMblScac}`);
        
        // Show a sample of the document text to understand what OpenAI is working with
        console.log('🔍 DOCUMENT TEXT SAMPLE FOR ISF EXTRACTION (first 3000 chars):');
        console.log(documentText.substring(0, 3000));
        console.log('🔍 END DOCUMENT TEXT SAMPLE');
        
        const isfCompletion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: `You are an expert ISF (Importer Security Filing) document processor. Extract data from ISF Information Sheets by reading the NUMBERED field labels and their corresponding values exactly as written. 

CRITICAL INSTRUCTIONS FOR ISF DOCUMENT EXTRACTION:
- Seller = The actual company that sold the goods (often the manufacturer or trading company)
- Consolidator = The logistics/freight forwarding company that consolidated the shipment
- These are DIFFERENT companies - identify them by their business type and context
- Look for seller information near manufacturer, supplier, or vendor sections
- Look for consolidator information near freight forwarder, logistics, or consolidation sections
- Extract complete addresses including all address lines
- Distinguish between actual manufacturers/sellers vs logistics service providers

Required JSON structure with these exact field names:
{
  "manufacturerInformation": "Complete manufacturer/supplier information",
  "sellerInformation": "Complete seller information (actual seller of goods, NOT logistics company)", 
  "buyerInformation": "Complete buyer information", 
  "shipToPartyInformation": "Complete ship-to party information",
  "containerStuffingLocation": "Complete container stuffing address",
  "consolidatorStufferInfo": "Complete consolidator/freight forwarder information",
  "hblScacCode": "4-letter House SCAC code",
  "mblScacCode": "4-letter Master SCAC code",
  "countryOfOrigin": "Country of origin"
}

If a field label is not found or has no data, use null. Extract ONLY the exact text that appears after each numbered field in the ISF document.`
            },
            {
              role: "user", 
              content: `Extract ISF field data from this document text. Identify companies by their business type:

CRITICAL: Distinguish between business types:
- Seller = Manufacturing, trading, or supplier company (actual seller of goods)
- Consolidator = Logistics, freight forwarding, or shipping company (consolidation service provider)

Look for seller information near: manufacturer, supplier, vendor, trading company sections
Look for consolidator information near: freight forwarder, logistics, consolidation, shipping agent sections

Document text:
${documentText}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        });

        let isfData: any = {};
        try {
          isfData = JSON.parse(isfCompletion.choices[0].message.content || '{}');
          console.log('🎯 ISF-SPECIFIC EXTRACTION RESULT:', isfData);
          console.log('🔍 ISF EXTRACTION DETAILS:');
          console.log(`  containerStuffingLocation: "${isfData.containerStuffingLocation}"`);
          console.log(`  shipToParty: "${isfData.shipToParty}"`);
          console.log(`  hblScacCode: "${isfData.hblScacCode}"`);
          console.log(`  mblScacCode: "${isfData.mblScacCode}"`);
          console.log(`  seller: "${isfData.seller}"`);
          console.log(`  manufacturer: "${isfData.manufacturer}"`);
          console.log(`  consignee: "${isfData.consignee}"`);
          
          // Process ISF-specific data and merge with main extraction
          if (isfData) {
            console.log('🔧 Processing ISF-specific field data...');
            
            // Store ISF data for later merging
            (global as any).isfSpecificData = isfData;
          }
        } catch (error) {
          console.error('Failed to parse ISF extraction JSON:', error);
        }

        // Use standard extraction as fallback
        console.log('🔄 Running standard extraction as backup...');
      }

      // Use OpenAI to extract comprehensive shipping data
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Extract comprehensive shipping data from Ocean Bill of Lading, ISF Information Sheets, commercial invoices, and related shipping documents. If this is an ISF Information Sheet document, prioritize extracting ALL ISF-specific fields with their exact values. Return JSON with all found values:
            {
              "billOfLadingNumber": "B/L or Master B/L number if found",
              "airWaybillNumber": "AWB number for air shipments if found",
              "vesselAndVoyage": "vessel name and voyage number combined if found",
              "vesselName": "vessel name only if found separately",
              "voyageNumber": "voyage number only if found separately",
              "containerNumber": "container number if found",
              "containerType": "container type (e.g., 40HC, 20GP, 45HQ) if found",
              "sealNumbers": ["seal numbers array if found"],
              "portOfLoading": "port of loading/origin port if found",
              "portOfDischarge": "port of discharge/destination port if found",
              "foreignPortOfLading": "foreign port of lading if found",
              "portOfEntry": "US port of entry/first arrival port if found",
              "placeOfReceipt": "place of receipt if found",
              "placeOfDelivery": "place of delivery/final destination if found",
              "shipperName": "shipper/exporter company name if found",
              "shipperAddress": "shipper complete address with country if found",
              "shipperCity": "shipper city if found",
              "shipperCountry": "shipper country if found",
              "consigneeName": "consignee/importer company name if found - CRITICAL for ISF field #4",
              "consigneeAddress": "consignee complete address if found - CRITICAL for ISF field #4",
              "consigneeCity": "consignee city if found - CRITICAL for ISF field #4",
              "consigneeState": "consignee state if found - CRITICAL for ISF field #4",
              "consigneeCountry": "consignee country if found - CRITICAL for ISF field #4",
              "consigneeInformation": "COMPLETE consolidated consignee information with company name, full address, city, state, country - look for 'CONSIGNEE', 'DELIVER TO', 'SHIP TO', 'RECEIVER', 'RECIPIENT' sections - CRITICAL for ISF field #4",
              "consigneeCompany": "consignee company name specifically if found separately",
              "consigneeContact": "consignee contact person and details if found",
              "deliverTo": "deliver to party information if found (alternative consignee field)",
              "recipient": "recipient information if found (alternative consignee field)",
              "importerName": "importer of record name if found (may be same as consignee)",
              "importerAddress": "importer of record address if found",
              "manufacturerName": "CRITICAL for ISF: Manufacturer/supplier company name - look for 'MANUFACTURER', 'SUPPLIER', 'FACTORY', 'MILL', 'PRODUCER' fields. This is the company that actually MADE the goods, NOT the logistics company or shipper",
              "manufacturerAddress": "CRITICAL for ISF: Manufacturer complete address with country - the physical location where goods were manufactured",
              "manufacturerCountry": "CRITICAL for ISF: Country where goods were manufactured - look for 'COUNTRY OF MANUFACTURE', 'MADE IN', 'ORIGIN COUNTRY'",
              "manufacturerInformation": "CRITICAL for ISF: Complete manufacturer information including name and address of the actual goods manufacturer",
              "buyerName": "Buyer/purchaser company name if found - the entity purchasing the goods",
              "buyerAddress": "Buyer complete address if found", 
              "sellerName": "CRITICAL for ISF: Seller company name - look for 'SELLER', 'VENDOR', 'SUPPLIER' fields. This is who is SELLING the goods to the buyer, often the manufacturer or actual producer. EXCLUDE logistics companies, freight forwarders, and consolidators even if they appear as shippers",
              "sellerAddress": "CRITICAL for ISF: Seller complete address - the business address of the selling entity (NOT logistics company)",
              "sellerInformation": "CRITICAL for ISF: Complete seller information including name and address of the entity selling the goods. Must be the actual seller/manufacturer, NOT freight forwarders, logistics companies, or consolidators",
              "notifyPartyName": "notify party name if found",
              "notifyPartyAddress": "notify party address if found",
              "shipToPartyName": "CRITICAL for ISF: Ship-to party name - look for 'SHIP TO PARTY', 'SHIP TO', 'SHIP-TO PARTY', 'SHIPMENT TO' fields. Extract the EXACT company name written in the document, NOT 'Same as Consignee' or similar generic text",
              "shipToPartyAddress": "CRITICAL for ISF: Ship-to party complete address - extract the EXACT address written under ship-to party section, NOT 'Same as Consignee'",
              "shipToPartyInformation": "CRITICAL for ISF: Complete ship-to party information including name and address - look for 'SHIP TO PARTY', 'SHIP TO', 'SHIP-TO PARTY' sections. Extract the ACTUAL data written in the document, never use placeholder text like 'Same as Consignee'",
              "cargoDescription": "detailed cargo/commodity description if found",
              "htsCode": "HTS/HS tariff classification code if found",
              "countryOfOrigin": "country where goods originated/were made if found",
              "numberOfPackages": "number of packages/pieces as integer if found",
              "packageType": "package type (e.g., cartons, pallets, bags) if found",
              "weight": "weight with unit (e.g., 1500KGS) if found",
              "grossWeight": "gross weight as number if found",
              "volume": "volume measurement if found",
              "dateIssued": "document issue date if found",
              "eta": "estimated time of arrival date if found",
              "etd": "estimated time of departure date if found",
              "onBoardDate": "on board date if found",
              "bookingNumber": "booking reference number if found",
              "scacCode": "SCAC code if found - look for 'SCAC', 'SCAC CODE', or 4-letter carrier codes",
              "mblScacCode": "Master SCAC code (MBL SCAC) if found - look for 'MBL SCAC', 'MASTER SCAC', 'M/BL SCAC' - the SCAC code for the Master Bill of Lading",
              "hblScacCode": "House SCAC code (HBL SCAC) if found - look for 'HBL SCAC', 'HOUSE SCAC', 'H/BL SCAC' - the SCAC code for the House Bill of Lading",
              "amsNumber": "CRITICAL: AMS filing number - look for ANY of these patterns: 'AMS', 'AMS NO', 'AMS NUMBER', 'AMS NO.', 'AMS #', 'AMS REF', 'AMS REFERENCE', 'MANIFEST NUMBER', 'MANIFEST NO', 'MANIFEST #', 'AMS B/L', 'AMS BL', 'AMS FILING', followed by a number or alphanumeric code - extract the EXACT number/code only",
              "amsNo": "AMS number if found with 'AMS NO' label",
              "amsReference": "AMS reference number if found",
              "manifestNumber": "Manifest number if found separately",
              "consolidatorStufferInfo": "CRITICAL: The COMPANY NAME of the consolidator/container stuffer - look for 'CONSOLIDATOR NAME', 'CONSOLIDATOR', 'CONTAINER STUFFER', 'STUFFER', 'CFS OPERATOR' - extract only the COMPANY NAME, not the address or location. This is the business entity that consolidated/stuffed the container - THIS IS DIFFERENT FROM SHIPPER and DIFFERENT FROM CONTAINER STUFFING LOCATION",
              "consolidator": "consolidator company name if found separately - look for 'CONSOLIDATOR NAME' specifically - NOT the shipper",
              "consolidatorName": "CRITICAL: Look specifically for 'CONSOLIDATOR NAME', 'CONSOLIDATOR:', 'CONSOLIDATOR NAME:', or 'CONSOLIDATOR/STUFFER NAME' fields in ISF documents - extract only the COMPANY NAME, not the location or address",
              "consolidatorStufferName": "Look for 'CONSOLIDATOR/STUFFER NAME' field specifically",
              "consolidatorAddress": "Look for consolidator address information",
              "consolidatorInformation": "complete consolidator information with address if found - NOT the shipper information",
              "containerStuffer": "container stuffer company information if found - separate from shipper",
              "stufferName": "stuffer company name if found",
              "cfsOperator": "CFS (Container Freight Station) operator name if found",
              "cfsFacility": "CFS facility information if found",
              "containerStuffingLocation": "CRITICAL: ONLY the physical location/address where container stuffing occurred - look for 'Container Stuffing Location:', 'CONTAINER STUFFING LOCATION', 'Stuffing Location', 'Place of Stuffing', 'CFS Location'. Extract ONLY the geographic location (city, port, country) like 'BUSAN, SOUTH KOREA' or 'QINGDAO, CHINA'. DO NOT extract company names or business addresses - this field is for the PHYSICAL LOCATION where stuffing happened, NOT who did the stuffing",
              "containerStuffing": "any container stuffing related information if found",
              "stuffingLocation": "stuffing location if found"
            }`
          },
          {
            role: "user",
            content: `Extract comprehensive shipping data from this ${documentType}. 

${documentType === 'isf_information_sheet' ? 'THIS IS AN ISF DOCUMENT - Pay special attention to ISF-specific fields:' : ''}

Key extraction priorities:
1. AMS numbers - they may appear as "AMS NO: 123456", "AMS# 789012", "MANIFEST NO 345678", or similar patterns
2. For ISF documents, look carefully throughout the entire document for these mandatory fields:
   - CONSOLIDATOR NAME / CONSOLIDATOR / CONTAINER STUFFER - this is a separate company from the shipper
   - MANUFACTURER information - look for "MANUFACTURER:", "SUPPLIER:", "FACTORY:", "MILL:" fields
   - SELLER information - look for "SELLER:", "VENDOR:", "SOLD BY:" fields (often different from shipper)
   - CONTAINER STUFFING LOCATION - the physical location where stuffing occurred
   - Look at ALL sections of the document, including headers, footers, and separate information blocks
3. Distinguish between business roles:
   - SHIPPER: The party exporting/sending the goods (logistics role)
   - MANUFACTURER: The company that actually MADE the goods (production role) - often mentioned in cargo descriptions
   - SELLER: The company SELLING the goods to the buyer (commercial role)
   - CONSOLIDATOR: The company that consolidated/stuffed the container (logistics role)
4. Extract manufacturer from cargo descriptions:
   - Look for company names in cargo descriptions like "POSCO FUTURE M REFRACTORIES"
   - Extract manufacturer names from phrases like "MANUFACTURED BY", "MADE BY", "PRODUCED BY"
   - Identify manufacturing companies vs logistics companies based on business activity
3. Distinguish between different company roles:
   - SHIPPER = the company exporting/sending goods
   - CONSOLIDATOR = the company that consolidated/stuffed the container (often a logistics company)
   - MANUFACTURER = the company that made the goods
4. Extract field values exactly as they appear after field labels, including full company names and addresses

Read through the ENTIRE document content carefully:

${documentText.substring(0, 8000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500
      });

      const result = completion.choices[0].message.content;
      if (!result) {
        throw new Error('No response from AI analysis');
      }

      const extractedData = JSON.parse(result) as ExtractedShipmentData;
      
      console.log('AI extracted data:', extractedData);
      console.log('🔍 DEBUG container stuffing fields:', {
        containerStuffingLocation: extractedData.containerStuffingLocation,
        containerStuffing: extractedData.containerStuffing,
        stuffingLocation: extractedData.stuffingLocation
      });
      
      // Enhanced consolidator name extraction with comprehensive pattern matching for ISF documents
      console.log(`🔍 DOCUMENT ANALYSIS: Processing ${documentType} document`);
      console.log(`📄 Document text length: ${documentText?.length || 0} characters`);
      console.log(`🔍 Current extracted consolidator data:`, {
        consolidatorName: extractedData.consolidatorName,
        consolidatorStufferInfo: extractedData.consolidatorStufferInfo,
        consolidatorInformation: extractedData.consolidatorInformation,
        consolidator: extractedData.consolidator,
        containerStuffer: extractedData.containerStuffer,
        stufferName: extractedData.stufferName
      });
      
      // Show preview of document text for ISF documents
      if (documentText && documentType === 'isf_information_sheet') {
        console.log(`📋 DOCUMENT PREVIEW (first 500 chars):`, documentText.substring(0, 500));
        console.log(`📋 DOCUMENT PREVIEW (last 300 chars):`, documentText.substring(Math.max(0, documentText.length - 300)));
      }
      
      if (!extractedData.consolidatorName && !extractedData.consolidatorStufferInfo && documentText && documentType === 'isf_information_sheet') {
        console.log('🔍 PATTERN MATCHING: Searching for consolidator patterns in ISF document...');
        const consolidatorPatterns = [
          // Exact patterns from ISF Information Sheet format
          /CONTAINER\s*STUFFER\/CONSOLIDATOR\s*:\s*([^\n\r]+)/i,
          /CONTAINER\s*STUFFER\s*\/\s*CONSOLIDATOR\s*:\s*([^\n\r]+)/i,
          /CONSOLIDATOR\s*\/\s*STUFFER\s*:\s*([^\n\r]+)/i,
          // Direct consolidator field patterns
          /CONSOLIDATOR\s*NAME[^:]*:?\s*([^\n\r]+)/i,
          /CONSOLIDATOR\s*INFORMATION[^:]*:?\s*([^\n\r]+)/i,
          /CONSOLIDATOR[^:]*:?\s*([^\n\r]+)/i,
          /CONTAINER\s*STUFFER[^:]*:?\s*([^\n\r]+)/i,
          /CFS\s*OPERATOR[^:]*:?\s*([^\n\r]+)/i,
          /CFS\s*NAME[^:]*:?\s*([^\n\r]+)/i,
          /STUFFING\s*COMPANY[^:]*:?\s*([^\n\r]+)/i,
          /CONSOLIDATION\s*FACILITY[^:]*:?\s*([^\n\r]+)/i,
          // Alternative patterns with field numbers (ISF field #8)
          /(?:FIELD\s*#?8|8\.|8\))[^:]*CONSOLIDATOR[^:]*:?\s*([^\n\r]+)/i,
          /(?:FIELD\s*#?8|8\.|8\))[^:]*:?\s*([^\n\r]+)/i,
          // Company patterns in consolidator context
          /(?:CONSOLIDATOR|STUFFER|CFS)[^:]*:?\s*([A-Z][^,\n\r]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[^,\n\r]*)/i,
          // Look for companies mentioned near stuffing location
          /(?:STUFFING|CONSOLIDATION)[^:]*LOCATION[^:]*:?[^,\n\r]*,?\s*([A-Z][^,\n\r]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[^,\n\r]*)/i
        ];
        
        for (const pattern of consolidatorPatterns) {
          const match = documentText.match(pattern);
          if (match && match[1]) {
            const consolidatorName = match[1].trim();
            // Clean up the extracted name
            const cleanName = consolidatorName
              .replace(/^\s*[-,]\s*/, '') // Remove leading dashes/commas
              .replace(/\s*[-,]\s*$/, '') // Remove trailing dashes/commas  
              .trim();
            
            if (cleanName && cleanName.length > 5 && !cleanName.toLowerCase().includes('same as') && !cleanName.toLowerCase().includes('see above')) {
              console.log(`🎯 CONSOLIDATOR PATTERN FOUND: ${cleanName}`);
              extractedData.consolidatorName = cleanName;
              extractedData.consolidatorStufferInfo = cleanName;
              break;
            }
          }
        }
        
        // If still no consolidator found, perform comprehensive document scan
        if (!extractedData.consolidatorName) {
          console.log('🔍 COMPREHENSIVE SCAN: Analyzing entire ISF document for consolidator information...');
          
          // Look for consolidator information in sections and subsections
          const sectionPatterns = [
            // Section-based patterns
            /(?:SECTION\s*[0-9]+|FIELD\s*[0-9]+|ELEMENT\s*[0-9]+)[^:]*CONSOLIDATOR[^:]*:?\s*([^\n\r]+)/gi,
            /(?:8\.|8\)|\(8\)|EIGHT\.)[^:]*([A-Z][^\n\r]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[^\n\r]*)/gi,
            // Container stuffing context
            /(?:WHERE|LOCATION|PLACE)[^:]*(?:STUFF|CONSOLID|PACK)[^:]*:?\s*([^\n\r]+)/gi,
            /(?:STUFF|CONSOLID|PACK)[^:]*(?:WHERE|LOCATION|PLACE)[^:]*:?\s*([^\n\r]+)/gi,
            // Company identification in context
            /(?:BY|DONE BY|PERFORMED BY|STUFFED BY)[^:]*:?\s*([A-Z][^\n\r]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[^\n\r]*)/gi,
            // Footer and signature areas
            /(?:PREPARED BY|COMPLETED BY|SUBMITTED BY)[^:]*:?\s*([A-Z][^\n\r]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[^\n\r]*)/gi
          ];
          
          const foundConsolidators = new Set<string>();
          
          for (const pattern of sectionPatterns) {
            let match;
            while ((match = pattern.exec(documentText)) !== null) {
              const consolidator = match[1]?.trim();
              if (consolidator && consolidator.length > 8 && consolidator.length < 100) {
                // Clean up the extracted consolidator name
                const cleanConsolidator = consolidator
                  .replace(/^\s*[-,\.\:]\s*/, '')
                  .replace(/\s*[-,\.\:]\s*$/, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                if (cleanConsolidator && 
                    !cleanConsolidator.toLowerCase().includes('same as') && 
                    !cleanConsolidator.toLowerCase().includes('see above') &&
                    !cleanConsolidator.toLowerCase().includes('n/a') &&
                    !cleanConsolidator.toLowerCase().includes('not applicable')) {
                  foundConsolidators.add(cleanConsolidator);
                }
              }
            }
          }
          
          // Also look for company names in general context with freight/logistics keywords
          const companyPatterns = [
            /([A-Z][A-Z\s&,-]*(?:LOGISTICS|FREIGHT|FORWARDING|CONSOLIDAT|CFS)[A-Z\s&,-]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[A-Z\s&,-]*)/gi,
            /([A-Z][A-Z\s&,-]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[A-Z\s&,-]*(?:LOGISTICS|FREIGHT|FORWARDING|CONSOLIDAT|CFS)[A-Z\s&,-]*)/gi,
            // Look for companies mentioned near key ISF terms
            /(?:CONSOLIDATOR|STUFFER|CFS)[^:]*(?:NAME|COMPANY)[^:]*:?\s*([A-Z][^\n\r]*(?:CO\.|LTD|INC|CORP|LLC|LIMITED)[^\n\r]*)/gi
          ];
          
          for (const pattern of companyPatterns) {
            let match;
            while ((match = pattern.exec(documentText)) !== null) {
              const company = match[1]?.trim();
              if (company && company.length > 8 && company.length < 100) {
                foundConsolidators.add(company);
              }
            }
          }
          
          // Convert to array and prioritize
          const consolidators = Array.from(foundConsolidators);
          console.log(`🔍 Found ${consolidators.length} potential consolidators:`, consolidators);
          
          if (consolidators.length > 0) {
            // Prioritize companies with logistics/freight keywords
            let selectedConsolidator = consolidators.find(c => 
              /logistics|freight|forwarding|consolidat|cfs/i.test(c)
            );
            
            // If no logistics company, take the first reasonable one
            if (!selectedConsolidator) {
              selectedConsolidator = consolidators[0];
            }
            
            console.log(`🎯 SELECTED CONSOLIDATOR: ${selectedConsolidator}`);
            extractedData.consolidatorName = selectedConsolidator;
            extractedData.consolidatorStufferInfo = selectedConsolidator;
          } else {
            console.log('❌ No consolidator companies found in comprehensive scan');
          }
        }
      }

      // Enhanced Container Stuffing Location extraction for ISF documents
      if ((!extractedData.containerStuffingLocation || extractedData.containerStuffingLocation === 'CFS/CFS') && pdfText && documentType === 'isf_information_sheet') {
        console.log('🔍 PATTERN MATCHING: Searching for Container Stuffing Location in ISF document...');
        console.log('📄 PDF TEXT SAMPLE (first 2000 chars):', pdfText.substring(0, 2000));
        const stuffingLocationPatterns = [
          // Enhanced patterns to capture complete multi-line addresses after ISF field labels
          // Capture everything until the next ISF field (which typically starts with a number and colon)
          /Container\s*Stuffing\s*Location\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /CONTAINER\s*STUFFING\s*LOCATION\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          
          // Alternative patterns for different field formats
          /STUFFING\s*LOCATION\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /PLACE\s*OF\s*STUFFING\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /CFS\s*LOCATION\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /WHERE\s*STUFFED\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /STUFFED\s*AT\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /CONSOLIDATION\s*LOCATION\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /Container\s*Stuffer\s*Location\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          
          // Fallback patterns for simpler cases
          /Container\s*Stuffing\s*Location\s*:\s*([^\n\r]+)/i,
          /CONTAINER\s*STUFFING\s*LOCATION\s*:\s*([^\n\r]+)/i
        ];
        
        for (const pattern of stuffingLocationPatterns) {
          const match = pdfText.match(pattern);
          if (match && match[1]) {
            let location = match[1].trim();
            
            console.log(`🔍 TESTING PATTERN: ${pattern.source}`);
            console.log(`🔍 RAW MATCH: "${match[1]}"`);
            
            // For multi-line addresses, preserve line breaks but clean up formatting
            if (location.includes('\n') || location.includes('\r')) {
              // Keep line breaks for addresses but clean up extra whitespace
              location = location
                .replace(/\r\n/g, '\n')
                .replace(/\r/g, '\n')
                .split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .join('\n');
            } else {
              // Single line - just clean up whitespace
              location = location.replace(/\s+/g, ' ').trim();
            }
            
            // CRITICAL FIX: For ISF documents, preserve the complete multi-line address
            // The user needs the full 3-line container stuffing location as shown on the ISF form
            console.log(`🔍 RAW LOCATION BEFORE PROCESSING: "${location}"`);
            
            // For ISF documents, we should preserve the complete address structure
            // Clean up whitespace but keep the full multi-line format
            if (location.includes('\n')) {
              const lines = location.split('\n');
              console.log(`🔍 PROCESSING ${lines.length} LINES FOR COMPLETE ADDRESS:`, lines);
              
              // Clean each line but preserve the structure
              const cleanedLines = lines
                .map(line => line.trim())
                .filter(line => line.length > 0)
                .filter(line => {
                  // Remove lines that are just labels or empty content
                  return !/(^Container\s*Stuffing|^CONTAINER\s*STUFFING|^Stuffing\s*Location|^STUFFING\s*LOCATION|^\s*:?\s*$)/i.test(line);
                });
              
              if (cleanedLines.length > 0) {
                location = cleanedLines.join('\n');
                console.log(`🎯 COMPLETE CONTAINER STUFFING LOCATION (${cleanedLines.length} lines):`, location);
              }
            } else {
              // Single line - just clean up whitespace but preserve content
              location = location.replace(/\s+/g, ' ').trim();
              console.log(`🎯 SINGLE LINE CONTAINER STUFFING LOCATION: "${location}"`);
            }
            
            console.log(`🔍 CLEANED LOCATION: "${location}"`);
            
            // Validate the location - ensure it's not just a generic term
            if (location && location.length > 5 && 
                !location.toLowerCase().includes('same as') && 
                location !== 'CFS/CFS' &&
                !location.toLowerCase().includes('to be advised') &&
                !location.toLowerCase().includes('tba') &&
                !location.toLowerCase().includes('n/a')) {
              console.log(`🎯 CONTAINER STUFFING LOCATION FOUND: ${location}`);
              extractedData.containerStuffingLocation = location;
              break;
            }
          }
        }
        
        // If still not found, try searching for complete address patterns near stuffing location
        if (!extractedData.containerStuffingLocation) {
          const addressPatterns = [
            /Container\s*Stuffing\s*Location.*?([^,\n]+,\s*[^,\n]+,\s*[^,\n]+)/is,
            /CONTAINER\s*STUFFING\s*LOCATION.*?([^,\n]+,\s*[^,\n]+,\s*[^,\n]+)/is
          ];
          
          for (const pattern of addressPatterns) {
            const match = pdfText.match(pattern);
            if (match && match[1]) {
              const location = match[1].trim();
              if (location.length > 10) {
                console.log(`🎯 CONTAINER STUFFING LOCATION (ADDRESS PATTERN): ${location}`);
                extractedData.containerStuffingLocation = location;
                break;
              }
            }
          }
        }
      }

      // Enhanced Ship-To Party extraction for ISF documents
      if ((!extractedData.shipToPartyInformation || extractedData.shipToPartyInformation?.toLowerCase().includes('same as consignee')) && pdfText && isISFDocument) {
        console.log('🔍 PATTERN MATCHING: Searching for Ship-To Party information in ISF document...');
        
        const shipToPatterns = [
          // Enhanced patterns to capture complete ship-to party information
          /SHIP\s*TO\s*PARTY\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /SHIP\s*TO\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /SHIP-TO\s*PARTY\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /SHIPMENT\s*TO\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is,
          /DELIVER\s*TO\s*:\s*((?:[^\n\r]+(?:\n\r?|\r\n?)?){1,5})(?=\n\s*\d+\.|$|\n\s*[A-Z][A-Za-z\s]*:)/is
        ];
        
        for (const pattern of shipToPatterns) {
          const match = pdfText.match(pattern);
          if (match && match[1]) {
            let shipToInfo = match[1].trim();
            
            // Filter out generic placeholder text
            if (!/(same\s*as\s*consignee|see\s*above|as\s*above|ditto)/i.test(shipToInfo)) {
              // Clean up the data but preserve structure
              const lines = shipToInfo.split('\n')
                .map(line => line.trim())
                .filter(line => line.length > 0 && !/(^SHIP\s*TO|^DELIVER\s*TO)/i.test(line));
              
              if (lines.length > 0) {
                extractedData.shipToPartyInformation = lines.join('\n');
                console.log(`🎯 SHIP-TO PARTY INFORMATION FOUND: ${extractedData.shipToPartyInformation}`);
                break;
              }
            }
          }
        }
      }

      // Enhanced SCAC code extraction for ISF documents
      if ((!extractedData.hblScacCode || !extractedData.mblScacCode) && pdfText && isISFDocument) {
        console.log('🔍 PATTERN MATCHING: Searching for SCAC codes in ISF document...');
        
        // HBL SCAC patterns
        const hblScacPatterns = [
          /HBL\s*SCAC\s*CODE?\s*:?\s*([A-Z]{4})/i,
          /H\/BL\s*SCAC\s*:?\s*([A-Z]{4})/i,
          /HOUSE\s*SCAC\s*:?\s*([A-Z]{4})/i,
          /HBL\s*SCAC\s*:?\s*([A-Z]{4})/i,
          /H\s*B\s*L\s*SCAC\s*:?\s*([A-Z]{4})/i
        ];
        
        // MBL SCAC patterns
        const mblScacPatterns = [
          /MBL\s*SCAC\s*CODE?\s*:?\s*([A-Z]{4})/i,
          /M\/BL\s*SCAC\s*:?\s*([A-Z]{4})/i,
          /MASTER\s*SCAC\s*:?\s*([A-Z]{4})/i,
          /MBL\s*SCAC\s*:?\s*([A-Z]{4})/i,
          /M\s*B\s*L\s*SCAC\s*:?\s*([A-Z]{4})/i
        ];
        
        // Extract HBL SCAC
        if (!extractedData.hblScacCode) {
          for (const pattern of hblScacPatterns) {
            const match = pdfText.match(pattern);
            if (match && match[1]) {
              extractedData.hblScacCode = match[1].toUpperCase();
              console.log(`🎯 HBL SCAC CODE FOUND: ${extractedData.hblScacCode}`);
              break;
            }
          }
        }
        
        // Extract MBL SCAC
        if (!extractedData.mblScacCode) {
          for (const pattern of mblScacPatterns) {
            const match = pdfText.match(pattern);
            if (match && match[1]) {
              extractedData.mblScacCode = match[1].toUpperCase();
              console.log(`🎯 MBL SCAC CODE FOUND: ${extractedData.mblScacCode}`);
              break;
            }
          }
        }
      }

      // Enhanced AMS number extraction with pattern matching fallback
      if (!extractedData.amsNumber && pdfText) {
        const amsPatterns = [
          /AMS\s*(?:NO\.?|NUMBER|#)\s*:?\s*([A-Z0-9\-]+)/i,
          /AMS\s*:?\s*([A-Z0-9\-]{6,})/i,
          /MANIFEST\s*(?:NO\.?|NUMBER|#)\s*:?\s*([A-Z0-9\-]+)/i,
          /AMS\s*B\/L\s*(?:NO\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i,
          /AMS\s*BL\s*(?:NO\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i,
          /AMS\s*REF(?:ERENCE)?\s*:?\s*([A-Z0-9\-]+)/i
        ];
        
        for (const pattern of amsPatterns) {
          const match = pdfText.match(pattern);
          if (match && match[1]) {
            extractedData.amsNumber = match[1].trim();
            console.log(`🎯 AMS NUMBER FOUND via pattern matching: ${extractedData.amsNumber}`);
            break;
          }
        }
      }

      // Merge ISF-specific extraction data if available
      if (isISFDocument && (global as any).isfSpecificData) {
        const isfData = (global as any).isfSpecificData;
        console.log('🔗 MERGING ISF-SPECIFIC DATA with standard extraction...');
        
        // Override with ISF-specific data where available
        if (isfData.containerStuffingLocation) {
          extractedData.containerStuffingLocation = isfData.containerStuffingLocation;
          console.log(`🎯 ISF Override - Container Stuffing Location: ${isfData.containerStuffingLocation}`);
        }
        
        if (isfData.shipToParty && isfData.shipToParty.toLowerCase() !== 'same as consignee') {
          extractedData.shipToPartyInformation = isfData.shipToParty;
          console.log(`🎯 ISF Override - Ship To Party: ${isfData.shipToParty}`);
        }
        
        if (isfData.hblScacCode) {
          extractedData.hblScacCode = isfData.hblScacCode;
          console.log(`🎯 ISF Override - HBL SCAC Code: ${isfData.hblScacCode}`);
        }
        
        if (isfData.mblScacCode) {
          extractedData.mblScacCode = isfData.mblScacCode;
          console.log(`🎯 ISF Override - MBL SCAC Code: ${isfData.mblScacCode}`);
        }
        
        if (isfData.seller) {
          extractedData.sellerInformation = isfData.seller;
          console.log(`🎯 ISF Override - Seller: ${isfData.seller}`);
        }
        
        if (isfData.manufacturer) {
          extractedData.manufacturerInformation = isfData.manufacturer;
          console.log(`🎯 ISF Override - Manufacturer: ${isfData.manufacturer}`);
        }
        
        if (isfData.consignee) {
          extractedData.consigneeInformation = isfData.consignee;
          console.log(`🎯 ISF Override - Consignee: ${isfData.consignee}`);
        }
        
        // Clear the global ISF data after use
        delete (global as any).isfSpecificData;
      }
      
      // Enhanced post-processing for manufacturer and seller extraction
      // ALWAYS run ISF pattern extraction for ISF form submissions
      if (pdfText) {
        console.log('🔍 POST-PROCESSING: Enhancing manufacturer and seller extraction...');
        
        // Try to extract manufacturer from cargo description if not already found
        if ((!extractedData.manufacturerName || !extractedData.manufacturerInformation) && 
            (extractedData.cargoDescription || extractedData.commodity)) {
          const cargoDesc = extractedData.cargoDescription || extractedData.commodity || '';
          console.log(`🔍 ANALYZING CARGO DESCRIPTION: "${cargoDesc}"`);
          
          // Look for manufacturer names in cargo descriptions
          const manufacturerPatterns = [
            /^([A-Z][A-Za-z\s&]+(?:Co\.|Ltd|Inc|Corp|Company))/i, // Company name at start of cargo description
            /(\b[A-Z][A-Za-z\s&]+(?:FUTURE|STEEL|METAL|MILL|WORKS)\b[A-Za-z\s]*(?:Co\.|Ltd|Inc|Corp|Company)?)/i, // Manufacturing companies
            /MANUFACTURED BY\s+([A-Z][^\n\r]+)/i,
            /MADE BY\s+([A-Z][^\n\r]+)/i,
            /PRODUCED BY\s+([A-Z][^\n\r]+)/i
          ];
          
          for (const pattern of manufacturerPatterns) {
            const match = cargoDesc.match(pattern);
            if (match && match[1]) {
              let manufacturer = match[1].trim();
              
              // Clean up the manufacturer name
              manufacturer = manufacturer.replace(/\s+/g, ' ').trim();
              
              // Validate it's not a logistics company
              if (!manufacturer.toLowerCase().includes('logistics') &&
                  !manufacturer.toLowerCase().includes('freight') &&
                  !manufacturer.toLowerCase().includes('forwarding') &&
                  manufacturer.length > 3) {
                console.log(`🎯 MANUFACTURER EXTRACTED FROM CARGO: ${manufacturer}`);
                extractedData.manufacturerName = manufacturer;
                
                // Try to find manufacturer address/country
                if (extractedData.countryOfOrigin && !extractedData.manufacturerInformation) {
                  extractedData.manufacturerInformation = `${manufacturer}\nCountry: ${extractedData.countryOfOrigin}`;
                }
                break;
              }
            }
          }
        }
        
        // COMPREHENSIVE ISF PATTERN SCANNING: Scan entire document for ISF-specific patterns
        console.log('🔍 COMPREHENSIVE ISF SCANNING: Analyzing entire document for ISF field patterns...');
        console.log('📄 DOCUMENT TEXT SAMPLE:', pdfText.substring(0, 500));
        
        const isfPatternExtraction = this.extractISFPatterns(pdfText);
        console.log('🔍 ISF PATTERN RESULTS:', JSON.stringify(isfPatternExtraction, null, 2));
        
        // Override extracted data with ISF-specific patterns if found
        if (isfPatternExtraction.seller) {
          console.log(`🎯 ISF PATTERN SELLER FOUND: ${isfPatternExtraction.seller}`);
          extractedData.sellerInformation = isfPatternExtraction.seller;
          extractedData.sellerName = isfPatternExtraction.seller.split(/\n|,/)[0].trim();
        }
        
        if (isfPatternExtraction.manufacturer) {
          console.log(`🎯 ISF PATTERN MANUFACTURER FOUND: ${isfPatternExtraction.manufacturer}`);
          extractedData.manufacturerInformation = isfPatternExtraction.manufacturer;
          extractedData.manufacturerName = isfPatternExtraction.manufacturer.split(/\n|,/)[0].trim();
        }
        
        if (isfPatternExtraction.consolidator) {
          console.log(`🎯 ISF PATTERN CONSOLIDATOR FOUND: ${isfPatternExtraction.consolidator}`);
          extractedData.consolidatorStufferInfo = isfPatternExtraction.consolidator;
        }
        
        if (isfPatternExtraction.buyer) {
          console.log(`🎯 ISF PATTERN BUYER FOUND: ${isfPatternExtraction.buyer}`);
          extractedData.buyerInformation = isfPatternExtraction.buyer;
        }
        
        if (isfPatternExtraction.shipToParty) {
          console.log(`🎯 ISF PATTERN SHIP-TO FOUND: ${isfPatternExtraction.shipToParty}`);
          extractedData.shipToPartyInformation = isfPatternExtraction.shipToParty;
        }
        
        if (isfPatternExtraction.containerStuffingLocation) {
          console.log(`🎯 ISF PATTERN STUFFING LOCATION FOUND: ${isfPatternExtraction.containerStuffingLocation}`);
          extractedData.containerStuffingLocation = isfPatternExtraction.containerStuffingLocation;
        }
        
        if (isfPatternExtraction.consignee) {
          console.log(`🎯 ISF PATTERN CONSIGNEE FOUND: ${isfPatternExtraction.consignee}`);
          extractedData.consigneeName = isfPatternExtraction.consignee.split(/\n|,/)[0].trim();
          extractedData.consigneeAddress = isfPatternExtraction.consignee;
        }
        
        if (isfPatternExtraction.importer) {
          console.log(`🎯 ISF PATTERN IMPORTER FOUND: ${isfPatternExtraction.importer}`);
          extractedData.importerName = isfPatternExtraction.importer.split(/\n|,/)[0].trim();
          extractedData.importerAddress = isfPatternExtraction.importer;
        }
        
        if (isfPatternExtraction.countryOfOrigin) {
          console.log(`🎯 ISF PATTERN COUNTRY OF ORIGIN FOUND: ${isfPatternExtraction.countryOfOrigin}`);
          extractedData.countryOfOrigin = isfPatternExtraction.countryOfOrigin;
          extractedData.manufacturerCountry = isfPatternExtraction.countryOfOrigin;
        }
        
        if (isfPatternExtraction.hblScacCode) {
          console.log(`🎯 ISF PATTERN HBL SCAC FOUND: ${isfPatternExtraction.hblScacCode}`);
          extractedData.hblScacCode = isfPatternExtraction.hblScacCode;
        }
        
        if (isfPatternExtraction.mblScacCode) {
          console.log(`🎯 ISF PATTERN MBL SCAC FOUND: ${isfPatternExtraction.mblScacCode}`);
          extractedData.mblScacCode = isfPatternExtraction.mblScacCode;
          extractedData.scacCode = isfPatternExtraction.mblScacCode;
        }
        
        if (isfPatternExtraction.htsCode) {
          console.log(`🎯 ISF PATTERN HTS CODE FOUND: ${isfPatternExtraction.htsCode}`);
          extractedData.htsCode = isfPatternExtraction.htsCode;
          extractedData.hsCode = isfPatternExtraction.htsCode;
          extractedData.htsusNumber = isfPatternExtraction.htsCode;
        }
        
        if (isfPatternExtraction.commodityDescription) {
          console.log(`🎯 ISF PATTERN COMMODITY DESCRIPTION FOUND: ${isfPatternExtraction.commodityDescription}`);
          extractedData.commodityDescription = isfPatternExtraction.commodityDescription;
          extractedData.cargoDescription = isfPatternExtraction.commodityDescription;
        }
        
        if (isfPatternExtraction.vesselName) {
          console.log(`🎯 ISF PATTERN VESSEL NAME FOUND: ${isfPatternExtraction.vesselName}`);
          extractedData.vesselName = isfPatternExtraction.vesselName;
        }
        
        if (isfPatternExtraction.voyageNumber) {
          console.log(`🎯 ISF PATTERN VOYAGE NUMBER FOUND: ${isfPatternExtraction.voyageNumber}`);
          extractedData.voyageNumber = isfPatternExtraction.voyageNumber;
        }
        
        if (isfPatternExtraction.portOfLoading) {
          console.log(`🎯 ISF PATTERN PORT OF LOADING FOUND: ${isfPatternExtraction.portOfLoading}`);
          extractedData.portOfLoading = isfPatternExtraction.portOfLoading;
          extractedData.originPort = isfPatternExtraction.portOfLoading;
          extractedData.foreignPortOfLading = isfPatternExtraction.portOfLoading;
        }
        
        if (isfPatternExtraction.portOfDischarge) {
          console.log(`🎯 ISF PATTERN PORT OF DISCHARGE FOUND: ${isfPatternExtraction.portOfDischarge}`);
          extractedData.portOfDischarge = isfPatternExtraction.portOfDischarge;
          extractedData.destinationPort = isfPatternExtraction.portOfDischarge;
          extractedData.portOfEntry = isfPatternExtraction.portOfDischarge;
        }
      }

      // Validate and clean the extracted data
      return this.validateAndCleanData(extractedData);

    } catch (error) {
      console.error('AI document processing failed:', error);
      throw error;
    }
  }

  /**
   * Extract ISF-specific patterns from document text by scanning for field indicators
   */
  public extractISFPatterns(text: string): {
    seller?: string;
    manufacturer?: string;
    consolidator?: string;
    buyer?: string;
    shipToParty?: string;
    containerStuffingLocation?: string;
    consignee?: string;
    importer?: string;
    importerOfRecord?: string;
    countryOfOrigin?: string;
    hblScacCode?: string;
    mblScacCode?: string;
    htsCode?: string;
    commodityDescription?: string;
    vesselName?: string;
    voyageNumber?: string;
    portOfLoading?: string;
    portOfDischarge?: string;
  } {
    const result: any = {};
    
    // Comprehensive ISF field patterns - scan entire document for all use cases
    const patterns = {
      seller: [
        // ISF Field #2 - Numbered format variations
        /(?:^|\n)\s*(?:2\.?\s*)?(?:Seller|Export[er]*)\s+(?:Name\s*)?(?:&|and)?\s*Address[:\s]*((?:(?!DAEWOO|Logistics|Freight|Forwarder)[\s\S])*?)(?=\n\s*(?:3\.|Buyer|Importer|Consolidator|$))/i,
        /(?:^|\n)\s*(?:2\.?\s*)?Seller[:\s]+((?:(?!DAEWOO|Logistics|Freight|Forwarder)[\s\S])*?)(?=\n\s*(?:3\.|Buyer|Importer|$))/i,
        
        // Standard format variations
        /(?:Seller|Export[er]*)\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+((?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n])*(?:\n(?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n:]*(?![A-Z][a-z]*:)))*)/i,
        /Vendor\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+((?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n])*(?:\n(?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n:]*(?![A-Z][a-z]*:)))*)/i,
        /Supplier\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+((?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n])*(?:\n(?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n:]*(?![A-Z][a-z]*:)))*)/i,
        
        // Alternative field labels
        /(?:Sold\s+by|From)[:\s]+((?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n])*(?:\n(?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n:]*(?![A-Z][a-z]*:)))*)/i,
        /Last\s+Known\s+Seller[:\s]+((?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n])*(?:\n(?:(?!DAEWOO|Logistics|Freight|Forwarder)[^\n:]*(?![A-Z][a-z]*:)))*)/i,
        
        // Table format patterns - horizontal and vertical layouts
        /Seller[^\n]*\n[^\n]*([A-Z][^\n]*Co\.?[^\n]*(?:\n[^\n:]+)*)/i,
        /(?:Seller|Export[er]*)\s*[|\t]\s*([^\n\t|]+)/i,
        
        // ISF table row patterns
        /(?:ISF\s+)?(?:Field\s+)?(?:#?2|Two)[:\s]*(?:Seller|Export[er]*)[^\n]*\n([^\n]+)/i,
        /2\.\s*([A-Z][^\n]*(?:Co\.|Corp\.|Ltd\.|Inc\.)[^\n]*)/i,
        
        // Specific company patterns (like RS Korea Co., Ltd)
        /RS\s+Korea\s+Co[.,]\s*Ltd[.\s]*[^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*/i,
        
        // Multi-line company address extraction
        /(?:Seller|Export[er]*|Vendor|Supplier)[:\s]*\n([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
      ],
      
      manufacturer: [
        // ISF Field #1 - Numbered format variations
        /(?:^|\n)\s*(?:1\.?\s*)?(?:Manufacturer|Producer|Maker)(?:[/\s]*Supplier)?\s+(?:Name\s*)?(?:&|and)?\s*Address[:\s]*([\s\S]*?)(?=\n\s*(?:2\.|Seller|Export|$))/i,
        /(?:^|\n)\s*(?:1\.?\s*)?Manufacturer[:\s]+([\s\S]*?)(?=\n\s*(?:2\.|Seller|Export|$))/i,
        
        // Standard format variations
        /(?:Manufacturer|Producer|Maker)\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:Made|Produced|Manufactured)\s+(?:by|in)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Factory[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Plant[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /Origin(?:al)?\s+(?:Manufacturer|Producer)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Production\s+Facility[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Manufacturing\s+Company[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Table format patterns for manufacturer
        /(?:Manufacturer|Producer)\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?1|One)[:\s]*(?:Manufacturer|Producer)[^\n]*\n([^\n]+)/i,
        /1\.\s*([A-Z][^\n]*(?:Co\.|Corp\.|Ltd\.|Inc\.)[^\n]*)/i,
      ],
      
      consolidator: [
        // ISF Field #6 - Numbered format variations
        /(?:^|\n)\s*(?:6\.?\s*)?(?:Consolidator|Container\s+Stuffer)[/'s]*\s+(?:Name\s*)?(?:&|and)?\s*Address[:\s]*([\s\S]*?)(?=\n\s*(?:7\.|8\.|AMS|$))/i,
        /(?:^|\n)\s*(?:6\.?\s*)?Consolidator[:\s]+([\s\S]*?)(?=\n\s*(?:7\.|8\.|AMS|$))/i,
        
        // Standard format variations
        /(?:Consolidator|Container\s+Stuffer)\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Freight\s+Forwarder\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /NVOCC\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /Stuffing\s+(?:Company|Agent)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Packing\s+(?:Company|Agent)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Loading\s+(?:Company|Agent)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /CFS\s+(?:Operator|Company)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Warehouse\s+(?:Operator|Company)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Table format patterns for consolidator
        /(?:Consolidator|Container\s+Stuffer)\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?6|Six)[:\s]*(?:Consolidator|Container\s+Stuffer)[^\n]*\n([^\n]+)/i,
        /6\.\s*([A-Z][^\n]*(?:Co\.|Corp\.|Ltd\.|Inc\.)[^\n]*)/i,
      ],
      
      buyer: [
        // ISF Field #3 - Numbered format variations
        /(?:^|\n)\s*(?:3\.?\s*)?(?:Buyer|Purchaser)\s+(?:Name\s*)?(?:&|and)?\s*Address[:\s]*([\s\S]*?)(?=\n\s*(?:4\.|Ship.*to|Consignee|$))/i,
        /(?:^|\n)\s*(?:3\.?\s*)?Buyer[:\s]+([\s\S]*?)(?=\n\s*(?:4\.|Ship.*to|Consignee|$))/i,
        
        // Standard format variations
        /(?:Buyer|Purchaser)\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:Sold\s+to|To)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Customer[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /End\s+User[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Final\s+(?:Buyer|Customer)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Purchasing\s+Company[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Table format patterns for buyer
        /(?:Buyer|Purchaser)\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?3|Three)[:\s]*(?:Buyer|Purchaser)[^\n]*\n([^\n]+)/i,
        /3\.\s*([A-Z][^\n]*(?:Co\.|Corp\.|Ltd\.|Inc\.)[^\n]*)/i,
        
        // More flexible buyer patterns
        /Buyer[:\s]*\n([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:ISF\s+)?(?:3[.\)\s]|Three[:\s])\s*([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Very flexible buyer patterns for any document layout
        /Buyer[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /Purchaser[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /End\s+User[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        // Ultra-flexible buyer patterns
        /3[.\s]*([A-Z][A-Za-z\s,.-]+)/i,
        /Three[.\s]*([A-Z][A-Za-z\s,.-]+)/i,
      ],
      
      shipToParty: [
        // ISF Field #4 alternate - Ship-to Party (sometimes separate from consignee)
        /(?:^|\n)\s*(?:4\.?\s*)?Ship[-\s]*to\s+Party\s+(?:Name\s*)?(?:&|and)?\s*Address[:\s]*([\s\S]*?)(?=\n\s*(?:5\.|Container|Stuffing|$))/i,
        /(?:^|\n)\s*(?:4\.?\s*)?Ship[-\s]*to[:\s]+([\s\S]*?)(?=\n\s*(?:5\.|Container|Stuffing|$))/i,
        
        // Standard format variations
        /Ship\s*(?:to|[-]to)\s*(?:Party\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Ship\s*to\s*Address[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Destination\s*Party[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /Final\s+Delivery[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Ultimate\s+Destination[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /End\s+Destination[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Table format patterns for ship-to party
        /Ship[-\s]*to\s*(?:Party)?\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?4|Four)[:\s]*Ship[-\s]*to[^\n]*\n([^\n]+)/i,
      ],
      
      containerStuffingLocation: [
        // ISF Field #5 - Numbered format variations
        /(?:^|\n)\s*(?:5\.?\s*)?Container\s+Stuffing\s+Location[:\s]*([\s\S]*?)(?=\n\s*(?:6\.|Consolidator|$))/i,
        /(?:^|\n)\s*(?:5\.?\s*)?(?:Stuffing|Loading)\s+Location[:\s]*([\s\S]*?)(?=\n\s*(?:6\.|Consolidator|$))/i,
        
        // Standard format variations
        /Container\s+Stuffing\s+Location[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:Stuffing|Loading)\s+Location[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Place\s+of\s+(?:Stuffing|Loading)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Container\s+(?:Packed|Stuffed)\s+at[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /Origin\s+(?:Location|Address)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Loading\s+Port[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /CFS\s+Location[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Warehouse\s+Location[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Geographic patterns for locations only
        /(?:Stuffed|Loaded|Packed)\s+(?:at|in)\s+([A-Z][^\n,]*,\s*[A-Z]{2,})/i,
        
        // Table format patterns for container stuffing location
        /(?:Container\s+)?(?:Stuffing|Loading)\s+Location\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?5|Five)[:\s]*(?:Container\s+)?(?:Stuffing|Loading)[^\n]*\n([^\n]+)/i,
        /5\.\s*([A-Z][^\n,]*(?:,\s*[A-Z]{2,})?)/i,
        
        // Very flexible ship-to party patterns for any document layout
        /Ship\s+to[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /Ship[-\s]to\s+party[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /Final\s+destination[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /Ultimate\s+consignee[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
      ],

      consignee: [
        // ISF Field #4 - Numbered format variations (more flexible)
        /(?:^|\n)\s*(?:4\.?\s*)?(?:Consignee|Receiver)\s+(?:Name\s*)?(?:&|and)?\s*Address[:\s]*([\s\S]*?)(?=\n\s*(?:[5-9]\.|Ship.*to|Container|Importer|$))/i,
        /(?:^|\n)\s*(?:4\.?\s*)?Consignee[:\s]+([\s\S]*?)(?=\n\s*(?:[5-9]\.|Ship.*to|Container|Importer|$))/i,
        
        // More flexible consignee patterns
        /Consignee[:\s]*\n([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Standard format variations
        /(?:Consignee|Receiver)\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:Delivered?\s+to|Deliver\s+to)\s*[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:Notify\s+party|Notify\s+to)\s*[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Final\s+Destination[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /Receiving\s+Company[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Destination\s+Company[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Addressee[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Ultimate\s+Consignee[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Table format patterns for consignee
        /(?:Consignee|Receiver)\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?4|Four)[:\s]*(?:Consignee|Receiver)[^\n]*\n([^\n]+)/i,
        /4\.\s*([A-Z][^\n]*(?:Co\.|Corp\.|Ltd\.|Inc\.)[^\n]*)/i,
        
        // More flexible consignee patterns
        /(?:ISF\s+)?(?:4[.\)\s]|Four[:\s])\s*([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:Consignee|To)[:\s]*([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Very flexible consignee patterns for any document layout
        /Consignee[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /To[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /Deliver\s+to[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        // Ultra-flexible consignee patterns
        /4[.\s]*([A-Z][A-Za-z\s,.-]+)/i,
        /Four[.\s]*([A-Z][A-Za-z\s,.-]+)/i,
      ],

      importer: [
        // ISF Field #7 - Importer of Record patterns (more flexible)
        /(?:^|\n)\s*(?:7\.?\s*)?Importer\s+of\s+Record[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /(?:^|\n)\s*(?:7\.?\s*)?Importer[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /IOR[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // More flexible importer patterns
        /Importer[:\s]*\n([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /US\s+Importer[:\s]*\n([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Standard format variations
        /Importer\s*(?:Name\s*)?(?:&|and)?\s*(?:Address\s*)?[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Import(?:ing)?\s+Company[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /US\s+Importer[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Alternative field labels
        /Record\s+Importer[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Principal\s+(?:Party|Importer)[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Responsible\s+Party[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Table format patterns for importer
        /(?:Importer|IOR)\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?7|Seven)[:\s]*(?:Importer|IOR)[^\n]*\n([^\n]+)/i,
        /7\.\s*([A-Z][^\n]*(?:Co\.|Corp\.|Ltd\.|Inc\.)[^\n]*)/i,
        
        // More flexible importer patterns
        /(?:ISF\s+)?(?:7[.\)\s]|Seven[:\s])\s*([A-Z][^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        
        // Very flexible importer patterns for any document layout
        /Importer[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /US\s+Importer[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        /Record\s+Importer[:\s\n]*([A-Z][^\n]*(?:[A-Za-z0-9\s,.-]+)*)/i,
        // Ultra-flexible importer patterns
        /7[.\s]*([A-Z][A-Za-z\s,.-]+)/i,
        /Seven[.\s]*([A-Z][A-Za-z\s,.-]+)/i,
      ],

      importerOfRecord: [
        // Importer identification numbers
        /Importer\s+of\s+Record\s+Number[:\s]+([^\n\s]+)/i,
        /IOR\s+Number[:\s]+([^\n\s]+)/i,
        /EIN[:\s]+([^\n\s]+)/i,
        /Tax\s+ID[:\s]+([^\n\s]+)/i,
        /Federal\s+ID[:\s]+([^\n\s]+)/i,
        /CBP\s+ID[:\s]+([^\n\s]+)/i,
        /Importer\s+ID[:\s]+([^\n\s]+)/i,
        /US\s+Tax\s+ID[:\s]+([^\n\s]+)/i,
      ],

      countryOfOrigin: [
        // ISF Field #8 & #9 - Country of Origin patterns (more flexible)
        /(?:^|\n)\s*(?:[89]\.?\s*)?Country\s+of\s+Origin[:\s]+([^\n]+)/i,
        /Origin\s+Country[:\s]+([^\n]+)/i,
        /Manufactured\s+in[:\s]+([^\n]+)/i,
        /Made\s+in[:\s]+([^\n]+)/i,
        /Produced\s+in[:\s]+([^\n]+)/i,
        /Country\s+of\s+(?:Manufacture|Production)[:\s]+([^\n]+)/i,
        
        // Simple country patterns
        /Origin[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /Country[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        
        // Alternative field labels
        /Manufacturing\s+Country[:\s]+([^\n]+)/i,
        /Production\s+Country[:\s]+([^\n]+)/i,
        /Source\s+Country[:\s]+([^\n]+)/i,
        /Export\s+Country[:\s]+([^\n]+)/i,
        /Shipping\s+Origin[:\s]+([^\n]+)/i,
        
        // Pattern for country codes and names
        /Country[:\s]+([A-Z]{2,3}|[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        
        // Table format patterns for country of origin
        /(?:Country\s+of\s+)?Origin\s*[|\t]\s*([^\n\t|]+)/i,
        /(?:ISF\s+)?(?:Field\s+)?(?:#?[89]|Eight|Nine)[:\s]*(?:Country\s+of\s+)?Origin[^\n]*\n([^\n]+)/i,
        /[89]\.\s*([A-Z]{2,3}|[A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        
        // More flexible country patterns
        /(?:ISF\s+)?(?:[89][.\)\s]|(?:Eight|Nine)[:\s])\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        
        // Very flexible country patterns for any document layout
        /Country[:\s\n]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /Origin[:\s\n]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /Made\s+in[:\s\n]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /Manufactured\s+in[:\s\n]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        // Ultra-flexible country patterns
        /8[.\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /9[.\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /Eight[.\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
        /Nine[.\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]*)*)/i,
      ],

      hblScacCode: [
        // House Bill of Lading SCAC Code patterns
        /(?:HBL|House)\s+SCAC\s*(?:Code)?[:\s]+([A-Z]{2,4})/i,
        /House\s+(?:Bill|B\/L)\s+SCAC[:\s]+([A-Z]{2,4})/i,
        /HBL\s+Carrier[:\s]+([A-Z]{2,4})/i,
        /House\s+Carrier\s+Code[:\s]+([A-Z]{2,4})/i,
        /NVOCC\s+SCAC[:\s]+([A-Z]{2,4})/i,
      ],

      mblScacCode: [
        // Master Bill of Lading SCAC Code patterns
        /(?:MBL|Master)\s+SCAC\s*(?:Code)?[:\s]+([A-Z]{2,4})/i,
        /Master\s+(?:Bill|B\/L)\s+SCAC[:\s]+([A-Z]{2,4})/i,
        /MBL\s+Carrier[:\s]+([A-Z]{2,4})/i,
        /Master\s+Carrier\s+Code[:\s]+([A-Z]{2,4})/i,
        /Ocean\s+Carrier\s+SCAC[:\s]+([A-Z]{2,4})/i,
        /Steamship\s+Line[:\s]+([A-Z]{2,4})/i,
      ],

      htsCode: [
        // HTS Tariff Classification patterns
        /HTS\s*(?:Code|Number)?[:\s]+([0-9]{4,10}(?:\.[0-9]{2,4})*)/i,
        /Tariff\s+(?:Code|Number)[:\s]+([0-9]{4,10}(?:\.[0-9]{2,4})*)/i,
        /Classification[:\s]+([0-9]{4,10}(?:\.[0-9]{2,4})*)/i,
        /HS\s+Code[:\s]+([0-9]{4,10}(?:\.[0-9]{2,4})*)/i,
        /Schedule\s+B[:\s]+([0-9]{4,10}(?:\.[0-9]{2,4})*)/i,
        /Commodity\s+Code[:\s]+([0-9]{4,10}(?:\.[0-9]{2,4})*)/i,
      ],

      commodityDescription: [
        // Commodity/Cargo Description patterns
        /(?:^|\n)\s*(?:10\.?\s*)?(?:Commodity|Cargo)\s+Description[:\s]+([\s\S]*?)(?=\n\s*(?:HTS|Tariff|Weight|$))/i,
        /Goods\s+Description[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Product\s+Description[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Merchandise[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Item\s+Description[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
        /Nature\s+of\s+Goods[:\s]+([^\n]*(?:\n[^\n:]*(?![A-Z][a-z]*:))*)/i,
      ],

      vesselName: [
        // Vessel/Ship Name patterns
        /Vessel\s+Name[:\s]+([^\n]+)/i,
        /Ship\s+Name[:\s]+([^\n]+)/i,
        /(?:M\/V|MV|S\/S|SS)\s+([A-Z][^\n]*)/i,
        /Ocean\s+Vessel[:\s]+([^\n]+)/i,
        /Carrying\s+Vessel[:\s]+([^\n]+)/i,
      ],

      voyageNumber: [
        // Voyage/Trip Number patterns
        /Voyage\s*(?:Number|No\.?|#)?[:\s]+([A-Z0-9\-]+)/i,
        /Trip\s*(?:Number|No\.?|#)?[:\s]+([A-Z0-9\-]+)/i,
        /Flight\s*(?:Number|No\.?|#)?[:\s]+([A-Z0-9\-]+)/i,
      ],

      portOfLoading: [
        // Port of Loading/Origin patterns
        /Port\s+of\s+Loading[:\s]+([^\n]+)/i,
        /Loading\s+Port[:\s]+([^\n]+)/i,
        /Origin\s+Port[:\s]+([^\n]+)/i,
        /Departure\s+Port[:\s]+([^\n]+)/i,
        /From\s+Port[:\s]+([^\n]+)/i,
        /POL[:\s]+([^\n]+)/i,
      ],

      portOfDischarge: [
        // Port of Discharge/Destination patterns
        /Port\s+of\s+Discharge[:\s]+([^\n]+)/i,
        /Discharge\s+Port[:\s]+([^\n]+)/i,
        /Destination\s+Port[:\s]+([^\n]+)/i,
        /Arrival\s+Port[:\s]+([^\n]+)/i,
        /To\s+Port[:\s]+([^\n]+)/i,
        /POD[:\s]+([^\n]+)/i,
      ]
    };
    
    // Extract each field using patterns
    for (const [field, fieldPatterns] of Object.entries(patterns)) {
      console.log(`🔍 Searching for ${field} patterns in document...`);
      for (const pattern of fieldPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
          let extracted = match[1].trim();
          console.log(`✅ Raw match found for ${field}: "${extracted.substring(0, 150)}..."`);
          console.log(`🔧 Pattern used: ${pattern.toString().substring(0, 100)}...`);
          
          // Clean up the extracted text
          extracted = extracted.replace(/\s+/g, ' ').trim();
          extracted = extracted.replace(/\n\s*\n/g, '\n').trim();
          
          // Enhanced validation for meaningful content
          const isLogisticsCompany = extracted.toLowerCase().includes('logistics') || 
                                   extracted.toLowerCase().includes('freight') || 
                                   extracted.toLowerCase().includes('forwarding') ||
                                   extracted.toLowerCase().includes('shipping') ||
                                   extracted.toLowerCase().includes('express');
          
          const isPlaceholder = extracted.toLowerCase().includes('to be provided') || 
                               extracted.toLowerCase().includes('tbd') ||
                               extracted.toLowerCase().includes('n/a') ||
                               extracted.toLowerCase().includes('not applicable') ||
                               extracted.toLowerCase().includes('same as') ||
                               extracted.toLowerCase().includes('see above') ||
                               extracted.toLowerCase().includes('file size');
          
          // Special validation for different field types
          let isValid = false;
          if (field === 'countryOfOrigin') {
            // Country field should be a valid country name or code (relaxed validation)
            isValid = extracted.length >= 2 && extracted.length <= 50 && 
                     !isPlaceholder && !extracted.toLowerCase().includes('file size') &&
                     /^[A-Za-z\s,-]{2,50}$/.test(extracted);
          } else if (field === 'importerOfRecord') {
            // Should be a number/ID format (relaxed validation)
            isValid = extracted.length >= 3 && !isPlaceholder;
          } else if (field === 'containerStuffingLocation') {
            // Should contain geographic location indicators (relaxed validation)
            isValid = extracted.length > 3 && !isPlaceholder && 
                     (/[A-Z]{2,}/.test(extracted) || /\b(?:port|city|state|province|country)\b/i.test(extracted));
          } else if (['hblScacCode', 'mblScacCode'].includes(field)) {
            // SCAC codes should be 2-4 uppercase letters
            isValid = /^[A-Z]{2,4}$/.test(extracted.trim());
          } else if (field === 'htsCode') {
            // HTS codes should be numeric with optional dots
            isValid = /^[0-9]{4,10}(?:\.[0-9]{2,4})*$/.test(extracted.trim());
          } else if (['vesselName', 'voyageNumber', 'portOfLoading', 'portOfDischarge'].includes(field)) {
            // Transportation related fields (relaxed validation)
            isValid = extracted.length >= 2 && extracted.length <= 200 && !isPlaceholder;
          } else if (field === 'commodityDescription') {
            // Commodity descriptions should be substantial (relaxed validation)
            isValid = extracted.length >= 3 && extracted.length <= 1000 && !isPlaceholder;
          } else {
            // Standard validation for company/party fields (ultra-relaxed validation)
            isValid = extracted.length > 2 && 
                     !isPlaceholder &&
                     // Allow logistics companies for consolidator field
                     !(field === 'seller' && isLogisticsCompany) &&
                     !(field === 'manufacturer' && isLogisticsCompany);
          }
          
          if (isValid) {
            result[field] = extracted;
            console.log(`📋 ISF PATTERN MATCHED ${field.toUpperCase()}: ${extracted.substring(0, 100)}...`);
            break; // Use first valid match
          } else {
            const reason = isPlaceholder ? 'placeholder text' : 
                          (field === 'seller' && isLogisticsCompany) ? 'logistics company as seller' :
                          (field === 'manufacturer' && isLogisticsCompany) ? 'logistics company as manufacturer' :
                          field === 'countryOfOrigin' ? 'invalid country format' :
                          field === 'importerOfRecord' ? 'invalid ID format' :
                          field === 'containerStuffingLocation' ? 'no geographic indicators' :
                          ['hblScacCode', 'mblScacCode'].includes(field) ? 'invalid SCAC code format' :
                          field === 'htsCode' ? 'invalid HTS code format' :
                          ['vesselName', 'voyageNumber', 'portOfLoading', 'portOfDischarge'].includes(field) ? 'invalid transportation field' :
                          field === 'commodityDescription' ? 'invalid commodity description' :
                          'too short or invalid';
            console.log(`❌ Rejected ${field} match: ${reason}`);
          }
        } else {
          console.log(`❌ No match for ${field} pattern: ${pattern.toString().substring(0, 50)}...`);
        }
      }
    }
    
    return result;
  }

  /**
   * Extract text from PDF using direct PDF analysis or vision API
   */
  private async extractPDFText(filePath: string): Promise<string> {
    try {
      console.log(`Starting PDF text extraction for: ${filePath}`);
      
      // convertPDFToBase64Image now returns extracted text directly
      const extractedText = await this.convertPDFToBase64Image(filePath);
      
      console.log(`Successfully extracted ${extractedText.length} characters from PDF`);
      
      if (extractedText.length < 50) {
        throw new Error('Insufficient text extracted from PDF');
      }
      
      return extractedText.trim();
      
    } catch (error: any) {
      console.error('PDF text extraction failed:', error);
      throw new Error(`PDF text extraction failed: ${error.message}`);
    }
  }

  /**
   * Extract comprehensive data using OpenAI
   */
  private async extractComprehensiveData(fullText: string): Promise<ExtractedShipmentData> {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are a shipping document expert specializing in ISF (Importer Security Filing) and Bills of Lading. Extract comprehensive data with special attention to ISF-specific fields. Return JSON with ALL found values using exact field names:

            {
              "billOfLadingNumber": "B/L number if found",
              "airWaybillNumber": "AWB number for air shipments if found",
              "vesselAndVoyage": "vessel name and voyage if found", 
              "containerNumber": "container number if found",
              "containerType": "container type if found",
              "sealNumbers": ["seal numbers array if found"],
              "portOfLoading": "port of loading if found",
              "portOfDischarge": "port of discharge if found", 
              "placeOfReceipt": "place of receipt if found",
              "placeOfDelivery": "place of delivery if found",
              "shipperName": "shipper name if found",
              "shipperAddress": "shipper address if found",
              "shipperCity": "shipper city if found",
              "shipperState": "shipper state if found",
              "shipperZipCode": "shipper zip if found",
              "shipperCountry": "shipper country if found",
              "shipperContactPerson": "shipper contact if found",
              "shipperPhone": "shipper phone if found", 
              "shipperEmail": "shipper email if found",
              "consigneeName": "consignee name if found",
              "consigneeAddress": "consignee address if found",
              "consigneeCity": "consignee city if found",
              "consigneeState": "consignee state if found",
              "consigneeZipCode": "consignee zip if found",
              "consigneeCountry": "consignee country if found",
              "consigneeContactPerson": "consignee contact if found",
              "consigneePhone": "consignee phone if found",
              "consigneeEmail": "consignee email if found",
              "notifyPartyName": "notify party name if found",
              "notifyPartyAddress": "notify party address if found",
              "manufacturerName": "CRITICAL for ISF: Manufacturer/supplier company name - look for 'MANUFACTURER', 'SUPPLIER', 'FACTORY' fields. The company that actually MADE the goods, NOT logistics company",
              "manufacturerAddress": "CRITICAL for ISF: Complete manufacturer address including country where goods were manufactured",
              "manufacturerCountry": "CRITICAL for ISF: Country where goods were manufactured - look for 'COUNTRY OF MANUFACTURE', 'MADE IN'",
              "manufacturerInformation": "CRITICAL for ISF: Complete manufacturer information including name and address",
              "sellerName": "CRITICAL for ISF: Extract EXACTLY what appears after 'SELLER:' or 'VENDOR:' labels in the document - do NOT make assumptions about logistics vs manufacturing companies",
              "sellerAddress": "CRITICAL for ISF: Complete seller address exactly as written in the document",
              "sellerInformation": "CRITICAL for ISF: Complete seller information exactly as provided in the ISF document - preserve original data",
              "buyerName": "Buyer/purchaser company name - the entity purchasing the goods",
              "buyerAddress": "Buyer complete address",
              "cargoDescription": "cargo description if found",
              "commodity": "commodity type if found", 
              "numberOfPackages": "number of packages as integer if found",
              "kindOfPackages": "package type if found",
              "grossWeight": "gross weight as number if found",
              "netWeight": "net weight as number if found",
              "weight": "weight string if found",
              "weightUnit": "weight unit if found",
              "volume": "volume as number if found",
              "volumeUnit": "volume unit if found",
              "measurement": "measurement if found",
              "marksAndNumbers": "marks and numbers if found",
              "bookingNumber": "booking number if found",
              "freightCharges": "freight charges as number if found",
              "freightPaymentTerms": "payment terms if found",
              "declaredValue": "declared value as number if found",
              "currency": "currency if found",
              "countryOfOrigin": "country of origin if found",
              "htsCode": "HTS code if found",
              "dateOfShipment": "shipment date if found",
              "onBoardDate": "on board date if found",
              "eta": "ETA if found",
              "etd": "ETD if found",
              "containerStuffingLocation": "CRITICAL ISF FIELD: Extract the EXACT location where container was stuffed/loaded. Look for specific ISF field labels: 'Container Stuffing Location:', 'CONTAINER STUFFING LOCATION', 'Stuffing Location', 'Place of Stuffing', 'CFS Location', 'Container Packing Location'. Extract the COMPLETE address or location that appears after these labels - this can be either a geographic location (city, port, country) OR a facility address depending on how it appears in the ISF document. Priority: Use EXACT text from ISF form fields over inferred locations.",
              "containerStuffing": "any container stuffing related information if found",
              "stuffingLocation": "stuffing location if found",
              "consolidatorName": "ISF CRITICAL: Consolidator/Container Stuffer company name - look for labels: 'Consolidator Name', 'Container Stuffer', 'CFS Operator', 'Consolidator Information', 'Consolidator/Stuffer'. This is DIFFERENT from shipper - extract the company that consolidated/stuffed the container",
              "consolidatorStufferInfo": "ISF CRITICAL: COMPLETE consolidator information including FULL company name AND complete address (all lines, room numbers, floor, building, street, district, city, country, postal code) - scan multiple lines after consolidator labels to capture complete address information. Look for patterns like 'ROOM XX, XXth FLOOR, BUILDING XX, NO.XX STREET, DISTRICT, CITY, COUNTRY'",
              "consolidatorAddress": "Complete consolidator address with all lines (street, room, floor, building, district, city, country, postal code)",
              "consolidatorInformation": "ISF field: Consolidator details",
              "consolidator": "ISF field: Consolidator company"
            }

            CRITICAL ISF EXTRACTION RULES:
            1. For ISF documents: Consolidator ≠ Shipper. Look specifically for consolidator/stuffer company names
            2. SCAN MULTIPLE LINES for consolidator address - look for complete address spanning 2-3 lines after consolidator name
            3. Container stuffing location: Extract EXACTLY what appears after "Container Stuffing Location:" or similar ISF labels
            4. Consolidator is the company that consolidated/stuffed the container (often freight forwarder/CFS operator)
            5. Pay special attention to company names that appear multiple times or in consolidator-specific sections
            6. Look for exact field labels: "Container Stuffer/Consolidator", "Consolidator Information", "Container Stuffing Location"
            7. If you see "Container Stuffer/Consolidator:" followed by a company name, use that EXACT value for consolidatorName
            8. If you see "Container Stuffing Location:" followed by a location, use that EXACT value for containerStuffingLocation
            9. Do NOT use shipper information for consolidator fields - these are distinct entities
            10. For consolidator address: Scan the lines immediately following consolidator name for complete address (room, floor, building, street, district, city, country)
            11. Look throughout the entire document for these specific ISF field labels before falling back to general extraction

            CRITICAL: Only include fields where you find actual values in the provided document text. Do not include fields with null, "not found", "N/A", etc. DO NOT generate example data. If the document text is empty or corrupted, return empty JSON {}. Only extract data that actually exists in the document.`
          },
          {
            role: "user",
            content: `Extract all shipping data from this COMPLETE document text. Pay special attention to consolidator information throughout the entire document. CRITICAL: Extract ONLY the actual text content from the document - do NOT generate examples or placeholder data. If no data exists in the document, return empty JSON {}. Document text length: ${fullText.length} characters.\n\nDOCUMENT TEXT:\n${fullText}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8000
      });

      const result = completion.choices[0].message.content;
      if (!result) {
        throw new Error('No response from OpenAI analysis');
      }

      const extractedData = JSON.parse(result) as ExtractedShipmentData;
      console.log('OpenAI extracted fields:', Object.keys(extractedData));
      
      return this.validateAndCleanData(extractedData);
      
    } catch (error: any) {
      console.error('OpenAI comprehensive extraction failed:', error);
      return {};
    }
  }

  /**
   * Validate and clean extracted data
   */
  private validateAndCleanData(data: ExtractedShipmentData): ExtractedShipmentData {
    const cleaned: ExtractedShipmentData = {};
    
    // Only include fields that have meaningful values
    Object.entries(data).forEach(([key, value]) => {
      if (value && 
          typeof value === 'string' && 
          value.trim().length > 0 && 
          !value.toLowerCase().includes('not found') &&
          !value.toLowerCase().includes('n/a') &&
          value.trim() !== '-' &&
          value.trim() !== 'tbd') {
        (cleaned as any)[key] = value.trim();
      } else if (typeof value === 'boolean') {
        (cleaned as any)[key] = value;
      }
    });

    return cleaned;
  }

  /**
   * Extract data from image-based PDFs using vision API
   */
  async extractFromImagePDF(filePath: string): Promise<ExtractedShipmentData> {
    try {
      // Convert PDF to image and analyze with vision
      const base64Image = await this.convertPDFToBase64Image(filePath);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze this shipping document image and extract structured data. Look for bill of lading numbers, vessel names, container numbers, shipper/consignee information, ports, dates, cargo details, etc. Return as JSON with only found values.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1500
      });

      const result = completion.choices[0].message.content;
      if (!result) {
        throw new Error('No response from vision analysis');
      }

      return JSON.parse(result) as ExtractedShipmentData;

    } catch (error) {
      console.error('Vision-based extraction failed:', error);
      throw error;
    }
  }

  /**
   * Convert PDF to base64 image for vision analysis
   */
  private async convertPDFToBase64Image(filePath: string): Promise<string> {
    try {
      // Read PDF file as buffer and convert to base64 for direct upload
      const pdfBuffer = fs.readFileSync(filePath);
      const base64Pdf = pdfBuffer.toString('base64');
      
      console.log(`Read PDF buffer: ${pdfBuffer.length} bytes, base64: ${base64Pdf.length} chars`);
      
      // Send the PDF directly to OpenAI vision for analysis
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this COMPLETE PDF document and extract all text content from every page and section. Focus on shipping information like vessel names, container numbers, B/L numbers, company names, addresses, ports, dates, cargo details, etc. Pay special attention to consolidator/container stuffer information, ISF field #8 data, and company names throughout the entire document including headers, footers, and signature areas. Return the raw text exactly as it appears in the document."
              },
              {
                type: "image_url", 
                image_url: {
                  url: `data:application/pdf;base64,${base64Pdf}`
                }
              }
            ]
          }
        ],
        max_tokens: 8000
      });

      const extractedText = completion.choices[0].message.content || '';
      
      if (extractedText.length < 50) {
        throw new Error('Insufficient text extracted from PDF');
      }
      
      console.log(`Direct PDF analysis extracted ${extractedText.length} characters`);
      return extractedText;
      
    } catch (directError) {
      console.log('Direct PDF analysis failed, trying pdf2pic conversion...');
      
      try {
        const convert = pdf2pic.fromPath(filePath, {
          density: 100,
          saveFilename: "untitled",
          savePath: "./temp",
          format: "jpeg",
          width: 1700,
          height: 2200
        });
        
        const result = await convert(1); // Convert first page
        if (result && result.path) {
          const imageBuffer = fs.readFileSync(result.path);
          return imageBuffer.toString('base64');
        }
        
        throw new Error('Failed to convert PDF to image');
      } catch (convertError: any) {
        console.error('Both PDF processing methods failed:', { directError, convertError });
        throw new Error(`PDF processing failed: ${(directError as any).message}`);
      }
    }
  }

  /**
   * Extract data using Azure Document Intelligence
   */
  private async extractWithAzure(filePath: string): Promise<ExtractedShipmentData> {
    try {
      const documentBuffer = fs.readFileSync(filePath);
      
      // Use Azure's general document model for comprehensive extraction
      const poller = await azureClient.beginAnalyzeDocument("prebuilt-document", documentBuffer);
      const result = await poller.pollUntilDone();
      
      // Extract all text content
      let fullText = '';
      if (result.content) {
        fullText = result.content;
      }
      
      console.log(`Azure extracted ${fullText.length} characters of text`);
      
      // Parse the extracted content using structured field extraction
      const extractedData: ExtractedShipmentData = {};
      
      // Extract key-value pairs from Azure results
      if (result.keyValuePairs) {
        for (const kvPair of result.keyValuePairs) {
          if (kvPair.key && kvPair.value) {
            const key = kvPair.key.content.toLowerCase().replace(/[^a-z0-9]/g, '');
            const value = kvPair.value.content;
            
            // Map common shipping document fields
            this.mapAzureField(extractedData, key, value);
          }
        }
      }
      
      // Extract table data if present
      if (result.tables) {
        for (const table of result.tables) {
          this.extractTableData(extractedData, table);
        }
      }
      
      // Always enhance with OpenAI for comprehensive data
      console.log('Enhancing Azure data with OpenAI analysis...');
      const openaiData = await this.extractComprehensiveData(fullText);
      
      console.log('Azure extracted data:', extractedData);
      console.log('OpenAI extracted data:', openaiData);
      
      // Merge Azure and OpenAI results, preferring Azure for structured data
      const mergedData = this.mergeExtractionResults(extractedData, openaiData);
      console.log('Final merged data:', mergedData);
      
      return mergedData;
      
    } catch (error) {
      console.error('Azure extraction failed:', error);
      throw error;
    }
  }

  /**
   * Map Azure field to our data structure
   */
  private mapAzureField(data: ExtractedShipmentData, key: string, value: string): void {
    const fieldMappings: Record<string, keyof ExtractedShipmentData> = {
      'billoflading': 'billOfLadingNumber',
      'blnumber': 'billOfLadingNumber',
      'vessel': 'vesselAndVoyage',
      'voyagenumber': 'vesselAndVoyage',
      'container': 'containerNumber',
      'containernumber': 'containerNumber',
      'shipper': 'shipperName',
      'consignee': 'consigneeName',
      'portofloading': 'portOfLoading',
      'portofdischarge': 'portOfDischarge',
      'grossweight': 'weight',
      'packages': 'numberOfPackages',
      'commodity': 'cargoDescription',
      'booking': 'bookingNumber',
      // ISF consolidator field mappings
      'consolidator': 'consolidatorName',
      'consolidatorname': 'consolidatorName',
      'consolidatorinformation': 'consolidatorInformation',
      'containerstuffer': 'containerStuffer',
      'cfsoperator': 'cfsOperator',
      'cfsfacility': 'cfsFacility',
      'stuffername': 'stufferName',
      'amsnumber': 'amsNumber',
      'amsno': 'amsNumber',
      // Manufacturer and seller field mappings
      'manufacturer': 'manufacturerName',
      'manufacturername': 'manufacturerName',
      'manufactureraddress': 'manufacturerAddress',
      'manufacturercountry': 'manufacturerCountry',
      'manufacturerinformation': 'manufacturerInformation',
      'seller': 'sellerName',
      'sellername': 'sellerName',
      'selleraddress': 'sellerAddress',
      'sellerinformation': 'sellerInformation',
      'supplier': 'manufacturerName',
      'vendor': 'sellerName',
      'buyer': 'buyerName',
      'buyername': 'buyerName',
      'buyeraddress': 'buyerAddress'
    };
    
    if (fieldMappings[key]) {
      (data as any)[fieldMappings[key]] = value;
    }
  }

  /**
   * Extract data from table structures
   */
  private extractTableData(data: ExtractedShipmentData, table: any): void {
    // Look for common shipping document table patterns
    for (const cell of table.cells) {
      const content = cell.content.toLowerCase();
      
      if (content.includes('container') && content.includes('number')) {
        // Try to extract container number from adjacent cells
        const containerMatch = cell.content.match(/[A-Z]{4}\d{7}/);
        if (containerMatch) {
          data.containerNumber = containerMatch[0];
        }
      }
    }
  }

  /**
   * Check if extraction has significant data
   */
  private hasSignificantData(data: ExtractedShipmentData): boolean {
    const significantFields = [
      'billOfLadingNumber', 'airWaybillNumber', 'vesselAndVoyage', 'containerNumber', 
      'shipperName', 'consigneeName', 'portOfLoading', 'portOfDischarge',
      // Add ISF-specific fields that Azure might extract
      'manufacturerName', 'manufacturerInformation', 'consolidatorName', 'consolidatorStufferInfo',
      'containerStuffingLocation', 'sellerName', 'sellerInformation'
    ];
    
    const foundFields = significantFields.filter(field => 
      (data as any)[field] && String((data as any)[field]).trim().length > 2
    );
    
    console.log(`🔍 SIGNIFICANCE CHECK: Found ${foundFields.length} significant fields:`, foundFields);
    
    return foundFields.length >= 2;
  }

  /**
   * Merge results from Azure and OpenAI
   */
  private mergeExtractionResults(azureData: ExtractedShipmentData, openaiData: ExtractedShipmentData): ExtractedShipmentData {
    const merged = { ...openaiData };
    
    // Prefer Azure data for key fields (more structured)
    const azurePreferredFields = [
      'billOfLadingNumber', 'airWaybillNumber', 'containerNumber', 'vesselAndVoyage',
      'portOfLoading', 'portOfDischarge', 'numberOfPackages'
    ];
    
    for (const field of azurePreferredFields) {
      if ((azureData as any)[field]) {
        (merged as any)[field] = (azureData as any)[field];
      }
    }
    
    return merged;
  }
}

export const aiDocProcessor = new AIDocumentProcessor();