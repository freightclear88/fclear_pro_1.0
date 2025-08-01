import cron from 'node-cron';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { xmlShipmentProcessor } from './xmlShipmentProcessor';
import { db } from './db';
import { xmlSources, xmlScheduledJobs, type XmlSource } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class SimpleXmlScheduler {
  private scheduledJobs = new Map<number, any>();
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    this.ensureTempDirectory();
  }

  private ensureTempDirectory() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Schedule XML retrieval for a specific source
   */
  scheduleXmlRetrieval(source: XmlSource) {
    try {
      // Stop existing job if it exists
      if (this.scheduledJobs.has(source.id)) {
        this.scheduledJobs.get(source.id).stop();
      }

      if (!source.isActive) {
        return;
      }

      // Create new cron job
      const job = cron.schedule(source.schedule, async () => {
        await this.retrieveAndProcessXml(source);
      });

      this.scheduledJobs.set(source.id, job);
      console.log(`Scheduled XML retrieval for ${source.name} with schedule: ${source.schedule}`);

    } catch (error) {
      console.error(`Error scheduling XML retrieval for ${source.name}:`, error);
    }
  }

  /**
   * Retrieve XML from external source and process it
   */
  async retrieveAndProcessXml(source: XmlSource): Promise<void> {
    try {
      console.log(`Starting XML retrieval from ${source.name} (${source.url})`);

      // Prepare request headers
      const headers: Record<string, string> = {
        'User-Agent': 'FreightClear-XMLRetriever/1.0',
        'Accept': 'application/xml, text/xml, */*'
      };

      // Add authentication based on type
      const authConfig = source.authConfig as any;
      if (source.authType === 'basic' && authConfig?.username && authConfig?.password) {
        const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (source.authType === 'bearer' && authConfig?.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      } else if (source.authType === 'apikey' && authConfig?.apiKey && authConfig?.headerName) {
        headers[authConfig.headerName] = authConfig.apiKey;
      }

      // Fetch XML data
      const response = await fetch(source.url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const xmlContent = await response.text();

      if (!xmlContent || xmlContent.trim().length === 0) {
        throw new Error('Empty XML content received');
      }

      // Validate XML format
      if (!xmlContent.includes('<Shipment>') && !xmlContent.includes('<shipment>')) {
        throw new Error('Invalid XML format - no shipment data found');
      }

      // Process XML through the existing processor
      const result = await xmlShipmentProcessor.processXmlFromString(xmlContent, source.userId);

      // Log successful processing
      await this.logRetrievalResult(source.id, true, `Successfully processed shipment ${result.shipmentId}`);

      // Update last retrieved timestamp
      await db.update(xmlSources)
        .set({ lastRetrieved: new Date() })
        .where(eq(xmlSources.id, source.id));

      console.log(`Successfully retrieved and processed XML from ${source.name}`);

    } catch (error: any) {
      console.error(`Error retrieving XML from ${source.name}:`, error);
      
      // Log error
      await this.logRetrievalResult(source.id, false, error.message);
    }
  }

  /**
   * Log retrieval result to database
   */
  private async logRetrievalResult(sourceId: number, success: boolean, message: string) {
    try {
      await db.insert(xmlScheduledJobs).values({
        sourceId,
        executedAt: new Date(),
        success,
        message,
      });
    } catch (error) {
      console.error('Error logging retrieval result:', error);
    }
  }

  /**
   * Initialize all scheduled jobs from database
   */
  async initializeScheduledJobs() {
    try {
      const sources = await db.query.xmlSources.findMany({
        where: eq(xmlSources.isActive, true),
      });

      for (const source of sources) {
        this.scheduleXmlRetrieval(source as XmlSource);
      }

      console.log(`Initialized ${sources.length} XML retrieval schedules`);
    } catch (error) {
      console.error('Error initializing XML schedules:', error);
    }
  }

  /**
   * Stop all scheduled jobs
   */
  stopAllJobs() {
    this.scheduledJobs.forEach((job, sourceId) => {
      job.stop();
      console.log(`Stopped XML retrieval job for source ${sourceId}`);
    });
    this.scheduledJobs.clear();
  }

  /**
   * Manually trigger XML retrieval for a source
   */
  async manualRetrieve(sourceId: number): Promise<{ success: boolean; message: string }> {
    try {
      const source = await db.query.xmlSources.findFirst({
        where: eq(xmlSources.id, sourceId),
      });

      if (!source) {
        throw new Error('XML source not found');
      }

      await this.retrieveAndProcessXml(source as XmlSource);

      return {
        success: true,
        message: 'XML retrieved and processed successfully'
      };

    } catch (error: any) {
      return {
        success: false,
        message: error.message
      };
    }
  }
}

export const simpleXmlScheduler = new SimpleXmlScheduler();