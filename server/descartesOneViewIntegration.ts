import { db } from './db';
import { xmlShipments, shipmentParties, shipmentLocations, shipmentContainers, containerContents, shipmentCharges } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { XmlExporter } from './xmlExporter';

/**
 * Descartes OneView Integration Service
 * 
 * Provides XML export functionality specifically formatted for Descartes OneView
 * freight forwarding and logistics management platform.
 * 
 * Supported formats:
 * - OneView EDI/XML Standard Messaging Format (SMF)
 * - Cargo XML for air shipments
 * - Custom OneView XML schema for ocean freight
 */
export class DescartesOneViewIntegration {
  private xmlExporter: XmlExporter;

  constructor() {
    this.xmlExporter = new XmlExporter();
  }

  /**
   * Export shipment data in OneView-compatible XML format
   * @param shipmentId Database shipment ID
   * @param format Export format: 'edifact', 'cargo-xml', 'oneview-standard'
   * @returns OneView-formatted XML string
   */
  async exportToOneViewXML(
    shipmentId: number, 
    format: 'edifact' | 'cargo-xml' | 'oneview-standard' = 'oneview-standard'
  ): Promise<string> {
    try {
      const shipment = await db.query.xmlShipments.findFirst({
        where: eq(xmlShipments.id, shipmentId),
      });

      if (!shipment) {
        throw new Error(`Shipment with ID ${shipmentId} not found`);
      }

      const [parties, locations, containers, contents, charges] = await Promise.all([
        db.query.shipmentParties.findMany({
          where: eq(shipmentParties.shipmentId, shipmentId),
        }),
        db.query.shipmentLocations.findMany({
          where: eq(shipmentLocations.shipmentId, shipmentId),
        }),
        db.query.shipmentContainers.findMany({
          where: eq(shipmentContainers.shipmentId, shipmentId),
        }),
        db.query.containerContents.findMany({
          where: eq(containerContents.shipmentId, shipmentId),
        }),
        db.query.shipmentCharges.findMany({
          where: eq(shipmentCharges.shipmentId, shipmentId),
        }),
      ]);

      switch (format) {
        case 'edifact':
          return this.generateEDIFACTXML(shipment, parties, locations, containers, contents, charges);
        case 'cargo-xml':
          return this.generateCargoXML(shipment, parties, locations, containers, contents, charges);
        case 'oneview-standard':
        default:
          return this.generateOneViewStandardXML(shipment, parties, locations, containers, contents, charges);
      }
    } catch (error: any) {
      console.error('OneView XML export failed:', error);
      throw new Error(`OneView XML export failed: ${error.message}`);
    }
  }

  /**
   * Generate OneView Standard XML format
   * This format is optimized for OneView Forwarder Enterprise
   */
  private generateOneViewStandardXML(
    shipment: any,
    parties: any[],
    locations: any[],
    containers: any[],
    contents: any[],
    charges: any[]
  ): string {
    const timestamp = new Date().toISOString();
    
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<OneViewShipment xmlns="http://oneview.descartes.com/schemas/shipment" version="2.0">\n';
    xml += '  <Header>\n';
    xml += `    <MessageId>${this.escapeXml(shipment.transactionId)}</MessageId>\n`;
    xml += `    <Timestamp>${timestamp}</Timestamp>\n`;
    xml += `    <Source>FreightClear-Workflows</Source>\n`;
    xml += `    <Version>2.0</Version>\n`;
    xml += '  </Header>\n';

    // Main shipment information
    xml += '  <ShipmentInfo>\n';
    xml += `    <ShipmentId>${this.escapeXml(shipment.transactionId)}</ShipmentId>\n`;
    xml += `    <ReferenceNumber>${this.escapeXml(shipment.fileNumber || '')}</ReferenceNumber>\n`;
    
    if (shipment.masterBillNumber) {
      xml += `    <MasterBillOfLading>${this.escapeXml(shipment.masterBillNumber)}</MasterBillOfLading>\n`;
    }
    if (shipment.houseBillNumber) {
      xml += `    <HouseBillOfLading>${this.escapeXml(shipment.houseBillNumber)}</HouseBillOfLading>\n`;
    }
    if (shipment.bookingNumber) {
      xml += `    <BookingNumber>${this.escapeXml(shipment.bookingNumber)}</BookingNumber>\n`;
    }

    xml += `    <TransportMode>${this.mapTransportMode(shipment.transportationMethod)}</TransportMode>\n`;
    xml += `    <ServiceType>${this.escapeXml(shipment.typeOfMove || 'FCL')}</ServiceType>\n`;
    
    if (shipment.vesselName) {
      xml += `    <VesselName>${this.escapeXml(shipment.vesselName)}</VesselName>\n`;
    }
    if (shipment.voyageFlightNumber) {
      xml += `    <VoyageNumber>${this.escapeXml(shipment.voyageFlightNumber)}</VoyageNumber>\n`;
    }

    // Dates
    if (shipment.departureDateTime) {
      xml += `    <ETD>${shipment.departureDateTime.toISOString()}</ETD>\n`;
    }
    if (shipment.arrivalDateTime) {
      xml += `    <ETA>${shipment.arrivalDateTime.toISOString()}</ETA>\n`;
    }

    xml += '  </ShipmentInfo>\n';

    // Parties in OneView format
    if (parties.length > 0) {
      xml += '  <Parties>\n';
      for (const party of parties) {
        const oneViewPartyType = this.mapPartyTypeToOneView(party.partyType);
        xml += `    <Party type="${oneViewPartyType}">\n`;
        xml += `      <CompanyName>${this.escapeXml(party.name)}</CompanyName>\n`;
        
        if (party.address1) {
          xml += '      <Address>\n';
          xml += `        <Line1>${this.escapeXml(party.address1)}</Line1>\n`;
          if (party.address2) {
            xml += `        <Line2>${this.escapeXml(party.address2)}</Line2>\n`;
          }
          if (party.cityName) {
            xml += `        <City>${this.escapeXml(party.cityName)}</City>\n`;
          }
          if (party.stateOrProvinceCode) {
            xml += `        <State>${this.escapeXml(party.stateOrProvinceCode)}</State>\n`;
          }
          if (party.postalCode) {
            xml += `        <PostalCode>${this.escapeXml(party.postalCode)}</PostalCode>\n`;
          }
          if (party.countryCode) {
            xml += `        <CountryCode>${this.escapeXml(party.countryCode)}</CountryCode>\n`;
          }
          xml += '      </Address>\n';
        }

        if (party.partyCode) {
          xml += `      <Code>${this.escapeXml(party.partyCode)}</Code>\n`;
        }
        
        xml += '    </Party>\n';
      }
      xml += '  </Parties>\n';
    }

    // Locations in OneView format
    if (locations.length > 0) {
      xml += '  <Locations>\n';
      for (const location of locations) {
        const oneViewLocationType = this.mapLocationTypeToOneView(location.locationType);
        xml += `    <Location type="${oneViewLocationType}">\n`;
        
        if (location.locationId) {
          xml += `      <LocationCode>${this.escapeXml(location.locationId)}</LocationCode>\n`;
        }
        if (location.locationName) {
          xml += `      <LocationName>${this.escapeXml(location.locationName)}</LocationName>\n`;
        }
        if (location.countryCode) {
          xml += `      <CountryCode>${this.escapeXml(location.countryCode)}</CountryCode>\n`;
        }
        
        xml += '    </Location>\n';
      }
      xml += '  </Locations>\n';
    }

    // Equipment (Containers)
    if (containers.length > 0) {
      xml += '  <Equipment>\n';
      for (const container of containers) {
        xml += '    <Container>\n';
        
        if (container.equipmentNumber) {
          xml += `      <ContainerNumber>${this.escapeXml(container.equipmentNumber)}</ContainerNumber>\n`;
        }
        if (container.equipmentTypeCode) {
          xml += `      <ContainerType>${this.escapeXml(container.equipmentTypeCode)}</ContainerType>\n`;
        }
        
        // Seal numbers
        const seals = [container.sealNumber1, container.sealNumber2, container.sealNumber3]
          .filter(Boolean);
        if (seals.length > 0) {
          xml += '      <SealNumbers>\n';
          seals.forEach(seal => {
            xml += `        <Seal>${this.escapeXml(seal)}</Seal>\n`;
          });
          xml += '      </SealNumbers>\n';
        }

        // Container contents
        const containerContents = contents.filter(c => c.containerId === container.id);
        if (containerContents.length > 0) {
          xml += '      <Cargo>\n';
          for (const content of containerContents) {
            xml += '        <CargoItem>\n';
            
            if (content.description) {
              xml += `          <Description>${this.escapeXml(content.description)}</Description>\n`;
            }
            if (content.quantityShipped) {
              xml += `          <Quantity>${content.quantityShipped}</Quantity>\n`;
            }
            if (content.unitOfMeasure) {
              xml += `          <Unit>${this.escapeXml(content.unitOfMeasure)}</Unit>\n`;
            }
            if (content.grossWeight) {
              xml += `          <GrossWeight unit="${this.escapeXml(content.weightUnit || 'KG')}">${content.grossWeight}</GrossWeight>\n`;
            }
            if (content.netWeight) {
              xml += `          <NetWeight unit="${this.escapeXml(content.weightUnit || 'KG')}">${content.netWeight}</NetWeight>\n`;
            }
            if (content.volume) {
              xml += `          <Volume unit="${this.escapeXml(content.volumeUnit || 'CBM')}">${content.volume}</Volume>\n`;
            }
            if (content.value) {
              xml += `          <Value>${content.value}</Value>\n`;
            }
            if (content.htsNumber) {
              xml += `          <HarmonizedCode>${this.escapeXml(content.htsNumber)}</HarmonizedCode>\n`;
            }
            
            xml += '        </CargoItem>\n';
          }
          xml += '      </Cargo>\n';
        }
        
        xml += '    </Container>\n';
      }
      xml += '  </Equipment>\n';
    }

    // Charges in OneView format
    if (charges.length > 0) {
      xml += '  <Charges>\n';
      for (const charge of charges) {
        xml += '    <Charge>\n';
        xml += `      <ChargeCode>${this.escapeXml(charge.chargeCode || charge.chargeType)}</ChargeCode>\n`;
        
        if (charge.description) {
          xml += `      <Description>${this.escapeXml(charge.description)}</Description>\n`;
        }
        if (charge.chargeAmount) {
          xml += `      <Amount currency="${this.escapeXml(charge.currency || 'USD')}">${charge.chargeAmount}</Amount>\n`;
        }
        if (charge.paymentMethod) {
          xml += `      <PaymentTerms>${this.escapeXml(charge.paymentMethod)}</PaymentTerms>\n`;
        }
        
        xml += '    </Charge>\n';
      }
      xml += '  </Charges>\n';
    }

    xml += '</OneViewShipment>';
    return xml;
  }

  /**
   * Generate EDIFACT XML format for OneView
   */
  private generateEDIFACTXML(
    shipment: any,
    parties: any[],
    locations: any[],
    containers: any[],
    contents: any[],
    charges: any[]
  ): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<EDIFACT_INTERCHANGE>\n';
    xml += '  <UNB>\n';
    xml += '    <S001>\n';
    xml += '      <E0001>UNOC</E0001>\n';
    xml += '      <E0002>3</E0002>\n';
    xml += '    </S001>\n';
    xml += '    <S002>\n';
    xml += '      <E0004>FREIGHTCLEAR</E0004>\n';
    xml += '    </S002>\n';
    xml += '    <S003>\n';
    xml += '      <E0010>ONEVIEW</E0010>\n';
    xml += '    </S003>\n';
    xml += `    <S004>\n`;
    xml += `      <E0017>${new Date().toISOString().slice(0, 8).replace(/-/g, '')}</E0017>\n`;
    xml += `      <E0019>${new Date().toISOString().slice(11, 16).replace(':', '')}</E0019>\n`;
    xml += `    </S004>\n`;
    xml += `    <E0020>${shipment.transactionId}</E0020>\n`;
    xml += '  </UNB>\n';

    xml += '  <UNH>\n';
    xml += `    <E0062>${shipment.transactionId}</E0062>\n`;
    xml += '    <S009>\n';
    xml += '      <E0065>COPRAR</E0065>\n';
    xml += '      <E0052>D</E0052>\n';
    xml += '      <E0054>03B</E0054>\n';
    xml += '      <E0051>UN</E0051>\n';
    xml += '    </S009>\n';
    xml += '  </UNH>\n';

    // BGM - Beginning of message
    xml += '  <BGM>\n';
    xml += '    <C002>\n';
    xml += '      <E1001>85</E1001>\n';
    xml += '    </C002>\n';
    xml += `    <E1004>${this.escapeXml(shipment.transactionId)}</E1004>\n`;
    xml += '    <E1225>9</E1225>\n';
    xml += '  </BGM>\n';

    // DTM - Date/time/period
    if (shipment.departureDateTime) {
      xml += '  <DTM>\n';
      xml += '    <C507>\n';
      xml += '      <E2005>133</E2005>\n';
      xml += `      <E2380>${shipment.departureDateTime.toISOString().slice(0, 12).replace(/[-:]/g, '')}</E2380>\n`;
      xml += '      <E2379>203</E2379>\n';
      xml += '    </C507>\n';
      xml += '  </DTM>\n';
    }

    // Add transport and equipment details in EDIFACT format
    if (shipment.vesselName || shipment.voyageFlightNumber) {
      xml += '  <TDT>\n';
      xml += '    <E8051>20</E8051>\n';
      if (shipment.voyageFlightNumber) {
        xml += `    <E8028>${this.escapeXml(shipment.voyageFlightNumber)}</E8028>\n`;
      }
      xml += '    <C220>\n';
      xml += '      <E8067>1</E8067>\n';
      xml += '    </C220>\n';
      if (shipment.vesselName) {
        xml += '    <C001>\n';
        xml += `      <E8213>${this.escapeXml(shipment.vesselName)}</E8213>\n`;
        xml += '    </C001>\n';
      }
      xml += '  </TDT>\n';
    }

    xml += '  <UNT>\n';
    xml += '    <E0074>10</E0074>\n';
    xml += `    <E0062>${shipment.transactionId}</E0062>\n`;
    xml += '  </UNT>\n';
    
    xml += '  <UNZ>\n';
    xml += '    <E0036>1</E0036>\n';
    xml += `    <E0020>${shipment.transactionId}</E0020>\n`;
    xml += '  </UNZ>\n';
    
    xml += '</EDIFACT_INTERCHANGE>';
    return xml;
  }

  /**
   * Generate Cargo XML format for air shipments
   */
  private generateCargoXML(
    shipment: any,
    parties: any[],
    locations: any[],
    containers: any[],
    contents: any[],
    charges: any[]
  ): string {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<CargoXML xmlns="http://www.iata.org/cargoxml" version="3.0">\n';
    xml += '  <MessageHeader>\n';
    xml += `    <MessageId>${this.escapeXml(shipment.transactionId)}</MessageId>\n`;
    xml += `    <Timestamp>${new Date().toISOString()}</Timestamp>\n`;
    xml += '    <Source>FreightClear</Source>\n';
    xml += '    <Destination>OneView</Destination>\n';
    xml += '  </MessageHeader>\n';

    xml += '  <AirWaybill>\n';
    if (shipment.masterBillNumber) {
      xml += `    <AWBNumber>${this.escapeXml(shipment.masterBillNumber)}</AWBNumber>\n`;
    }
    if (shipment.houseBillNumber) {
      xml += `    <HouseAWB>${this.escapeXml(shipment.houseBillNumber)}</HouseAWB>\n`;
    }

    // Origin and Destination
    const origin = locations.find(l => l.locationType === 'origin' || l.locationType === 'departure');
    const destination = locations.find(l => l.locationType === 'destination' || l.locationType === 'arrival');

    if (origin) {
      xml += `    <OriginAirport>${this.escapeXml(origin.locationId || origin.locationName)}</OriginAirport>\n`;
    }
    if (destination) {
      xml += `    <DestinationAirport>${this.escapeXml(destination.locationId || destination.locationName)}</DestinationAirport>\n`;
    }

    // Flight information
    if (shipment.voyageFlightNumber) {
      xml += `    <FlightNumber>${this.escapeXml(shipment.voyageFlightNumber)}</FlightNumber>\n`;
    }
    if (shipment.departureDateTime) {
      xml += `    <FlightDate>${shipment.departureDateTime.toISOString().slice(0, 10)}</FlightDate>\n`;
    }

    // Shipper and Consignee
    const shipper = parties.find(p => p.partyType === 'shipper');
    const consignee = parties.find(p => p.partyType === 'consignee');

    if (shipper) {
      xml += '    <Shipper>\n';
      xml += `      <Name>${this.escapeXml(shipper.name)}</Name>\n`;
      xml += `      <Address>${this.escapeXml([shipper.address1, shipper.address2].filter(Boolean).join(', '))}</Address>\n`;
      xml += `      <City>${this.escapeXml(shipper.cityName || '')}</City>\n`;
      xml += `      <Country>${this.escapeXml(shipper.countryCode || '')}</Country>\n`;
      xml += '    </Shipper>\n';
    }

    if (consignee) {
      xml += '    <Consignee>\n';
      xml += `      <Name>${this.escapeXml(consignee.name)}</Name>\n`;
      xml += `      <Address>${this.escapeXml([consignee.address1, consignee.address2].filter(Boolean).join(', '))}</Address>\n`;
      xml += `      <City>${this.escapeXml(consignee.cityName || '')}</City>\n`;
      xml += `      <Country>${this.escapeXml(consignee.countryCode || '')}</Country>\n`;
      xml += '    </Consignee>\n';
    }

    // Cargo details
    if (contents.length > 0) {
      xml += '    <CargoDetails>\n';
      let totalWeight = 0;
      let totalVolume = 0;

      for (const content of contents) {
        xml += '      <Package>\n';
        if (content.description) {
          xml += `        <Description>${this.escapeXml(content.description)}</Description>\n`;
        }
        if (content.quantityShipped) {
          xml += `        <Pieces>${content.quantityShipped}</Pieces>\n`;
        }
        if (content.grossWeight) {
          xml += `        <Weight unit="${this.escapeXml(content.weightUnit || 'KG')}">${content.grossWeight}</Weight>\n`;
          totalWeight += parseFloat(content.grossWeight.toString());
        }
        if (content.volume) {
          xml += `        <Volume unit="${this.escapeXml(content.volumeUnit || 'CBM')}">${content.volume}</Volume>\n`;
          totalVolume += parseFloat(content.volume.toString());
        }
        xml += '      </Package>\n';
      }

      xml += `      <TotalWeight>${totalWeight}</TotalWeight>\n`;
      xml += `      <TotalVolume>${totalVolume}</TotalVolume>\n`;
      xml += '    </CargoDetails>\n';
    }

    xml += '  </AirWaybill>\n';
    xml += '</CargoXML>';
    return xml;
  }

  /**
   * Map transport mode to OneView format
   */
  private mapTransportMode(mode?: string): string {
    const modeMap: { [key: string]: string } = {
      'ocean': 'SEA',
      'air': 'AIR',
      'trucking': 'TRUCK',
      'rail': 'RAIL',
      'multimodal': 'MULTI'
    };
    return modeMap[mode?.toLowerCase() || ''] || 'SEA';
  }

  /**
   * Map party type to OneView format
   */
  private mapPartyTypeToOneView(partyType: string): string {
    const typeMap: { [key: string]: string } = {
      'shipper': 'SH',
      'consignee': 'CN',
      'notify_party': 'NP',
      'carrier': 'CA',
      'agent': 'AG',
      'broker': 'CB'
    };
    return typeMap[partyType.toLowerCase()] || partyType.toUpperCase();
  }

  /**
   * Map location type to OneView format
   */
  private mapLocationTypeToOneView(locationType: string): string {
    const typeMap: { [key: string]: string } = {
      'origin': 'POL',
      'destination': 'POD',
      'departure': 'POL',
      'arrival': 'POD',
      'loading': 'POL',
      'discharge': 'POD'
    };
    return typeMap[locationType.toLowerCase()] || locationType.toUpperCase();
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(str: string): string {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Batch export multiple shipments to OneView XML
   */
  async batchExportToOneView(
    shipmentIds: number[],
    format: 'edifact' | 'cargo-xml' | 'oneview-standard' = 'oneview-standard'
  ): Promise<{ shipmentId: number; xml: string; success: boolean; error?: string }[]> {
    const results = [];

    for (const shipmentId of shipmentIds) {
      try {
        const xml = await this.exportToOneViewXML(shipmentId, format);
        results.push({
          shipmentId,
          xml,
          success: true
        });
      } catch (error: any) {
        results.push({
          shipmentId,
          xml: '',
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}