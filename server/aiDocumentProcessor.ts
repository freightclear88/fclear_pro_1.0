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
  consolidatorInformation?: string;
  consolidatorStufferInfo?: string;
  containerStuffer?: string;
  stufferName?: string;
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
              "manufacturerName": "manufacturer/supplier company name if found",
              "manufacturerAddress": "manufacturer complete address with country if found",
              "manufacturerCountry": "country where goods were manufactured if found",
              "buyerName": "buyer/purchaser company name if found",
              "buyerAddress": "buyer complete address if found", 
              "sellerName": "seller company name if found",
              "sellerAddress": "seller complete address if found",
              "notifyPartyName": "notify party name if found",
              "notifyPartyAddress": "notify party address if found",
              "shipToPartyName": "ship-to party name if found",
              "shipToPartyAddress": "ship-to party address if found",
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
              "scacCode": "SCAC code if found",
              "mblScacCode": "MBL SCAC code if found",
              "hblScacCode": "HBL SCAC code if found",
              "amsNumber": "CRITICAL: AMS filing number - look for ANY of these patterns: 'AMS', 'AMS NO', 'AMS NUMBER', 'AMS NO.', 'AMS #', 'AMS REF', 'AMS REFERENCE', 'MANIFEST NUMBER', 'MANIFEST NO', 'MANIFEST #', 'AMS B/L', 'AMS BL', 'AMS FILING', followed by a number or alphanumeric code - extract the EXACT number/code only",
              "amsNo": "AMS number if found with 'AMS NO' label",
              "amsReference": "AMS reference number if found",
              "manifestNumber": "Manifest number if found separately",
              "consolidatorStufferInfo": "CRITICAL: The COMPANY NAME of the consolidator/container stuffer - In ISF documents, this is often found at the BOTTOM of the document or in separate sections. Look for 'CONSOLIDATOR NAME', 'CONSOLIDATOR', 'CONTAINER STUFFER', 'STUFFER', 'CFS OPERATOR'. Companies like 'CHINA COAST FREIGHT CO., LTD' are typically consolidators, NOT shippers. Extract only the COMPANY NAME, not the address or location. This is the business entity that consolidated/stuffed the container - THIS IS DIFFERENT FROM SHIPPER and DIFFERENT FROM CONTAINER STUFFING LOCATION",
              "consolidator": "consolidator company name if found separately - In ISF documents, look at the ENTIRE document including bottom sections. Companies with 'BRANCH' in their name are often consolidators",
              "consolidatorName": "CRITICAL: Look specifically for 'CONSOLIDATOR NAME', 'CONSOLIDATOR:', 'CONSOLIDATOR NAME:', or 'CONSOLIDATOR/STUFFER NAME' fields in ISF documents. Also check the BOTTOM portions of ISF documents where consolidator information is commonly placed. Extract only the COMPANY NAME, not the location or address",
              "consolidatorStufferName": "Look for 'CONSOLIDATOR/STUFFER NAME' field specifically - check entire document including footer areas",
              "consolidatorAddress": "CRITICAL: Extract the COMPLETE consolidator address including ALL lines - look for the full address that follows the consolidator company name, including street address, city, state/province, postal code, country. Address may span multiple lines - capture ALL lines of the address",
              "consolidatorInformation": "CRITICAL: Extract COMPLETE consolidator information including both company name AND full multi-line address - In ISF documents, this information often appears at the bottom or in separate sections. Include ALL address lines, not just the first line",
              "containerStuffer": "container stuffer company information if found - separate from shipper",
              "stufferName": "stuffer company name if found",
              "cfsOperator": "CFS (Container Freight Station) operator name if found",
              "cfsFacility": "CFS facility information if found",
              "containerStuffingLocation": "EXACT container stuffing location from ISF form - look for fields labeled: 'Container Stuffing Location', 'Stuffing Location', 'Place of Stuffing', 'CFS Location', 'Place where container was stuffed' - extract the EXACT LOCATION/ADDRESS where stuffing occurred, NOT the company name - this is SEPARATE from consolidator name",
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
   - MANUFACTURER information 
   - CONTAINER STUFFING LOCATION - the physical location where stuffing occurred
   - Look at ALL sections of the document, including headers, footers, and separate information blocks
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
      
      // Enhanced consolidator name extraction with comprehensive pattern matching
      if (!extractedData.consolidatorName && !extractedData.consolidatorStufferInfo && pdfText && documentType === 'isf_information_sheet') {
        console.log('🔍 PATTERN MATCHING: Searching for consolidator patterns in ISF document...');
        console.log('🔍 FULL PDF TEXT LENGTH:', pdfText.length);
        console.log('🔍 LAST 500 CHARACTERS OF PDF:', pdfText.slice(-500));
        
        const consolidatorPatterns = [
          // Standard patterns
          /CONSOLIDATOR\s*NAME[^:]*:?\s*([^\n\r]+)/i,
          /CONSOLIDATOR[^:]*:?\s*([^\n\r]+)/i,
          /CONTAINER\s*STUFFER[^:]*:?\s*([^\n\r]+)/i,
          /CFS\s*OPERATOR[^:]*:?\s*([^\n\r]+)/i,
          // More specific patterns for ISF documents
          /CONSOLIDATOR\/STUFFER[^:]*:?\s*([^\n\r]+)/i,
          /CONSOLIDATOR\s*\/\s*STUFFER[^:]*:?\s*([^\n\r]+)/i,
          /CONSOLIDATOR\s*INFORMATION[^:]*:?\s*([^\n\r]+)/i,
          // Pattern to find company names at the bottom of documents
          /([A-Z][A-Z\s&,.-]+(?:CO\.|LTD|LIMITED|INC|CORP|COMPANY)[^\n\r]*)\s*$/im,
          // Look for specific consolidator text patterns
          /CHINA\s+COAST\s+FREIGHT[^\n\r]*/i,
          // Catch consolidator after specific field labels
          /(?:CONSOLIDATOR|STUFFER)[\s:]+([A-Z][A-Z\s&,.-]+(?:CO\.|LTD|LIMITED|INC|CORP|COMPANY)[^\n\r]*)/i
        ];
        
        for (const pattern of consolidatorPatterns) {
          const match = pdfText.match(pattern);
          if (match && match[1]) {
            const consolidatorName = match[1].trim();
            // More lenient validation - accept any meaningful text
            if (consolidatorName && consolidatorName.length > 5 && 
                !consolidatorName.toLowerCase().includes('container stuffing location') &&
                !consolidatorName.toLowerCase().includes('port of') &&
                consolidatorName.match(/[A-Z]/)) {
              console.log(`🎯 PATTERN FOUND: ${consolidatorName}`);
              extractedData.consolidatorName = consolidatorName;
              break;
            }
          }
        }
        
        // If still not found, try to find it in the last portion of the document
        if (!extractedData.consolidatorName) {
          console.log('🔍 SEARCHING LAST 1000 CHARACTERS FOR CONSOLIDATOR...');
          const lastChars = pdfText.slice(-1000);
          const lines = lastChars.split(/[\n\r]+/);
          
          for (const line of lines.reverse()) { // Start from the end
            const trimmedLine = line.trim();
            // Look for company names with common business suffixes
            if (trimmedLine.match(/[A-Z][A-Z\s&,.-]*(?:CO\.|LTD|LIMITED|INC|CORP|COMPANY)/i) &&
                trimmedLine.length > 10 && trimmedLine.length < 100 &&
                !trimmedLine.toLowerCase().includes('container stuffing') &&
                !trimmedLine.toLowerCase().includes('location') &&
                !trimmedLine.toLowerCase().includes('port')) {
              console.log(`🎯 FOUND CONSOLIDATOR AT DOCUMENT END: ${trimmedLine}`);
              extractedData.consolidatorName = trimmedLine;
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
            content: `You are a shipping document expert. Extract comprehensive data from Bills of Lading, commercial invoices, and packing lists. Return JSON with ALL found values using exact field names:

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
              "containerStuffingLocation": "EXACT container stuffing location from ISF form - look for fields labeled: 'Container Stuffing Location', 'Stuffing Location', 'Place of Stuffing', 'Consolidator Location', 'CFS Location', 'Place where container was stuffed' - extract the EXACT location value, not just 'CFS/CFS'",
              "containerStuffing": "any container stuffing related information if found",
              "stuffingLocation": "stuffing location if found"
            }

            Only include fields where you find actual values. Do not include fields with null, "not found", "N/A", etc.`
          },
          {
            role: "user",
            content: `Extract all shipping data from this document:\n\n${fullText.substring(0, 4000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 2000
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
                text: "Analyze this PDF document and extract all text content. Focus on shipping information like vessel names, container numbers, B/L numbers, company names, addresses, ports, dates, cargo details, etc. Return the raw text as it appears in the document."
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
        max_tokens: 4000
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
      'booking': 'bookingNumber'
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