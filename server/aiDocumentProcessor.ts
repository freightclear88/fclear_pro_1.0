import OpenAI from "openai";
import fs from 'fs';
import pdf2pic from 'pdf2pic';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
   * Extract structured data from PDF document using AI
   */
  async extractShipmentData(filePath: string, documentType: string): Promise<ExtractedShipmentData> {
    try {
      // Test OpenAI connection first
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
   * Extract text from PDF using vision API approach
   */
  private async extractPDFText(filePath: string): Promise<string> {
    try {
      console.log(`Starting PDF to image conversion for: ${filePath}`);
      
      // Convert PDF to image and use OpenAI vision for text extraction
      const base64Image = await this.convertPDFToBase64Image(filePath);
      
      console.log(`Successfully converted PDF to image, proceeding with vision analysis`);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text content from this shipping document image. Return only the raw text content, preserving the structure and formatting as much as possible. Focus on shipping data like vessel names, container numbers, B/L numbers, company names, addresses, ports, dates, etc."
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
        max_tokens: 4000
      });

      const extractedText = completion.choices[0].message.content || '';
      console.log(`Extracted ${extractedText.length} characters from PDF via vision`);
      
      if (extractedText.length < 50) {
        throw new Error('Insufficient text extracted from PDF');
      }
      
      return extractedText.trim();
      
    } catch (error) {
      console.error('PDF vision extraction failed:', error);
      throw new Error(`PDF text extraction failed: ${error.message}`);
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
      const convert = pdf2pic.fromPath(filePath, {
        density: 100,
        saveFilename: "untitled",
        savePath: "./temp",
        format: "jpeg",
        width: 1700,
        height: 2200
      });
      
      const result = await convert(1); // Convert first page
      if (result && result.base64) {
        return result.base64;
      }
      
      throw new Error('Failed to convert PDF to image');
    } catch (error) {
      console.error('PDF to image conversion failed:', error);
      throw error;
    }
  }
}

export const aiDocProcessor = new AIDocumentProcessor();