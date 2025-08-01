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
  
  // Consignee information
  consigneeName?: string;
  consigneeAddress?: string;
  consigneeCity?: string;
  consigneeState?: string;
  consigneeZipCode?: string;
  consigneeCountry?: string;
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
            content: `Extract comprehensive shipping data from Ocean Bill of Lading and related documents. Return JSON with all found values:
            {
              "billOfLadingNumber": "B/L number if found",
              "vesselAndVoyage": "vessel name and voyage number if found",
              "containerNumber": "container number if found",
              "containerType": "container type (e.g., 40HC, 20GP) if found",
              "sealNumbers": ["seal numbers array if found"],
              "portOfLoading": "port of loading if found",
              "portOfDischarge": "port of discharge if found",
              "placeOfReceipt": "place of receipt if found",
              "placeOfDelivery": "place of delivery if found",
              "shipperName": "shipper company name if found",
              "shipperAddress": "shipper address if found",
              "consigneeName": "consignee company name if found",
              "consigneeAddress": "consignee address if found",
              "notifyPartyName": "notify party name if found",
              "notifyPartyAddress": "notify party address if found",
              "cargoDescription": "cargo description if found",
              "numberOfPackages": "number of packages as integer if found",
              "packageType": "package type (e.g., cartons, pallets) if found",
              "weight": "weight with unit if found",
              "grossWeight": "gross weight as number if found",
              "countryOfOrigin": "country of origin if found",
              "dateIssued": "date issued if found",
              "eta": "estimated arrival date if found",
              "onBoardDate": "on board date if found",
              "bookingNumber": "booking reference if found"
            }`
          },
          {
            role: "user",
            content: `Extract comprehensive shipping data from this ${documentType}:\n\n${pdfText.substring(0, 4000)}`
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
            content: `Extract comprehensive shipping data from Ocean Bill of Lading and related documents. Return JSON with all found values.`
          },
          {
            role: "user",
            content: `Extract all shipping data from this document:\n\n${fullText.substring(0, 4000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 1500
      });

      const result = completion.choices[0].message.content;
      if (!result) {
        throw new Error('No response from OpenAI analysis');
      }

      return JSON.parse(result) as ExtractedShipmentData;
      
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
      
      // Enhance with OpenAI if we have good text content
      if (fullText.length > 100) {
        console.log('Enhancing Azure data with OpenAI analysis...');
        const openaiData = await this.extractComprehensiveData(fullText);
        
        // Merge Azure and OpenAI results, preferring Azure for structured data
        return this.mergeExtractionResults(extractedData, openaiData);
      }
      
      return extractedData;
      
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
      'billOfLadingNumber', 'vesselAndVoyage', 'containerNumber', 
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
      'billOfLadingNumber', 'containerNumber', 'vesselAndVoyage',
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