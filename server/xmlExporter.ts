import { db } from './db';
import { xmlShipments, shipmentParties, shipmentLocations, shipmentContainers, containerContents, shipmentCharges } from '@shared/schema';
import { eq } from 'drizzle-orm';

export class XmlExporter {
  /**
   * Export XML shipment data back to XML format for external platforms
   */
  async exportShipmentToXml(shipmentId: number): Promise<string> {
    try {
      // Get complete shipment data
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

      // Build XML structure
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<Shipment>\n';

      // Main shipment data
      xml += `  <TransactionId>${this.escapeXml(shipment.transactionId)}</TransactionId>\n`;
      xml += `  <TransactionDateTime>${shipment.transactionDateTime.toISOString()}</TransactionDateTime>\n`;
      xml += `  <TransactionSetPurpose>${this.escapeXml(shipment.transactionSetPurpose || 'Add')}</TransactionSetPurpose>\n`;
      xml += `  <ShipmentType>${this.escapeXml(shipment.shipmentType || 'Master')}</ShipmentType>\n`;
      
      if (shipment.documentDate) {
        xml += `  <DocumentDate>${shipment.documentDate.toISOString().split('T')[0]}</DocumentDate>\n`;
      }
      if (shipment.fileNumber) xml += `  <FileNumber>${this.escapeXml(shipment.fileNumber)}</FileNumber>\n`;
      if (shipment.masterBillNumber) xml += `  <MasterBillNumber>${this.escapeXml(shipment.masterBillNumber)}</MasterBillNumber>\n`;
      if (shipment.houseBillNumber) xml += `  <HouseBillNumber>${this.escapeXml(shipment.houseBillNumber)}</HouseBillNumber>\n`;
      if (shipment.subHouseBillNumber) xml += `  <SubHouseBillNumber>${this.escapeXml(shipment.subHouseBillNumber)}</SubHouseBillNumber>\n`;
      if (shipment.itNumber) xml += `  <ITNumber>${this.escapeXml(shipment.itNumber)}</ITNumber>\n`;
      if (shipment.bookingNumber) xml += `  <BookingNumber>${this.escapeXml(shipment.bookingNumber)}</BookingNumber>\n`;
      if (shipment.originReference) xml += `  <OriginReference>${this.escapeXml(shipment.originReference)}</OriginReference>\n`;
      if (shipment.division) xml += `  <Division>${this.escapeXml(shipment.division)}</Division>\n`;
      if (shipment.paymentMethod) xml += `  <PaymentMethod>${this.escapeXml(shipment.paymentMethod)}</PaymentMethod>\n`;
      if (shipment.transportationMethod) xml += `  <TransportationMethod>${this.escapeXml(shipment.transportationMethod)}</TransportationMethod>\n`;
      if (shipment.typeOfMove) xml += `  <TypeOfMove>${this.escapeXml(shipment.typeOfMove)}</TypeOfMove>\n`;
      if (shipment.vesselName) xml += `  <VesselName>${this.escapeXml(shipment.vesselName)}</VesselName>\n`;
      if (shipment.voyageFlightNumber) xml += `  <VoyageFlightNumber>${this.escapeXml(shipment.voyageFlightNumber)}</VoyageFlightNumber>\n`;
      
      if (shipment.departureDateTime) {
        xml += `  <DepartureDateTime>${shipment.departureDateTime.toISOString()}</DepartureDateTime>\n`;
      }
      if (shipment.arrivalDateTime) {
        xml += `  <ArrivalDateTime>${shipment.arrivalDateTime.toISOString()}</ArrivalDateTime>\n`;
      }
      if (shipment.importDate) {
        xml += `  <ImportDate>${shipment.importDate.toISOString().split('T')[0]}</ImportDate>\n`;
      }
      if (shipment.firmsCode) xml += `  <FIRMSCode>${this.escapeXml(shipment.firmsCode)}</FIRMSCode>\n`;
      if (shipment.marksNumbers) xml += `  <MarksNumbers>${this.escapeXml(shipment.marksNumbers)}</MarksNumbers>\n`;

      // Parties
      if (parties.length > 0) {
        xml += '  <Parties>\n';
        for (const party of parties) {
          xml += '    <Party>\n';
          xml += `      <PartyType>${this.escapeXml(party.partyType)}</PartyType>\n`;
          if (party.partyCode) xml += `      <PartyCode>${this.escapeXml(party.partyCode)}</PartyCode>\n`;
          xml += `      <Name>${this.escapeXml(party.name)}</Name>\n`;
          if (party.address1) xml += `      <Address1>${this.escapeXml(party.address1)}</Address1>\n`;
          if (party.address2) xml += `      <Address2>${this.escapeXml(party.address2)}</Address2>\n`;
          if (party.cityName) xml += `      <CityName>${this.escapeXml(party.cityName)}</CityName>\n`;
          if (party.stateOrProvinceCode) xml += `      <StateOrProvinceCode>${this.escapeXml(party.stateOrProvinceCode)}</StateOrProvinceCode>\n`;
          if (party.postalCode) xml += `      <PostalCode>${this.escapeXml(party.postalCode)}</PostalCode>\n`;
          if (party.countryCode) xml += `      <CountryCode>${this.escapeXml(party.countryCode)}</CountryCode>\n`;
          if (party.idCode) xml += `      <IdCode>${this.escapeXml(party.idCode)}</IdCode>\n`;
          if (party.idCodeQualifier) xml += `      <IdCodeQualifier>${this.escapeXml(party.idCodeQualifier)}</IdCodeQualifier>\n`;
          xml += '    </Party>\n';
        }
        xml += '  </Parties>\n';
      }

      // Locations
      if (locations.length > 0) {
        xml += '  <Locations>\n';
        for (const location of locations) {
          xml += '    <Location>\n';
          xml += `      <LocationType>${this.escapeXml(location.locationType)}</LocationType>\n`;
          if (location.locationIdQualifier) xml += `      <LocationIdQualifier>${this.escapeXml(location.locationIdQualifier)}</LocationIdQualifier>\n`;
          if (location.locationId) xml += `      <LocationId>${this.escapeXml(location.locationId)}</LocationId>\n`;
          if (location.locationName) xml += `      <LocationName>${this.escapeXml(location.locationName)}</LocationName>\n`;
          if (location.stateOrProvinceCode) xml += `      <StateOrProvinceCode>${this.escapeXml(location.stateOrProvinceCode)}</StateOrProvinceCode>\n`;
          if (location.countryCode) xml += `      <CountryCode>${this.escapeXml(location.countryCode)}</CountryCode>\n`;
          xml += '    </Location>\n';
        }
        xml += '  </Locations>\n';
      }

      // Containers with Contents
      if (containers.length > 0) {
        xml += '  <Containers>\n';
        for (const container of containers) {
          xml += '    <Container>\n';
          if (container.equipmentInitial) xml += `      <EquipmentInitial>${this.escapeXml(container.equipmentInitial)}</EquipmentInitial>\n`;
          if (container.equipmentNumber) xml += `      <EquipmentNumber>${this.escapeXml(container.equipmentNumber)}</EquipmentNumber>\n`;
          if (container.sealNumber1) xml += `      <SealNumber1>${this.escapeXml(container.sealNumber1)}</SealNumber1>\n`;
          if (container.sealNumber2) xml += `      <SealNumber2>${this.escapeXml(container.sealNumber2)}</SealNumber2>\n`;
          if (container.sealNumber3) xml += `      <SealNumber3>${this.escapeXml(container.sealNumber3)}</SealNumber3>\n`;
          if (container.equipmentTypeCode) xml += `      <EquipmentTypeCode>${this.escapeXml(container.equipmentTypeCode)}</EquipmentTypeCode>\n`;

          // Container contents
          const containerContents = contents.filter(c => c.containerId === container.id);
          if (containerContents.length > 0) {
            xml += '      <Contents>\n';
            for (const content of containerContents) {
              xml += '        <Content>\n';
              if (content.quantityShipped) xml += `          <QuantityShipped>${content.quantityShipped}</QuantityShipped>\n`;
              if (content.unitOfMeasure) xml += `          <UnitOfMeasure>${this.escapeXml(content.unitOfMeasure)}</UnitOfMeasure>\n`;
              if (content.description) xml += `          <Description>${this.escapeXml(content.description)}</Description>\n`;
              if (content.grossWeight) xml += `          <GrossWeight>${content.grossWeight}</GrossWeight>\n`;
              if (content.netWeight) xml += `          <NetWeight>${content.netWeight}</NetWeight>\n`;
              if (content.weightUnit) xml += `          <WeightUnit>${this.escapeXml(content.weightUnit)}</WeightUnit>\n`;
              if (content.volumeWeight) xml += `          <VolumeWeight>${content.volumeWeight}</VolumeWeight>\n`;
              if (content.volume) xml += `          <Volume>${content.volume}</Volume>\n`;
              if (content.volumeUnit) xml += `          <VolumeUnit>${this.escapeXml(content.volumeUnit)}</VolumeUnit>\n`;
              if (content.scheduleBNumber) xml += `          <ScheduleBNumber>${this.escapeXml(content.scheduleBNumber)}</ScheduleBNumber>\n`;
              if (content.htsNumber) xml += `          <HTSNumber>${this.escapeXml(content.htsNumber)}</HTSNumber>\n`;
              if (content.value) xml += `          <Value>${content.value}</Value>\n`;
              xml += '        </Content>\n';
            }
            xml += '      </Contents>\n';
          }
          xml += '    </Container>\n';
        }
        xml += '  </Containers>\n';
      }

      // Shipment-level Contents (no specific container)
      const shipmentContents = contents.filter(c => c.containerId === null);
      if (shipmentContents.length > 0) {
        xml += '  <Contents>\n';
        for (const content of shipmentContents) {
          xml += '    <Content>\n';
          if (content.quantityShipped) xml += `      <QuantityShipped>${content.quantityShipped}</QuantityShipped>\n`;
          if (content.unitOfMeasure) xml += `      <UnitOfMeasure>${this.escapeXml(content.unitOfMeasure)}</UnitOfMeasure>\n`;
          if (content.description) xml += `      <Description>${this.escapeXml(content.description)}</Description>\n`;
          if (content.grossWeight) xml += `      <GrossWeight>${content.grossWeight}</GrossWeight>\n`;
          if (content.netWeight) xml += `      <NetWeight>${content.netWeight}</NetWeight>\n`;
          if (content.weightUnit) xml += `      <WeightUnit>${this.escapeXml(content.weightUnit)}</WeightUnit>\n`;
          if (content.volumeWeight) xml += `      <VolumeWeight>${content.volumeWeight}</VolumeWeight>\n`;
          if (content.volume) xml += `      <Volume>${content.volume}</Volume>\n`;
          if (content.volumeUnit) xml += `      <VolumeUnit>${this.escapeXml(content.volumeUnit)}</VolumeUnit>\n`;
          if (content.scheduleBNumber) xml += `      <ScheduleBNumber>${this.escapeXml(content.scheduleBNumber)}</ScheduleBNumber>\n`;
          if (content.htsNumber) xml += `      <HTSNumber>${this.escapeXml(content.htsNumber)}</HTSNumber>\n`;
          if (content.value) xml += `      <Value>${content.value}</Value>\n`;
          xml += '    </Content>\n';
        }
        xml += '  </Contents>\n';
      }

      // Charges
      if (charges.length > 0) {
        xml += '  <Charges>\n';
        for (const charge of charges) {
          xml += '    <Charge>\n';
          xml += `      <ChargeType>${this.escapeXml(charge.chargeType)}</ChargeType>\n`;
          if (charge.chargeStatus) xml += `      <ChargeStatus>${this.escapeXml(charge.chargeStatus)}</ChargeStatus>\n`;
          if (charge.chargeCode) xml += `      <ChargeCode>${this.escapeXml(charge.chargeCode)}</ChargeCode>\n`;
          if (charge.description) xml += `      <Description>${this.escapeXml(charge.description)}</Description>\n`;
          if (charge.basis) xml += `      <Basis>${this.escapeXml(charge.basis)}</Basis>\n`;
          if (charge.quantityInvoiced) xml += `      <QuantityInvoiced>${charge.quantityInvoiced}</QuantityInvoiced>\n`;
          if (charge.chargeUnit) xml += `      <ChargeUnit>${this.escapeXml(charge.chargeUnit)}</ChargeUnit>\n`;
          if (charge.rate) xml += `      <Rate>${charge.rate}</Rate>\n`;
          if (charge.chargeAmount) xml += `      <ChargeAmount>${charge.chargeAmount}</ChargeAmount>\n`;
          if (charge.currency) xml += `      <Currency>${this.escapeXml(charge.currency)}</Currency>\n`;
          if (charge.paymentMethod) xml += `      <PaymentMethod>${this.escapeXml(charge.paymentMethod)}</PaymentMethod>\n`;
          xml += '    </Charge>\n';
        }
        xml += '  </Charges>\n';
      }

      xml += '</Shipment>';
      return xml;

    } catch (error: any) {
      console.error('XML export failed:', error);
      throw new Error(`XML export failed: ${error.message}`);
    }
  }

  /**
   * Export shipment data to CSV format for spreadsheet applications
   */
  async exportShipmentToCsv(shipmentId: number): Promise<string> {
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

      let csv = '';

      // Main shipment CSV
      csv += 'Section,Field,Value\n';
      csv += `Main,Transaction ID,${this.escapeCsv(shipment.transactionId)}\n`;
      csv += `Main,Transaction Date,${shipment.transactionDateTime.toISOString()}\n`;
      csv += `Main,Shipment Type,${this.escapeCsv(shipment.shipmentType || '')}\n`;
      csv += `Main,Transportation Method,${this.escapeCsv(shipment.transportationMethod || '')}\n`;
      csv += `Main,Vessel Name,${this.escapeCsv(shipment.vesselName || '')}\n`;
      csv += `Main,Master Bill Number,${this.escapeCsv(shipment.masterBillNumber || '')}\n`;
      csv += `Main,House Bill Number,${this.escapeCsv(shipment.houseBillNumber || '')}\n`;
      csv += `Main,Booking Number,${this.escapeCsv(shipment.bookingNumber || '')}\n`;

      // Parties CSV
      if (parties.length > 0) {
        csv += '\nParty Type,Party Code,Name,Address,City,State,Postal Code,Country\n';
        for (const party of parties) {
          csv += `${this.escapeCsv(party.partyType)},`;
          csv += `${this.escapeCsv(party.partyCode || '')},`;
          csv += `${this.escapeCsv(party.name)},`;
          csv += `${this.escapeCsv([party.address1, party.address2].filter(Boolean).join(' '))},`;
          csv += `${this.escapeCsv(party.cityName || '')},`;
          csv += `${this.escapeCsv(party.stateOrProvinceCode || '')},`;
          csv += `${this.escapeCsv(party.postalCode || '')},`;
          csv += `${this.escapeCsv(party.countryCode || '')}\n`;
        }
      }

      // Containers and Contents CSV
      if (containers.length > 0 || contents.length > 0) {
        csv += '\nContainer Number,Container Type,Seal Numbers,Description,Quantity,Unit,Weight,Volume,Value\n';
        
        for (const container of containers) {
          const containerContents = contents.filter(c => c.containerId === container.id);
          const containerNumber = container.fullContainerNumber || `${container.equipmentInitial || ''}${container.equipmentNumber || ''}`;
          const sealNumbers = [container.sealNumber1, container.sealNumber2, container.sealNumber3].filter(Boolean).join(';');
          
          if (containerContents.length > 0) {
            for (const content of containerContents) {
              csv += `${this.escapeCsv(containerNumber)},`;
              csv += `${this.escapeCsv(container.equipmentTypeCode || '')},`;
              csv += `${this.escapeCsv(sealNumbers)},`;
              csv += `${this.escapeCsv(content.description || '')},`;
              csv += `${content.quantityShipped || ''},`;
              csv += `${this.escapeCsv(content.unitOfMeasure || '')},`;
              csv += `${content.grossWeight || ''} ${this.escapeCsv(content.weightUnit || '')},`;
              csv += `${content.volume || ''} ${this.escapeCsv(content.volumeUnit || '')},`;
              csv += `${this.escapeCsv(content.currency || '')} ${content.value || ''}\n`;
            }
          } else {
            csv += `${this.escapeCsv(containerNumber)},`;
            csv += `${this.escapeCsv(container.equipmentTypeCode || '')},`;
            csv += `${this.escapeCsv(sealNumbers)},,,,,\n`;
          }
        }

        // Shipment-level contents
        const shipmentContents = contents.filter(c => c.containerId === null);
        for (const content of shipmentContents) {
          csv += `(Shipment Level),,`;
          csv += `,${this.escapeCsv(content.description || '')},`;
          csv += `${content.quantityShipped || ''},`;
          csv += `${this.escapeCsv(content.unitOfMeasure || '')},`;
          csv += `${content.grossWeight || ''} ${this.escapeCsv(content.weightUnit || '')},`;
          csv += `${content.volume || ''} ${this.escapeCsv(content.volumeUnit || '')},`;
          csv += `${this.escapeCsv(content.currency || '')} ${content.value || ''}\n`;
        }
      }

      // Charges CSV
      if (charges.length > 0) {
        csv += '\nCharge Type,Description,Amount,Currency,Payment Method\n';
        for (const charge of charges) {
          csv += `${this.escapeCsv(charge.chargeType)},`;
          csv += `${this.escapeCsv(charge.description || '')},`;
          csv += `${charge.chargeAmount || ''},`;
          csv += `${this.escapeCsv(charge.currency || '')},`;
          csv += `${this.escapeCsv(charge.paymentMethod || '')}\n`;
        }
      }

      return csv;

    } catch (error: any) {
      console.error('CSV export failed:', error);
      throw new Error(`CSV export failed: ${error.message}`);
    }
  }

  /**
   * Export shipment data to JSON format for API integrations
   */
  async exportShipmentToJson(shipmentId: number): Promise<object> {
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

      return {
        shipment: {
          id: shipment.id,
          transactionId: shipment.transactionId,
          transactionDateTime: shipment.transactionDateTime,
          shipmentType: shipment.shipmentType,
          transportationMethod: shipment.transportationMethod,
          vesselName: shipment.vesselName,
          masterBillNumber: shipment.masterBillNumber,
          houseBillNumber: shipment.houseBillNumber,
          bookingNumber: shipment.bookingNumber,
          departureDateTime: shipment.departureDateTime,
          arrivalDateTime: shipment.arrivalDateTime,
          status: shipment.status,
        },
        parties: parties.map(party => ({
          type: party.partyType,
          code: party.partyCode,
          name: party.name,
          address: {
            line1: party.address1,
            line2: party.address2,
            city: party.cityName,
            state: party.stateOrProvinceCode,
            postalCode: party.postalCode,
            country: party.countryCode,
          },
          identification: {
            code: party.idCode,
            qualifier: party.idCodeQualifier,
          },
        })),
        locations: locations.map(location => ({
          type: location.locationType,
          identifier: {
            qualifier: location.locationIdQualifier,
            id: location.locationId,
          },
          name: location.locationName,
          state: location.stateOrProvinceCode,
          country: location.countryCode,
        })),
        containers: containers.map(container => ({
          number: container.fullContainerNumber || `${container.equipmentInitial || ''}${container.equipmentNumber || ''}`,
          type: container.equipmentTypeCode,
          seals: [container.sealNumber1, container.sealNumber2, container.sealNumber3].filter(Boolean),
          contents: contents.filter(c => c.containerId === container.id).map(content => ({
            description: content.description,
            quantity: {
              shipped: content.quantityShipped,
              unit: content.unitOfMeasure,
            },
            weight: {
              gross: content.grossWeight,
              net: content.netWeight,
              unit: content.weightUnit,
            },
            volume: {
              amount: content.volume,
              unit: content.volumeUnit,
            },
            value: {
              amount: content.value,
              currency: content.currency,
            },
            classification: {
              scheduleB: content.scheduleBNumber,
              hts: content.htsNumber,
            },
          })),
        })),
        shipmentContents: contents.filter(c => c.containerId === null).map(content => ({
          description: content.description,
          quantity: {
            shipped: content.quantityShipped,
            unit: content.unitOfMeasure,
          },
          weight: {
            gross: content.grossWeight,
            net: content.netWeight,
            unit: content.weightUnit,
          },
          volume: {
            amount: content.volume,
            unit: content.volumeUnit,
          },
          value: {
            amount: content.value,
            currency: content.currency,
          },
          classification: {
            scheduleB: content.scheduleBNumber,
            hts: content.htsNumber,
          },
        })),
        charges: charges.map(charge => ({
          type: charge.chargeType,
          description: charge.description,
          amount: charge.chargeAmount,
          currency: charge.currency,
          paymentMethod: charge.paymentMethod,
          status: charge.chargeStatus,
        })),
      };

    } catch (error: any) {
      console.error('JSON export failed:', error);
      throw new Error(`JSON export failed: ${error.message}`);
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private escapeCsv(str: string): string {
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }
}

export const xmlExporter = new XmlExporter();