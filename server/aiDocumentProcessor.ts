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
}

export class AIDocumentProcessor {
  
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
    try {
      // Try Azure Document Intelligence first (better for structured documents)
      try {
        console.log('Using Azure Document Intelligence for document processing...');
        const azureResult = await this.extractWithAzure(filePath);
        
        if (this.hasSignificantData(azureResult)) {
          console.log('Azure extraction successful, using Azure data');
          return azureResult;
        } else {
          console.log('Azure extraction yielded minimal data, trying OpenAI enhancement...');
        }
      } catch (azureError: any) {
        console.log('Azure processing failed, falling back to OpenAI:', azureError.message);
      }

      // Fallback to OpenAI processing
      console.log('Testing OpenAI connection...');
      const connectionTest = await this.testConnection();
      if (!connectionTest) {
        throw new Error('OpenAI connection failed');
      }
      console.log('OpenAI connection successful');

      // Try to extract text from PDF, fallback to image analysis if needed
      let pdfText = '';
      let useImageAnalysis = false;
      
      try {
        pdfText = await this.extractPDFText(filePath);
        console.log(`Extracted ${pdfText.length} characters from PDF`);
      } catch (pdfError) {
        console.log('PDF text extraction failed, using direct file analysis');
        useImageAnalysis = true;
        // Use filename and file metadata for AI analysis
        const fileName = filePath.split('/').pop() || '';
        const stats = fs.statSync(filePath);
        pdfText = `Document: ${fileName}\nFile size: ${stats.size} bytes\nDocument type: ${documentType}\nThis PDF requires analysis for shipping data extraction.`;
      }

      if (!pdfText || pdfText.length < 10) {
        throw new Error('Unable to extract sufficient content from PDF');
      }

      console.log(`Sending ${pdfText.length} characters to AI for analysis`);

      // Enhanced ISF-specific extraction for ISF Information Sheets
      const isISFDocument = documentType === 'isf_information_sheet' || documentType === 'isf information sheet' || documentType.toLowerCase().includes('isf');
      console.log(`🔍 DOCUMENT TYPE CHECK: "${documentType}" - ISF extraction triggered: ${isISFDocument}`);
      
      if (isISFDocument) {
        console.log('🎯 SPECIALIZED ISF EXTRACTION: Processing ISF Information Sheet with targeted field extraction');
        console.log(`📄 PDF Text Preview (first 500 chars): ${pdfText.substring(0, 500)}`);
        
        // Add specific pattern checks to debug the extraction
        console.log('🔍 Looking for ISF field patterns in document...');
        const hasContainerStuffing = /container\s*stuffing\s*location/i.test(pdfText);
        const hasShipToParty = /ship\s*to\s*party/i.test(pdfText);
        const hasHblScac = /hbl\s*scac/i.test(pdfText);
        const hasMblScac = /mbl\s*scac/i.test(pdfText);
        
        console.log(`Pattern checks - Container Stuffing: ${hasContainerStuffing}, Ship To Party: ${hasShipToParty}, HBL SCAC: ${hasHblScac}, MBL SCAC: ${hasMblScac}`);
        
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
              content: `Extract ISF field data from this document text. Pay attention to field labels and extract the complete text that appears after each label:\n\n${pdfText}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.1
        });

        let isfData: any = {};
        try {
          isfData = JSON.parse(isfCompletion.choices[0].message.content || '{}');
          console.log('🎯 ISF-SPECIFIC EXTRACTION RESULT:', isfData);
          
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

${pdfText.substring(0, 8000)}`
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
      console.log(`📄 Document text length: ${pdfText?.length || 0} characters`);
      console.log(`🔍 Current extracted consolidator data:`, {
        consolidatorName: extractedData.consolidatorName,
        consolidatorStufferInfo: extractedData.consolidatorStufferInfo,
        consolidatorInformation: extractedData.consolidatorInformation,
        consolidator: extractedData.consolidator,
        containerStuffer: extractedData.containerStuffer,
        stufferName: extractedData.stufferName
      });
      
      // Show preview of document text for ISF documents
      if (pdfText && documentType === 'isf_information_sheet') {
        console.log(`📋 DOCUMENT PREVIEW (first 500 chars):`, pdfText.substring(0, 500));
        console.log(`📋 DOCUMENT PREVIEW (last 300 chars):`, pdfText.substring(Math.max(0, pdfText.length - 300)));
      }
      
      if (!extractedData.consolidatorName && !extractedData.consolidatorStufferInfo && pdfText && documentType === 'isf_information_sheet') {
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
          const match = pdfText.match(pattern);
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
            while ((match = pattern.exec(pdfText)) !== null) {
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
            while ((match = pattern.exec(pdfText)) !== null) {
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
      if (pdfText && isISFDocument) {
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
        
        // Try to extract seller information if not already found (often different from shipper in ISF)
        if (!extractedData.sellerName && !extractedData.sellerInformation) {
          // Look for seller patterns in the document
          const sellerPatterns = [
            /SELLER\s*:\s*([^\n\r]+)/i,
            /VENDOR\s*:\s*([^\n\r]+)/i,
            /SOLD BY\s*:\s*([^\n\r]+)/i,
            /SUPPLIER\s*:\s*([^\n\r]+)/i
          ];
          
          for (const pattern of sellerPatterns) {
            const match = pdfText.match(pattern);
            if (match && match[1]) {
              let seller = match[1].trim();
              seller = seller.replace(/\s+/g, ' ').trim();
              
              if (seller.length > 3 && seller !== extractedData.shipperName) {
                console.log(`🎯 SELLER EXTRACTED: ${seller}`);
                extractedData.sellerName = seller;
                extractedData.sellerInformation = seller;
                break;
              }
            }
          }
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
              "sellerName": "CRITICAL for ISF: Seller company name - look for 'SELLER', 'VENDOR' fields. Who is SELLING the goods, often different from shipper",
              "sellerAddress": "CRITICAL for ISF: Complete seller address - business address of the selling entity",
              "sellerInformation": "CRITICAL for ISF: Complete seller information including name and address",
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
              "containerStuffingLocation": "CRITICAL: Extract ONLY the physical geographic location where container stuffing occurred. Look for 'Container Stuffing Location:', 'CONTAINER STUFFING LOCATION', 'Stuffing Location', 'Place of Stuffing', 'CFS Location'. Extract ONLY the city, port, and country (e.g., 'BUSAN, SOUTH KOREA', 'QINGDAO, CHINA', 'SHANGHAI, CHINA'). DO NOT extract company names or business addresses - this field is for the PHYSICAL LOCATION where stuffing happened, NOT the company that did the stuffing.",
              "containerStuffing": "any container stuffing related information if found",
              "stuffingLocation": "stuffing location if found",
              "consolidatorName": "ISF CRITICAL: Consolidator/Container Stuffer company name - look for labels: 'Consolidator Name', 'Container Stuffer', 'CFS Operator', 'Consolidator Information', 'Consolidator/Stuffer'. This is DIFFERENT from shipper - extract the company that consolidated/stuffed the container",
              "consolidatorStufferInfo": "ISF CRITICAL: Complete consolidator information including name and address - specifically the entity that stuffed/consolidated the container",
              "consolidatorInformation": "ISF field: Consolidator details",
              "consolidator": "ISF field: Consolidator company"
            }

            CRITICAL ISF EXTRACTION RULES:
            1. For ISF documents: Consolidator ≠ Shipper. Look specifically for consolidator/stuffer company names
            2. Container stuffing location should be the EXACT physical address where goods were stuffed
            3. Consolidator is the company that consolidated/stuffed the container (often freight forwarder/CFS operator)
            4. Pay special attention to company names that appear multiple times or in consolidator-specific sections
            5. Look for exact field labels: "Container Stuffer/Consolidator", "Consolidator Information", "Container Stuffing Location"
            6. If you see "Container Stuffer/Consolidator:" followed by a company name, use that EXACT value for consolidatorName
            7. If you see "Container Stuffing Location:" followed by a location, use that EXACT value for containerStuffingLocation
            8. Do NOT use shipper information for consolidator fields - these are distinct entities
            9. Look throughout the entire document for these specific ISF field labels before falling back to general extraction

            Only include fields where you find actual values. Do not include fields with null, "not found", "N/A", etc.`
          },
          {
            role: "user",
            content: `Extract all shipping data from this COMPLETE document text. Pay special attention to consolidator information throughout the entire document:\n\n${fullText}`
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
      'shipperName', 'consigneeName', 'portOfLoading', 'portOfDischarge'
    ];
    
    const foundFields = significantFields.filter(field => 
      (data as any)[field] && String((data as any)[field]).trim().length > 2
    );
    
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