import cron from 'node-cron';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { xmlShipmentProcessor } from './xmlShipmentProcessor';
import { db } from './db';
import { xmlSources, xmlScheduledJobs, type XmlSource, type InsertXmlSource } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

// XmlSource type is now imported from schema

export class XmlScheduler {
  private scheduledJobs = new Map<number, any>();
  private tempDir = path.join(process.cwd(), 'temp');

  constructor() {
    this.ensureTempDirectory();
    this.initializeScheduledJobs();
  }

  private ensureTempDirectory() {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
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
        this.scheduleXmlRetrieval(source);
      }

      console.log(`Initialized ${sources.length} XML retrieval schedules`);
    } catch (error) {
      console.error('Error initializing XML schedules:', error);
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
      }, {
        scheduled: true,
        timezone: 'America/New_York'
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

      // Add authentication
      if (source.authType === 'basic' && source.authConfig?.username && source.authConfig?.password) {
        const credentials = Buffer.from(`${source.authConfig.username}:${source.authConfig.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (source.authType === 'bearer' && source.authConfig?.token) {
        headers['Authorization'] = `Bearer ${source.authConfig.token}`;
      } else if (source.authType === 'apikey' && source.authConfig?.apiKey && source.authConfig?.headerName) {
        headers[source.authConfig.headerName] = source.authConfig.apiKey;
      }

      // Fetch XML data
      const response = await fetch(source.url, {
        method: 'GET',
        headers,
        timeout: 30000, // 30 second timeout
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

      // Save XML to temporary file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${source.name}_${timestamp}.xml`;
      const filePath = path.join(this.tempDir, filename);
      
      fs.writeFileSync(filePath, xmlContent, 'utf8');

      // Process XML through the existing processor
      const result = await xmlShipmentProcessor.processXmlFromContent(xmlContent, source.userId);

      // Log successful processing
      await this.logRetrievalResult(source.id, true, `Successfully processed ${result.shipmentId}`, result.processingDetails);

      // Update last retrieved timestamp
      await db.update(xmlSources)
        .set({ lastRetrieved: new Date() })
        .where(eq(xmlSources.id, source.id));

      // Clean up temporary file
      fs.unlinkSync(filePath);

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
  private async logRetrievalResult(sourceId: number, success: boolean, message: string, details?: any) {
    try {
      await db.insert(xmlScheduledJobs).values({
        sourceId,
        executedAt: new Date(),
        success,
        message,
        details: details ? JSON.stringify(details) : null,
      });
    } catch (error) {
      console.error('Error logging retrieval result:', error);
    }
  }

  /**
   * Add new XML source with scheduling
   */
  async addXmlSource(sourceData: InsertXmlSource): Promise<XmlSource> {
    try {
      // Validate cron expression
      if (!cron.validate(sourceData.schedule)) {
        throw new Error('Invalid cron schedule expression');
      }

      // Validate URL
      try {
        new URL(sourceData.url);
      } catch {
        throw new Error('Invalid URL format');
      }

      const [newSource] = await db.insert(xmlSources).values(sourceData).returning();

      // Schedule the new source
      this.scheduleXmlRetrieval(newSource as XmlSource);

      return newSource as XmlSource;

    } catch (error: any) {
      console.error('Error adding XML source:', error);
      throw error;
    }
  }

  /**
   * Update XML source and reschedule if needed
   */
  async updateXmlSource(sourceId: number, updates: Partial<XmlSource>): Promise<XmlSource> {
    try {
      const [updatedSource] = await db.update(xmlSources)
        .set(updates)
        .where(eq(xmlSources.id, sourceId))
        .returning();

      if (!updatedSource) {
        throw new Error('XML source not found');
      }

      // Reschedule if schedule changed or status changed
      if (updates.schedule || updates.hasOwnProperty('isActive')) {
        this.scheduleXmlRetrieval(updatedSource as XmlSource);
      }

      return updatedSource as XmlSource;

    } catch (error: any) {
      console.error('Error updating XML source:', error);
      throw error;
    }
  }

  /**
   * Delete XML source and stop scheduling
   */
  async deleteXmlSource(sourceId: number): Promise<void> {
    try {
      // Stop scheduled job
      if (this.scheduledJobs.has(sourceId)) {
        this.scheduledJobs.get(sourceId).stop();
        this.scheduledJobs.delete(sourceId);
      }

      // Delete from database
      await db.delete(xmlSources).where(eq(xmlSources.id, sourceId));

      console.log(`Deleted XML source ${sourceId} and stopped scheduling`);

    } catch (error: any) {
      console.error('Error deleting XML source:', error);
      throw error;
    }
  }

  /**
   * Get all XML sources for a user
   */
  async getXmlSourcesByUser(userId: number): Promise<XmlSource[]> {
    try {
      const sources = await db.query.xmlSources.findMany({
        where: eq(xmlSources.userId, userId),
      });

      return sources as XmlSource[];

    } catch (error: any) {
      console.error('Error fetching XML sources:', error);
      throw error;
    }
  }

  /**
   * Get job execution history for a source
   */
  async getJobHistory(sourceId: number, limit: number = 50) {
    try {
      const jobs = await db.query.xmlScheduledJobs.findMany({
        where: eq(xmlScheduledJobs.sourceId, sourceId),
        orderBy: (table, { desc }) => [desc(table.executedAt)],
        limit,
      });

      return jobs;

    } catch (error: any) {
      console.error('Error fetching job history:', error);
      throw error;
    }
  }

  /**
   * Test XML source connection without scheduling
   */
  async testXmlSource(source: Omit<XmlSource, 'id' | 'lastRetrieved' | 'createdAt' | 'updatedAt'>): Promise<{ success: boolean; message: string; preview?: string }> {
    try {
      // Prepare request headers
      const headers: Record<string, string> = {
        'User-Agent': 'FreightClear-XMLRetriever/1.0',
        'Accept': 'application/xml, text/xml, */*'
      };

      // Add authentication
      if (source.authType === 'basic' && source.authConfig?.username && source.authConfig?.password) {
        const credentials = Buffer.from(`${source.authConfig.username}:${source.authConfig.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (source.authType === 'bearer' && source.authConfig?.token) {
        headers['Authorization'] = `Bearer ${source.authConfig.token}`;
      } else if (source.authType === 'apikey' && source.authConfig?.apiKey && source.authConfig?.headerName) {
        headers[source.authConfig.headerName] = source.authConfig.apiKey;
      }

      // Test connection
      const response = await fetch(source.url, {
        method: 'GET',
        headers,
        timeout: 15000, // 15 second timeout for testing
      });

      if (!response.ok) {
        return {
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const xmlContent = await response.text();

      if (!xmlContent || xmlContent.trim().length === 0) {
        return {
          success: false,
          message: 'Empty XML content received'
        };
      }

      // Basic XML validation
      if (!xmlContent.includes('<Shipment>') && !xmlContent.includes('<shipment>')) {
        return {
          success: false,
          message: 'Invalid XML format - no shipment data found',
          preview: xmlContent.substring(0, 500)
        };
      }

      return {
        success: true,
        message: 'Connection successful - valid XML data received',
        preview: xmlContent.substring(0, 500)
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Connection failed: ${error.message}`
      };
    }
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

  /**
   * Stop all scheduled jobs (for graceful shutdown)
   */
  stopAllJobs() {
    this.scheduledJobs.forEach((job, sourceId) => {
      job.stop();
      console.log(`Stopped XML retrieval job for source ${sourceId}`);
    });
    this.scheduledJobs.clear();
  }
}

export const xmlScheduler = new XmlScheduler();