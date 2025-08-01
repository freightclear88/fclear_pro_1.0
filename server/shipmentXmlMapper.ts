import type { Shipment, InsertShipment } from '@shared/schema';
import type { XMLShipmentData } from './xmlIntegration';
import { createHash } from 'crypto';

/**
 * Cross-compatibility mapper between database shipments and XML data
 * Provides bidirectional conversion for seamless integration
 */
export class ShipmentXMLMapper {

  /**
   * Convert XML shipment data to database shipment format
   * @param xmlData XML shipment data
   * @param userId User ID to associate with shipment
   * @param originalXML Original XML content for storage
   * @returns Database-compatible shipment insert object
   */
  static xmlToDatabase(
    xmlData: XMLShipmentData, 
    userId: string, 
    originalXML?: string
  ): InsertShipment {
    // Generate XML hash for duplicate prevention
    const xmlHash = originalXML ? createHash('sha256').update(originalXML).digest('hex') : undefined;
    
    // Parse dates safely
    const parseDate = (dateStr?: string): Date | undefined => {
      if (!dateStr) return undefined;
      try {
        return new Date(dateStr);
      } catch {
        return undefined;
      }
    };

    // Parse decimal values safely
    const parseDecimal = (value?: string): string | undefined => {
      if (!value) return undefined;
      const parsed = parseFloat(value);
      return isNaN(parsed) ? undefined : parsed.toString();
    };

    return {
      shipmentId: xmlData.shipment_id,
      userId,
      
      // XML integration fields
      externalId: xmlData.external_id,
      sourceSystem: xmlData.source_system || 'xml_import',
      referenceNumber: xmlData.reference_number,
      bookingNumber: xmlData.booking_number,
      xmlData: originalXML ? JSON.parse(originalXML) : undefined,
      xmlHash,
      lastXmlUpdate: new Date(),
      xmlVersion: xmlData.xml_version,
      
      // Location data
      portOfLoading: xmlData.origin,
      originPort: xmlData.origin_port,
      portOfDischarge: xmlData.destination,
      destinationPort: xmlData.destination_port,
      
      // Transport information
      transportMode: xmlData.transport_mode,
      status: xmlData.status,
      vesselAndVoyage: xmlData.vessel ? `${xmlData.vessel} ${xmlData.voyage || ''}`.trim() : undefined,
      
      // Container and documentation
      containerNumber: xmlData.container_number,
      containerNumbers: xmlData.container_numbers,
      billOfLadingNumber: xmlData.bill_of_lading,
      
      // Timing
      eta: parseDate(xmlData.eta),
      ata: parseDate(xmlData.ata),
      etd: parseDate(xmlData.etd),
      atd: parseDate(xmlData.atd),
      
      // Party information
      shipperName: xmlData.shipper_name,
      shipperAddress: xmlData.shipper_address,
      consigneeName: xmlData.consignee_name,
      consigneeAddress: xmlData.consignee_address,
      notifyParty: xmlData.notify_party,
      
      // Financial
      freightCharges: parseDecimal(xmlData.freight_charges),
      destinationCharges: parseDecimal(xmlData.destination_charges),
      customsBroker: xmlData.customs_broker,
      totalValue: parseDecimal(xmlData.total_value),
      currency: xmlData.currency,
      
      // Cargo details
      cargoDescription: xmlData.cargo_description,
      weight: parseDecimal(xmlData.weight),
      weightUnit: xmlData.weight_unit,
      volume: parseDecimal(xmlData.volume),
      volumeUnit: xmlData.volume_unit,
    };
  }

  /**
   * Convert database shipment to XML-compatible format
   * @param shipment Database shipment record
   * @returns XML-compatible shipment data
   */
  static databaseToXml(shipment: Shipment): XMLShipmentData {
    // Format dates to ISO 8601
    const formatDate = (date?: Date | null): string | undefined => {
      return date ? date.toISOString() : undefined;
    };

    // Format decimal values
    const formatDecimal = (value?: string | null): string | undefined => {
      return value?.toString();
    };

    return {
      shipment_id: shipment.shipmentId,
      external_id: shipment.externalId || undefined,
      user_id: shipment.userId,
      reference_number: shipment.referenceNumber || undefined,
      booking_number: shipment.bookingNumber || undefined,
      source_system: shipment.sourceSystem || undefined,
      
      // Documentation
      bill_of_lading: shipment.billOfLadingNumber || undefined,
      container_number: shipment.containerNumber || undefined,
      container_numbers: shipment.containerNumbers || undefined,
      
      // Location data
      origin: shipment.portOfLoading,
      origin_port: shipment.originPort || undefined,
      destination: shipment.portOfDischarge,
      destination_port: shipment.destinationPort || undefined,
      
      // Transport information
      transport_mode: shipment.transportMode as any,
      status: shipment.status,
      vessel: shipment.vesselAndVoyage?.split(' ')[0] || undefined,
      voyage: shipment.vesselAndVoyage?.split(' ').slice(1).join(' ') || undefined,
      
      // Timing
      eta: formatDate(shipment.eta),
      ata: formatDate(shipment.ata),
      etd: formatDate(shipment.etd),
      atd: formatDate(shipment.atd),
      
      // Party information
      shipper_name: shipment.shipperName || undefined,
      shipper_address: shipment.shipperAddress || undefined,
      consignee_name: shipment.consigneeName || undefined,
      consignee_address: shipment.consigneeAddress || undefined,
      notify_party: shipment.notifyPartyName || undefined,
      
      // Financial
      freight_charges: formatDecimal(shipment.freightCharges),
      destination_charges: formatDecimal(shipment.destinationCharges),
      customs_broker: shipment.customsBroker || undefined,
      total_value: formatDecimal(shipment.totalValue),
      currency: shipment.currency || 'USD',
      
      // Cargo details
      cargo_description: shipment.cargoDescription || undefined,
      weight: formatDecimal(shipment.weight),
      weight_unit: shipment.weightUnit || 'KG',
      volume: formatDecimal(shipment.volume),
      volume_unit: shipment.volumeUnit || 'CBM',
      
      // XML metadata
      xml_version: shipment.xmlVersion || undefined,
    };
  }

  /**
   * Generate XML output from shipment data
   * @param shipment Database shipment record
   * @param format XML format to generate ('edifact', 'smdg', 'custom')
   * @returns XML string
   */
  static generateXML(shipment: Shipment, format: 'edifact' | 'smdg' | 'custom' = 'custom'): string {
    const xmlData = this.databaseToXml(shipment);
    
    switch (format) {
      case 'edifact':
        return this.generateEDIFACTXML(xmlData);
      case 'smdg':
        return this.generateSMDGXML(xmlData);
      default:
        return this.generateCustomXML(xmlData);
    }
  }

  /**
   * Generate UN/EDIFACT compatible XML
   */
  private static generateEDIFACTXML(data: XMLShipmentData): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<COPRAR xmlns="urn:un:unece:uncefact:data:standard:COPRARMessage:D:03B">
  <ExchangeHeader>
    <SenderID>${data.source_system || 'FREIGHTCLEAR'}</SenderID>
    <RecipientID>TRADING_PARTNER</RecipientID>
    <DateTime>${new Date().toISOString()}</DateTime>
  </ExchangeHeader>
  <MessageHeader>
    <MessageType>COPRAR</MessageType>
    <MessageVersion>D.03B</MessageVersion>
    <MessageReference>${data.shipment_id}</MessageReference>
  </MessageHeader>
  <ShipmentDetails>
    <ReferenceNumber>${data.reference_number || data.shipment_id}</ReferenceNumber>
    <BookingNumber>${data.booking_number || ''}</BookingNumber>
    <BillOfLading>${data.bill_of_lading || ''}</BillOfLading>
    <Vessel>${data.vessel || ''}</Vessel>
    <Voyage>${data.voyage || ''}</Voyage>
    <OriginPort>${data.origin_port || data.origin}</OriginPort>
    <DestinationPort>${data.destination_port || data.destination}</DestinationPort>
    <ETA>${data.eta || ''}</ETA>
    <ATA>${data.ata || ''}</ATA>
    <ContainerDetails>
      <ContainerNumber>${data.container_number || ''}</ContainerNumber>
      ${data.container_numbers?.map(num => `<AdditionalContainer>${num}</AdditionalContainer>`).join('') || ''}
    </ContainerDetails>
    <PartyDetails>
      <Shipper>
        <Name>${data.shipper_name || ''}</Name>
        <Address>${data.shipper_address || ''}</Address>
      </Shipper>
      <Consignee>
        <Name>${data.consignee_name || ''}</Name>
        <Address>${data.consignee_address || ''}</Address>
      </Consignee>
      <NotifyParty>${data.notify_party || ''}</NotifyParty>
    </PartyDetails>
    <CargoDetails>
      <Description>${data.cargo_description || ''}</Description>
      <Weight unit="${data.weight_unit}">${data.weight || ''}</Weight>
      <Volume unit="${data.volume_unit}">${data.volume || ''}</Volume>
    </CargoDetails>
  </ShipmentDetails>
</COPRAR>`;
  }

  /**
   * Generate SMDG compatible XML
   */
  private static generateSMDGXML(data: XMLShipmentData): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<ShipToShoreMessage xmlns="http://www.smdg.org/schema/ship-to-shore">
  <MessageHeader>
    <MessageID>${data.shipment_id}</MessageID>
    <Timestamp>${new Date().toISOString()}</Timestamp>
    <Source>${data.source_system || 'FREIGHTCLEAR'}</Source>
  </MessageHeader>
  <VesselCall>
    <VesselName>${data.vessel || ''}</VesselName>
    <VoyageNumber>${data.voyage || ''}</VoyageNumber>
    <Port>${data.destination_port || data.destination}</Port>
    <ETA>${data.eta || ''}</ETA>
    <ATA>${data.ata || ''}</ATA>
  </VesselCall>
  <ContainerMovements>
    <Container>
      <ContainerNumber>${data.container_number || ''}</ContainerNumber>
      <Status>${data.status}</Status>
      <BookingReference>${data.booking_number || ''}</BookingReference>
      <BillOfLading>${data.bill_of_lading || ''}</BillOfLading>
    </Container>
  </ContainerMovements>
</ShipToShoreMessage>`;
  }

  /**
   * Generate custom Freightclear XML format
   */
  private static generateCustomXML(data: XMLShipmentData): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<FreightclearShipment xmlns="http://freightclear.com/schema/shipment">
  <Header>
    <ShipmentID>${data.shipment_id}</ShipmentID>
    <ExternalID>${data.external_id || ''}</ExternalID>
    <ReferenceNumber>${data.reference_number || ''}</ReferenceNumber>
    <SourceSystem>${data.source_system || 'manual'}</SourceSystem>
    <LastUpdated>${new Date().toISOString()}</LastUpdated>
  </Header>
  <Transport>
    <Mode>${data.transport_mode}</Mode>
    <Status>${data.status}</Status>
    <Vessel>${data.vessel || ''}</Vessel>
    <Voyage>${data.voyage || ''}</Voyage>
    <BookingNumber>${data.booking_number || ''}</BookingNumber>
    <BillOfLading>${data.bill_of_lading || ''}</BillOfLading>
  </Transport>
  <Route>
    <Origin port="${data.origin_port || ''}">${data.origin}</Origin>
    <Destination port="${data.destination_port || ''}">${data.destination}</Destination>
  </Route>
  <Schedule>
    <ETD>${data.etd || ''}</ETD>
    <ATD>${data.atd || ''}</ATD>
    <ETA>${data.eta || ''}</ETA>
    <ATA>${data.ata || ''}</ATA>
  </Schedule>
  <Containers>
    <Primary>${data.container_number || ''}</Primary>
    ${data.container_numbers?.map(num => `<Additional>${num}</Additional>`).join('') || ''}
  </Containers>
  <Parties>
    <Shipper>
      <Name>${data.shipper_name || ''}</Name>
      <Address>${data.shipper_address || ''}</Address>
    </Shipper>
    <Consignee>
      <Name>${data.consignee_name || ''}</Name>
      <Address>${data.consignee_address || ''}</Address>
    </Consignee>
    <NotifyParty>${data.notify_party || ''}</NotifyParty>
    <CustomsBroker>${data.customs_broker || ''}</CustomsBroker>
  </Parties>
  <Cargo>
    <Description>${data.cargo_description || ''}</Description>
    <Weight unit="${data.weight_unit}">${data.weight || ''}</Weight>
    <Volume unit="${data.volume_unit}">${data.volume || ''}</Volume>
    <Value currency="${data.currency}">${data.total_value || ''}</Value>
  </Cargo>
  <Charges>
    <Freight currency="${data.currency}">${data.freight_charges || ''}</Freight>
    <Destination currency="${data.currency}">${data.destination_charges || ''}</Destination>
  </Charges>
</FreightclearShipment>`;
  }

  /**
   * Check if shipment already exists by XML hash
   * @param xmlHash SHA256 hash of XML content
   * @returns boolean indicating if duplicate exists
   */
  static async isDuplicateXML(xmlHash: string): Promise<boolean> {
    // This would be implemented in the storage layer
    // For now, return false to allow processing
    return false;
  }

  /**
   * Update existing shipment with new XML data
   * @param existingShipment Current shipment record
   * @param xmlData New XML data
   * @param originalXML Original XML content
   * @returns Updated shipment data
   */
  static mergeXMLUpdate(
    existingShipment: Shipment, 
    xmlData: XMLShipmentData, 
    originalXML?: string
  ): Partial<Shipment> {
    const newData = this.xmlToDatabase(xmlData, existingShipment.userId, originalXML);
    
    // Merge strategy: preserve user-entered data, update system data
    return {
      ...newData,
      id: existingShipment.id,
      shipmentId: existingShipment.shipmentId, // Keep original ID
      userId: existingShipment.userId, // Keep original user
      lastXmlUpdate: new Date(),
      updatedAt: new Date(),
    };
  }
}