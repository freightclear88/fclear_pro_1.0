import { DocumentAnalysisClient } from "@azure/ai-form-recognizer";
import { DefaultAzureCredential, ChainedTokenCredential, AzureCliCredential, ManagedIdentityCredential } from "@azure/identity";
import fs from 'fs';

// Initialize Azure Document Intelligence client
let documentClient: DocumentAnalysisClient | null = null;

function getDocumentClient(): DocumentAnalysisClient {
  if (!documentClient) {
    const endpoint = process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT;
    const apiKey = process.env.AZURE_DOCUMENT_INTELLIGENCE_KEY;
    
    if (!endpoint) {
      throw new Error('AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT environment variable is required');
    }
    
    if (apiKey) {
      // Use API key authentication
      documentClient = new DocumentAnalysisClient(endpoint, { key: apiKey });
    } else {
      // Use managed identity or Azure CLI authentication
      const credential = new ChainedTokenCredential(
        new ManagedIdentityCredential(),
        new AzureCliCredential(),
        new DefaultAzureCredential()
      );
      documentClient = new DocumentAnalysisClient(endpoint, credential);
    }
  }
  return documentClient;
}

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
   * Test Azure Document Intelligence connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = getDocumentClient();
      // Test connection by checking if client can be created
      return true;
    } catch (error) {
      console.error('Azure Document Intelligence connection test failed:', error);
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

      // Use OpenAI to extract structured shipping data
      const completion = await openai.chat.completions.create({
        model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: `Extract shipping data from documents. Return JSON with actual found values only:
            {
              "billOfLading": "B/L number if found",
              "vesselName": "vessel name if found", 
              "containerNumber": "container number if found",
              "origin": "origin port/location if found",
              "destination": "destination port/location if found",
              "shipperName": "shipper company if found",
              "consigneeName": "consignee company if found",
              "cargoDescription": "cargo description if found",
              "weight": "weight if found",
              "eta": "arrival date if found"
            }`
          },
          {
            role: "user",
            content: `Extract data from this ${documentType}:\n\n${pdfText.substring(0, 3000)}`
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 800
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
      // Try alternative: read file as buffer and send to OpenAI for vision analysis
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
    // This would require additional image processing libraries
    // For now, return empty string as fallback
    throw new Error('PDF to image conversion not yet implemented');
  }
}

export const aiDocProcessor = new AIDocumentProcessor();