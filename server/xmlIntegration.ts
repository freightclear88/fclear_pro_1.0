import { storage } from './storage';
import type { InsertShipment, Shipment } from '@shared/schema';
import { parseStringPromise } from 'xml2js';
import { z } from 'zod';

// Enhanced XML Schema validation for cross-compatible shipment data
const XMLShipmentSchema = z.object({
  // Core identification
  shipment_id: z.string(),
  external_id: z.string().optional(),
  user_id: z.string().optional(),
  reference_number: z.string().optional(),
  booking_number: z.string().optional(),
  source_system: z.string().optional(),
  
  // Documentation
  bill_of_lading: z.string().optional(),
  container_number: z.string().optional(),
  container_numbers: z.array(z.string()).optional(),
  
  // Location data
  origin: z.string(),
  origin_port: z.string().optional(),
  destination: z.string(),
  destination_port: z.string().optional(),
  
  // Transport information
  transport_mode: z.enum(['air', 'ocean', 'trucking', 'last_mile']).default('ocean'),
  status: z.string().default('pending'),
  vessel: z.string().optional(),
  voyage: z.string().optional(),
  
  // Enhanced timing
  eta: z.string().optional(), // ISO 8601 date string
  ata: z.string().optional(), // ISO 8601 date string
  etd: z.string().optional(), // ISO 8601 date string
  atd: z.string().optional(), // ISO 8601 date string
  
  // Enhanced party information
  shipper_name: z.string().optional(),
  shipper_address: z.string().optional(),
  consignee_name: z.string().optional(),
  consignee_address: z.string().optional(),
  notify_party: z.string().optional(),
  
  // Financial
  freight_charges: z.string().optional(), // decimal as string
  destination_charges: z.string().optional(), // decimal as string
  customs_broker: z.string().optional(),
  total_value: z.string().optional(), // decimal as string
  currency: z.string().default('USD'),
  
  // Cargo details
  cargo_description: z.string().optional(),
  weight: z.string().optional(), // decimal as string
  weight_unit: z.string().default('KG'),
  volume: z.string().optional(), // decimal as string
  volume_unit: z.string().default('CBM'),
  
  // XML metadata
  xml_version: z.string().optional(),
});

export type XMLShipmentData = z.infer<typeof XMLShipmentSchema>;

/**
 * XML Integration Service for External Shipment Updates
 * Supports multiple industry-standard XML formats:
 * - UN/EDIFACT COPRAR (Container discharge/loading report)
 * - UN/EDIFACT COPARN (Container announcement)
 * - SMDG (Ship-to-Shore Container Message)
 * - Custom freight forwarder formats
 */
export class XMLShipmentIntegrator {
  
  /**
   * Process incoming XML shipment data
   * @param xmlContent Raw XML string content
   * @param sourceSystem Identifier for the source system (e.g., 'maersk', 'msc', 'hapag-lloyd')
   * @param userId Optional user ID to associate with shipments
   * @returns Array of processed shipment results
   */
  async processXMLShipmentData(
    xmlContent: string, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    try {
      const parsedXML = await parseStringPromise(xmlContent, {
        explicitArray: false,
        ignoreAttrs: false,
        mergeAttrs: true
      });

      // Detect XML format and route to appropriate parser
      const results = await this.routeXMLByFormat(parsedXML, sourceSystem, userId);
      return results;
    } catch (error) {
      console.error('XML parsing error:', error);
      return [{ success: false, error: `XML parsing failed: ${error.message}` }];
    }
  }

  /**
   * Convert XML shipment data to database format using the new mapper
   */
  async convertXMLToShipment(
    xmlData: XMLShipmentData, 
    userId: string, 
    originalXML?: string
  ): Promise<InsertShipment> {
    const { ShipmentXMLMapper } = await import('./shipmentXmlMapper');
    return ShipmentXMLMapper.xmlToDatabase(xmlData, userId, originalXML);
  }

  /**
   * Convert database shipment to XML format
   */
  async convertShipmentToXML(shipment: Shipment, format: 'edifact' | 'smdg' | 'custom' = 'custom'): Promise<string> {
    const { ShipmentXMLMapper } = await import('./shipmentXmlMapper');
    return ShipmentXMLMapper.generateXML(shipment, format);
  }

  /**
   * Check for duplicate XML processing
   */
  async isDuplicateXML(xmlContent: string): Promise<boolean> {
    const { ShipmentXMLMapper } = await import('./shipmentXmlMapper');
    const { createHash } = await import('crypto');
    const xmlHash = createHash('sha256').update(xmlContent).digest('hex');
    return ShipmentXMLMapper.isDuplicateXML(xmlHash);
  }

  /**
   * Route XML data to appropriate parser based on format detection
   */
  private async routeXMLByFormat(
    parsedXML: any, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    
    // Detect XML format by root element or structure
    if (parsedXML.COPRAR || parsedXML.coprar) {
      return await this.processCOPRARFormat(parsedXML, sourceSystem, userId);
    } else if (parsedXML.COPARN || parsedXML.coparn) {
      return await this.processCOPARNFormat(parsedXML, sourceSystem, userId);
    } else if (parsedXML.shipments || parsedXML.Shipments) {
      return await this.processGenericShipmentsFormat(parsedXML, sourceSystem, userId);
    } else if (parsedXML.container_status || parsedXML.ContainerStatus) {
      return await this.processContainerStatusFormat(parsedXML, sourceSystem, userId);
    } else {
      // Try to process as custom format
      return await this.processCustomFormat(parsedXML, sourceSystem, userId);
    }
  }

  /**
   * Process UN/EDIFACT COPRAR format (Container discharge/loading report)
   */
  private async processCOPRARFormat(
    parsedXML: any, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    const results: { success: boolean; shipmentId?: string; error?: string }[] = [];
    
    try {
      const coprarData = parsedXML.COPRAR || parsedXML.coprar;
      const containers = Array.isArray(coprarData.container) ? coprarData.container : [coprarData.container];
      
      for (const container of containers) {
        try {
          const shipmentData: XMLShipmentData = {
            shipment_id: container.container_number || container.equipment_id || `COPRAR-${Date.now()}`,
            bill_of_lading: container.bill_of_lading || container.bl_number,
            container_number: container.container_number || container.equipment_id,
            origin: container.loading_port || container.origin_port || 'Unknown',
            origin_port: container.loading_port,
            destination: container.discharge_port || container.destination_port || 'Unknown',
            destination_port: container.discharge_port,
            transport_mode: 'ocean',
            status: this.mapCOPRARStatus(container.status || container.movement_type),
            vessel: container.vessel_name,
            voyage: container.voyage_number,
            eta: container.estimated_arrival_time,
            ata: container.actual_arrival_time,
            shipper_name: container.shipper,
            consignee_name: container.consignee,
          };

          const result = await this.upsertShipment(shipmentData, sourceSystem, userId);
          results.push(result);
        } catch (error) {
          results.push({ 
            success: false, 
            error: `Container processing failed: ${error.message}` 
          });
        }
      }
    } catch (error) {
      results.push({ 
        success: false, 
        error: `COPRAR format processing failed: ${error.message}` 
      });
    }

    return results;
  }

  /**
   * Process UN/EDIFACT COPARN format (Container announcement)
   */
  private async processCOPARNFormat(
    parsedXML: any, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    const results: { success: boolean; shipmentId?: string; error?: string }[] = [];
    
    try {
      const coparnData = parsedXML.COPARN || parsedXML.coparn;
      const containers = Array.isArray(coparnData.container) ? coparnData.container : [coparnData.container];
      
      for (const container of containers) {
        try {
          const shipmentData: XMLShipmentData = {
            shipment_id: container.equipment_id || container.container_number || `COPARN-${Date.now()}`,
            bill_of_lading: container.bill_of_lading,
            container_number: container.equipment_id || container.container_number,
            origin: container.place_of_loading || 'Unknown',
            destination: container.place_of_discharge || 'Unknown',
            transport_mode: 'ocean',
            status: 'announced',
            vessel: container.vessel_name,
            voyage: container.voyage_number,
            eta: container.estimated_time_arrival,
            shipper_name: container.shipper_party,
            consignee_name: container.consignee_party,
          };

          const result = await this.upsertShipment(shipmentData, sourceSystem, userId);
          results.push(result);
        } catch (error) {
          results.push({ 
            success: false, 
            error: `Container announcement processing failed: ${error.message}` 
          });
        }
      }
    } catch (error) {
      results.push({ 
        success: false, 
        error: `COPARN format processing failed: ${error.message}` 
      });
    }

    return results;
  }

  /**
   * Process generic shipments XML format
   */
  private async processGenericShipmentsFormat(
    parsedXML: any, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    const results: { success: boolean; shipmentId?: string; error?: string }[] = [];
    
    try {
      const shipmentsData = parsedXML.shipments || parsedXML.Shipments;
      const shipmentList = Array.isArray(shipmentsData.shipment) ? 
        shipmentsData.shipment : [shipmentsData.shipment];
      
      for (const shipment of shipmentList) {
        try {
          const shipmentData: XMLShipmentData = {
            shipment_id: shipment.id || shipment.shipment_id || shipment.reference,
            bill_of_lading: shipment.bill_of_lading || shipment.bl_number,
            container_number: shipment.container_number || shipment.container_id,
            origin: shipment.origin || shipment.origin_location,
            origin_port: shipment.origin_port || shipment.loading_port,
            destination: shipment.destination || shipment.destination_location,
            destination_port: shipment.destination_port || shipment.discharge_port,
            transport_mode: shipment.transport_mode || shipment.mode || 'ocean',
            status: shipment.status || 'pending',
            vessel: shipment.vessel || shipment.vessel_name,
            voyage: shipment.voyage || shipment.voyage_number,
            eta: shipment.eta || shipment.estimated_arrival,
            ata: shipment.ata || shipment.actual_arrival,
            shipper_name: shipment.shipper || shipment.shipper_name,
            consignee_name: shipment.consignee || shipment.consignee_name,
            freight_charges: shipment.freight_charges,
            destination_charges: shipment.destination_charges,
            customs_broker: shipment.customs_broker,
            total_value: shipment.total_value || shipment.cargo_value,
          };

          const result = await this.upsertShipment(shipmentData, sourceSystem, userId);
          results.push(result);
        } catch (error) {
          results.push({ 
            success: false, 
            error: `Shipment processing failed: ${error.message}` 
          });
        }
      }
    } catch (error) {
      results.push({ 
        success: false, 
        error: `Generic shipments format processing failed: ${error.message}` 
      });
    }

    return results;
  }

  /**
   * Process container status update format
   */
  private async processContainerStatusFormat(
    parsedXML: any, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    const results: { success: boolean; shipmentId?: string; error?: string }[] = [];
    
    try {
      const statusData = parsedXML.container_status || parsedXML.ContainerStatus;
      const updates = Array.isArray(statusData.update) ? statusData.update : [statusData.update];
      
      for (const update of updates) {
        try {
          // For status updates, we'll update existing shipments by container number or BL
          const containerNumber = update.container_number || update.equipment_id;
          const billOfLading = update.bill_of_lading || update.bl_number;
          
          if (!containerNumber && !billOfLading) {
            results.push({ 
              success: false, 
              error: 'No container number or bill of lading provided for status update' 
            });
            continue;
          }

          const result = await this.updateShipmentStatus(
            containerNumber,
            billOfLading,
            update.status || update.movement_type,
            update.location,
            update.timestamp,
            sourceSystem
          );
          
          results.push(result);
        } catch (error) {
          results.push({ 
            success: false, 
            error: `Status update processing failed: ${error.message}` 
          });
        }
      }
    } catch (error) {
      results.push({ 
        success: false, 
        error: `Container status format processing failed: ${error.message}` 
      });
    }

    return results;
  }

  /**
   * Process custom XML format (fallback)
   */
  private async processCustomFormat(
    parsedXML: any, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }[]> {
    // Attempt to extract shipment data from any XML structure
    // This is a best-effort approach for non-standard formats
    
    const results: { success: boolean; shipmentId?: string; error?: string }[] = [];
    
    try {
      // Try to find shipment-like data in the XML structure
      const extractedData = this.extractDataFromCustomXML(parsedXML);
      
      if (extractedData.length === 0) {
        return [{ 
          success: false, 
          error: 'No recognizable shipment data found in XML' 
        }];
      }

      for (const data of extractedData) {
        try {
          const result = await this.upsertShipment(data, sourceSystem, userId);
          results.push(result);
        } catch (error) {
          results.push({ 
            success: false, 
            error: `Custom format processing failed: ${error.message}` 
          });
        }
      }
    } catch (error) {
      results.push({ 
        success: false, 
        error: `Custom format processing failed: ${error.message}` 
      });
    }

    return results;
  }

  /**
   * Extract shipment data from custom XML structures
   */
  private extractDataFromCustomXML(xmlData: any): XMLShipmentData[] {
    const extracted: XMLShipmentData[] = [];
    
    // Recursive function to search for shipment-like data
    const searchForShipmentData = (obj: any, path: string = ''): void => {
      if (typeof obj !== 'object' || obj === null) return;
      
      // Look for objects that contain shipment-like fields
      const hasShipmentFields = obj.hasOwnProperty('container_number') ||
                               obj.hasOwnProperty('bill_of_lading') ||
                               obj.hasOwnProperty('shipment_id') ||
                               obj.hasOwnProperty('tracking_number');
      
      if (hasShipmentFields) {
        try {
          const shipmentData: XMLShipmentData = {
            shipment_id: obj.shipment_id || obj.tracking_number || obj.reference || `CUSTOM-${Date.now()}`,
            bill_of_lading: obj.bill_of_lading || obj.bl_number,
            container_number: obj.container_number || obj.container_id,
            origin: obj.origin || obj.from || obj.departure || 'Unknown',
            destination: obj.destination || obj.to || obj.arrival || 'Unknown',
            transport_mode: obj.transport_mode || obj.mode || 'ocean',
            status: obj.status || 'pending',
            vessel: obj.vessel || obj.ship,
            voyage: obj.voyage || obj.trip,
            eta: obj.eta || obj.estimated_arrival,
            ata: obj.ata || obj.actual_arrival,
            shipper_name: obj.shipper || obj.sender,
            consignee_name: obj.consignee || obj.receiver,
          };
          
          extracted.push(shipmentData);
        } catch (error) {
          console.warn('Failed to extract custom shipment data:', error);
        }
      }
      
      // Recursively search nested objects and arrays
      for (const key in obj) {
        if (Array.isArray(obj[key])) {
          obj[key].forEach((item: any, index: number) => {
            searchForShipmentData(item, `${path}.${key}[${index}]`);
          });
        } else if (typeof obj[key] === 'object') {
          searchForShipmentData(obj[key], `${path}.${key}`);
        }
      }
    };
    
    searchForShipmentData(xmlData);
    return extracted;
  }

  /**
   * Map COPRAR status codes to internal status values
   */
  private mapCOPRARStatus(coprarStatus: string): string {
    const statusMap: { [key: string]: string } = {
      'LOAD': 'loaded',
      'DISC': 'discharged',
      'GTIN': 'gate_in',
      'GTOT': 'gate_out',
      'STUF': 'stuffed',
      'STRP': 'stripped',
      'PICK': 'picked_up',
      'DROP': 'dropped_off',
      'DLVR': 'delivered',
    };
    
    return statusMap[coprarStatus?.toUpperCase()] || coprarStatus?.toLowerCase() || 'pending';
  }

  /**
   * Upsert shipment data (create or update)
   */
  private async upsertShipment(
    xmlData: XMLShipmentData, 
    sourceSystem: string, 
    userId?: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
    try {
      // Validate the XML data
      const validatedData = XMLShipmentSchema.parse(xmlData);
      
      // Check if shipment already exists
      const existingShipments = await storage.getAllShipments();
      const existingShipment = existingShipments.find(s => 
        s.shipmentId === validatedData.shipment_id ||
        (validatedData.bill_of_lading && s.billOfLading === validatedData.bill_of_lading) ||
        (validatedData.container_number && s.containerNumber === validatedData.container_number)
      );

      const shipmentData: InsertShipment = {
        shipmentId: validatedData.shipment_id,
        userId: userId || existingShipment?.userId || 'system',
        origin: validatedData.origin,
        originPort: validatedData.origin_port || null,
        destination: validatedData.destination,
        destinationPort: validatedData.destination_port || null,
        transportMode: validatedData.transport_mode,
        status: validatedData.status,
        vessel: validatedData.vessel || null,
        voyage: validatedData.voyage || null,
        containerNumber: validatedData.container_number || null,
        billOfLading: validatedData.bill_of_lading || null,
        eta: validatedData.eta ? new Date(validatedData.eta) : null,
        ata: validatedData.ata ? new Date(validatedData.ata) : null,
        shipperName: validatedData.shipper_name || null,
        consigneeName: validatedData.consignee_name || null,
        freightCharges: validatedData.freight_charges || null,
        destinationCharges: validatedData.destination_charges || null,
        customsBroker: validatedData.customs_broker || null,
        totalValue: validatedData.total_value || null,
      };

      let result: Shipment;
      
      if (existingShipment) {
        // Update existing shipment
        result = await storage.updateShipment(existingShipment.id, shipmentData);
      } else {
        // Create new shipment
        result = await storage.createShipment(shipmentData);
      }

      return { 
        success: true, 
        shipmentId: result.shipmentId 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Shipment upsert failed: ${error.message}` 
      };
    }
  }

  /**
   * Update shipment status by container number or bill of lading
   */
  private async updateShipmentStatus(
    containerNumber: string | null,
    billOfLading: string | null,
    status: string,
    location: string | null,
    timestamp: string | null,
    sourceSystem: string
  ): Promise<{ success: boolean; shipmentId?: string; error?: string }> {
    try {
      const shipments = await storage.getAllShipments();
      const shipment = shipments.find(s => 
        (containerNumber && s.containerNumber === containerNumber) ||
        (billOfLading && s.billOfLading === billOfLading)
      );

      if (!shipment) {
        return { 
          success: false, 
          error: 'Shipment not found for status update' 
        };
      }

      const updatedShipment = await storage.updateShipment(shipment.id, {
        status: this.mapCOPRARStatus(status),
        ...(timestamp && { ata: new Date(timestamp) })
      });

      return { 
        success: true, 
        shipmentId: updatedShipment.shipmentId 
      };
    } catch (error) {
      return { 
        success: false, 
        error: `Status update failed: ${error.message}` 
      };
    }
  }
}

// Export singleton instance
export const xmlIntegrator = new XMLShipmentIntegrator();