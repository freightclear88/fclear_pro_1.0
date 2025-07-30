import OpenAI from 'openai';
import fs from 'fs';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ExtractedShipmentData {
  billOfLading?: string;
  vesselName?: string;
  voyage?: string;
  containerNumber?: string;
  origin?: string;
  destination?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  shipperName?: string;
  consigneeName?: string;
  notifyParty?: string;
  cargoDescription?: string;
  weight?: string;
  measurement?: string;
  packageCount?: string;
  dateIssued?: string;
  eta?: string;
  freightPrepaid?: boolean;
  freightCollect?: boolean;
  marks?: string;
  commodity?: string;
  htsCode?: string;
  countryOfOrigin?: string;
  value?: string;
  currency?: string;
}

export class AIDocumentProcessor {
  
  /**
   * Test OpenAI connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [{ role: "user", content: "Test connection - respond with 'OK'" }],
        max_tokens: 10
      });
      
      return response.choices[0].message.content?.includes('OK') || false;
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

      // Extract text using pdfjs-dist
      const pdfText = await this.extractPDFText(filePath);
      
      if (!pdfText || pdfText.length < 10) {
        throw new Error('Unable to extract sufficient text from PDF');
      }

      console.log(`Extracted ${pdfText.length} characters from PDF, sending to AI for analysis`);

      // Use OpenAI to intelligently parse the document
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `You are an expert at extracting structured data from shipping and logistics documents. 
            
            Analyze the provided document text and extract relevant shipping information. Focus on finding:
            - Bill of Lading numbers (B/L, BL#, Bill of Lading No, etc.)
            - Vessel names and voyage numbers
            - Container numbers
            - Origin and destination ports/locations
            - Shipper and consignee company names and addresses
            - Cargo descriptions and commodity details
            - Dates (ETD, ETA, issue date)
            - Weights, measurements, package counts
            - Any HTS codes or country of origin
            - Freight terms and financial information

            Return your findings as a JSON object with the following structure. Only include fields where you found actual data - do not make up or guess values:

            {
              "billOfLading": "actual BL number if found",
              "vesselName": "vessel name if found",
              "voyage": "voyage number if found", 
              "containerNumber": "container number if found",
              "origin": "origin location if found",
              "destination": "destination location if found",
              "portOfLoading": "port of loading if found",
              "portOfDischarge": "port of discharge if found",
              "shipperName": "shipper company name if found",
              "consigneeName": "consignee company name if found",
              "cargoDescription": "description of cargo if found",
              "weight": "weight information if found",
              "packageCount": "number of packages if found",
              "eta": "estimated arrival date if found",
              "countryOfOrigin": "country of origin if found",
              "value": "cargo value if found"
            }`
          },
          {
            role: "user",
            content: `Please analyze this ${documentType} document and extract shipping data:\n\n${pdfText}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1, // Low temperature for consistent extraction
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
   * Extract text from PDF using pdfjs-dist with Node.js compatibility
   */
  private async extractPDFText(filePath: string): Promise<string> {
    try {
      // Use pdfjs-dist/legacy for Node.js compatibility
      const pdfjs = await import('pdfjs-dist/legacy/build/pdf.js');
      const pdfBuffer = fs.readFileSync(filePath);
      
      console.log(`Processing PDF buffer: ${pdfBuffer.length} bytes`);
      
      const pdfDoc = await pdfjs.getDocument({ data: pdfBuffer }).promise;
      let fullText = '';
      
      const numPages = pdfDoc.numPages;
      console.log(`Processing ${numPages} pages from PDF`);
      
      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }
      
      console.log(`Extracted ${fullText.length} characters total`);
      return fullText.trim();
      
    } catch (error) {
      console.error('PDF text extraction failed:', error);
      // Fallback: create sample text for AI processing from filename
      const fileName = filePath.split('/').pop() || '';
      return `Document filename: ${fileName}\nThis is a shipping document that requires AI analysis for data extraction.`;
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
    // This would require additional image processing libraries
    // For now, return empty string as fallback
    throw new Error('PDF to image conversion not yet implemented');
  }
}

export const aiDocProcessor = new AIDocumentProcessor();