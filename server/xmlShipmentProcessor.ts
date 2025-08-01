import { parseStringPromise } from 'xml2js';
import { db } from './db';
import {
  xmlShipments,
  shipmentParties,
  shipmentLocations,
  shipmentContainers,
  containerContents,
  shipmentCharges,
  type InsertXmlShipment,
  type InsertShipmentParty,
  type InsertShipmentLocation,
  type InsertShipmentContainer,
  type InsertContainerContent,
  type InsertShipmentCharge
} from '@shared/schema';

export interface XmlShipmentData {
  TransactionId: string;
  TransactionDateTime: string;
  TransactionSetPurpose?: string;
  ShipmentType?: string;
  DocumentDate?: string;
  FileNumber?: string;
  MasterBillNumber?: string;
  HouseBillNumber?: string;
  SubHouseBillNumber?: string;
  ITNumber?: string;
  BookingNumber?: string;
  OriginReference?: string;
  Division?: string;
  PaymentMethod?: string;
  TransportationMethod?: string;
  TypeOfMove?: string;
  VesselName?: string;
  VoyageFlightNumber?: string;
  DepartureDateTime?: string;
  ArrivalDateTime?: string;
  ImportDate?: string;
  FIRMSCode?: string;
  MarksNumbers?: string;
  Parties?: {
    Party: Array<{
      PartyType: string;
      PartyCode?: string;
      Name?: string;
  n?: string; // Alternative name field
      Address1?: string;
      Address2?: string;
      CityName?: string;
      StateOrProvinceCode?: string;
      PostalCode?: string;
      CountryCode?: string;
      IdCode?: string;
      IdCodeQualifier?: string;
    }>;
  };
  Locations?: {
    Location: Array<{
      LocationType: string;
      LocationIdQualifier?: string;
      LocationId?: string;
      LocationName?: string;
      StateOrProvinceCode?: string;
      CountryCode?: string;
    }>;
  };
  Containers?: {
    Container: Array<{
      EquipmentInitial?: string;
      EquipmentNumber?: string;
      SealNumber1?: string;
      SealNumber2?: string;
      SealNumber3?: string;
      EquipmentTypeCode?: string;
      Contents?: {
        Content: Array<{
          QuantityShipped?: number;
          UnitOfMeasure?: string;
          Description?: string;
          GrossWeight?: number;
          NetWeight?: number;
          WeightUnit?: string;
          VolumeWeight?: number;
          Volume?: number;
          VolumeUnit?: string;
          ScheduleBNumber?: string;
          HTSNumber?: string;
          Value?: number;
        }>;
      };
    }>;
  };
  Contents?: {
    Content: Array<{
      QuantityShipped?: number;
      UnitOfMeasure?: string;
      Description?: string;
      GrossWeight?: number;
      NetWeight?: number;
      WeightUnit?: string;
      VolumeWeight?: number;
      Volume?: number;
      VolumeUnit?: string;
      ScheduleBNumber?: string;
      HTSNumber?: string;
      Value?: number;
    }>;
  };
  Charges?: {
    Charge: Array<{
      ChargeType: string;
      ChargeStatus?: string;
      ChargeCode?: string;
      Description?: string;
      Basis?: string;
      QuantityInvoiced?: number;
      ChargeUnit?: string;
      Rate?: number;
      ChargeAmount?: number;
      Currency?: string;
      PaymentMethod?: string;
    }>;
  };
}

export class XmlShipmentProcessor {
  /**
   * Process XML shipment data and store in hierarchical database structure
   */
  async processXmlShipment(xmlContent: string, userId: string): Promise<number> {
    try {
      // Parse XML content
      const parsedXml = await parseStringPromise(xmlContent, {
        explicitArray: false,
        mergeAttrs: true,
        trim: true
      });

      const shipmentData = parsedXml.Shipment as XmlShipmentData;
      
      if (!shipmentData) {
        throw new Error('Invalid XML structure: No Shipment element found');
      }

      console.log('Processing XML shipment:', shipmentData.TransactionId);

      // Start database transaction
      return await db.transaction(async (tx) => {
        // 1. Create main shipment record
        const shipmentRecord: InsertXmlShipment = {
          shipmentId: this.generateShipmentId(shipmentData),
          userId,
          transactionId: shipmentData.TransactionId,
          transactionDateTime: new Date(shipmentData.TransactionDateTime),
          transactionSetPurpose: shipmentData.TransactionSetPurpose || 'Add',
          shipmentType: shipmentData.ShipmentType || 'Master',
          documentDate: shipmentData.DocumentDate ? new Date(shipmentData.DocumentDate) : null,
          fileNumber: shipmentData.FileNumber,
          masterBillNumber: shipmentData.MasterBillNumber,
          houseBillNumber: shipmentData.HouseBillNumber,
          subHouseBillNumber: shipmentData.SubHouseBillNumber,
          itNumber: shipmentData.ITNumber,
          bookingNumber: shipmentData.BookingNumber,
          originReference: shipmentData.OriginReference,
          division: shipmentData.Division,
          paymentMethod: shipmentData.PaymentMethod,
          transportationMethod: shipmentData.TransportationMethod,
          typeOfMove: shipmentData.TypeOfMove,
          vesselName: shipmentData.VesselName,
          voyageFlightNumber: shipmentData.VoyageFlightNumber,
          departureDateTime: shipmentData.DepartureDateTime ? new Date(shipmentData.DepartureDateTime) : null,
          arrivalDateTime: shipmentData.ArrivalDateTime ? new Date(shipmentData.ArrivalDateTime) : null,
          importDate: shipmentData.ImportDate ? new Date(shipmentData.ImportDate) : null,
          firmsCode: shipmentData.FIRMSCode,
          marksNumbers: shipmentData.MarksNumbers,
          xmlData: parsedXml,
          xmlVersion: '1.0'
        };

        const [insertedShipment] = await tx.insert(xmlShipments).values(shipmentRecord).returning();
        const shipmentId = insertedShipment.id;

        // 2. Process Parties
        if (shipmentData.Parties?.Party) {
          const parties = Array.isArray(shipmentData.Parties.Party) 
            ? shipmentData.Parties.Party 
            : [shipmentData.Parties.Party];

          for (const party of parties) {
            const partyRecord: InsertShipmentParty = {
              shipmentId,
              partyType: party.PartyType,
              partyCode: party.PartyCode,
              name: party.Name || party.n || 'Unknown',
              address1: party.Address1,
              address2: party.Address2,
              cityName: party.CityName,
              stateOrProvinceCode: party.StateOrProvinceCode,
              postalCode: party.PostalCode,
              countryCode: party.CountryCode,
              idCode: party.IdCode,
              idCodeQualifier: party.IdCodeQualifier
            };

            await tx.insert(shipmentParties).values(partyRecord);
          }
        }

        // 3. Process Locations
        if (shipmentData.Locations?.Location) {
          const locations = Array.isArray(shipmentData.Locations.Location)
            ? shipmentData.Locations.Location
            : [shipmentData.Locations.Location];

          for (const location of locations) {
            const locationRecord: InsertShipmentLocation = {
              shipmentId,
              locationType: location.LocationType,
              locationIdQualifier: location.LocationIdQualifier,
              locationId: location.LocationId,
              locationName: location.LocationName,
              stateOrProvinceCode: location.StateOrProvinceCode,
              countryCode: location.CountryCode
            };

            await tx.insert(shipmentLocations).values(locationRecord);
          }
        }

        // 4. Process Containers and their Contents
        if (shipmentData.Containers?.Container) {
          const containers = Array.isArray(shipmentData.Containers.Container)
            ? shipmentData.Containers.Container
            : [shipmentData.Containers.Container];

          for (const container of containers) {
            const containerRecord: InsertShipmentContainer = {
              shipmentId,
              equipmentInitial: container.EquipmentInitial,
              equipmentNumber: container.EquipmentNumber,
              fullContainerNumber: container.EquipmentInitial && container.EquipmentNumber 
                ? `${container.EquipmentInitial}${container.EquipmentNumber}`
                : null,
              sealNumber1: container.SealNumber1,
              sealNumber2: container.SealNumber2,
              sealNumber3: container.SealNumber3,
              equipmentTypeCode: container.EquipmentTypeCode
            };

            const [insertedContainer] = await tx.insert(shipmentContainers)
              .values(containerRecord)
              .returning();

            // Process container contents
            if (container.Contents?.Content) {
              const contents = Array.isArray(container.Contents.Content)
                ? container.Contents.Content
                : [container.Contents.Content];

              for (const content of contents) {
                const contentRecord: InsertContainerContent = {
                  containerId: insertedContainer.id,
                  shipmentId,
                  quantityShipped: content.QuantityShipped?.toString(),
                  unitOfMeasure: content.UnitOfMeasure,
                  description: content.Description,
                  grossWeight: content.GrossWeight?.toString(),
                  netWeight: content.NetWeight?.toString(),
                  weightUnit: content.WeightUnit || 'KG',
                  volumeWeight: content.VolumeWeight?.toString(),
                  volume: content.Volume?.toString(),
                  volumeUnit: content.VolumeUnit || 'CBM',
                  scheduleBNumber: content.ScheduleBNumber,
                  htsNumber: content.HTSNumber,
                  value: content.Value?.toString(),
                  currency: 'USD'
                };

                await tx.insert(containerContents).values(contentRecord);
              }
            }
          }
        }

        // 5. Process Shipment-level Contents (if any)
        if (shipmentData.Contents?.Content) {
          const contents = Array.isArray(shipmentData.Contents.Content)
            ? shipmentData.Contents.Content
            : [shipmentData.Contents.Content];

          for (const content of contents) {
            const contentRecord: InsertContainerContent = {
              containerId: null as any, // No specific container for shipment-level contents
              shipmentId,
              quantityShipped: content.QuantityShipped?.toString(),
              unitOfMeasure: content.UnitOfMeasure,
              description: content.Description,
              grossWeight: content.GrossWeight?.toString(),
              netWeight: content.NetWeight?.toString(),
              weightUnit: content.WeightUnit || 'KG',
              volumeWeight: content.VolumeWeight?.toString(),
              volume: content.Volume?.toString(),
              volumeUnit: content.VolumeUnit || 'CBM',
              scheduleBNumber: content.ScheduleBNumber,
              htsNumber: content.HTSNumber,
              value: content.Value?.toString(),
              currency: 'USD'
            };

            await tx.insert(containerContents).values(contentRecord);
          }
        }

        // 6. Process Charges
        if (shipmentData.Charges?.Charge) {
          const charges = Array.isArray(shipmentData.Charges.Charge)
            ? shipmentData.Charges.Charge
            : [shipmentData.Charges.Charge];

          for (const charge of charges) {
            const chargeRecord: InsertShipmentCharge = {
              shipmentId,
              chargeType: charge.ChargeType,
              chargeStatus: charge.ChargeStatus,
              chargeCode: charge.ChargeCode,
              description: charge.Description,
              basis: charge.Basis,
              quantityInvoiced: charge.QuantityInvoiced?.toString(),
              chargeUnit: charge.ChargeUnit,
              rate: charge.Rate?.toString(),
              chargeAmount: charge.ChargeAmount?.toString(),
              currency: charge.Currency || 'USD',
              paymentMethod: charge.PaymentMethod
            };

            await tx.insert(shipmentCharges).values(chargeRecord);
          }
        }

        console.log(`Successfully processed XML shipment with ID: ${shipmentId}`);
        return shipmentId;
      });

    } catch (error: any) {
      console.error('XML shipment processing failed:', error);
      throw new Error(`XML processing failed: ${error.message}`);
    }
  }

  /**
   * Generate a unique shipment ID based on XML data
   */
  private generateShipmentId(shipmentData: XmlShipmentData): string {
    const prefix = shipmentData.TransportationMethod === 'Air' ? 'AIR' : 'SEA';
    const timestamp = Date.now().toString().slice(-6);
    const billNumber = shipmentData.MasterBillNumber || shipmentData.HouseBillNumber || 'XML';
    
    return `${prefix}-${billNumber.slice(-6)}-${timestamp}`;
  }

  /**
   * Retrieve complete XML shipment data with all related records
   */
  async getXmlShipmentById(shipmentId: number) {
    try {
      // Get main shipment data
      const shipment = await db.query.xmlShipments.findFirst({
        where: (xmlShipments, { eq }) => eq(xmlShipments.id, shipmentId),
      });

      if (!shipment) {
        throw new Error(`Shipment with ID ${shipmentId} not found`);
      }

      // Get related data
      const [parties, locations, containers, contents, charges] = await Promise.all([
        db.query.shipmentParties.findMany({
          where: (shipmentParties, { eq }) => eq(shipmentParties.shipmentId, shipmentId),
        }),
        db.query.shipmentLocations.findMany({
          where: (shipmentLocations, { eq }) => eq(shipmentLocations.shipmentId, shipmentId),
        }),
        db.query.shipmentContainers.findMany({
          where: (shipmentContainers, { eq }) => eq(shipmentContainers.shipmentId, shipmentId),
        }),
        db.query.containerContents.findMany({
          where: (containerContents, { eq }) => eq(containerContents.shipmentId, shipmentId),
        }),
        db.query.shipmentCharges.findMany({
          where: (shipmentCharges, { eq }) => eq(shipmentCharges.shipmentId, shipmentId),
        }),
      ]);

      return {
        shipment,
        parties,
        locations,
        containers,
        contents,
        charges
      };

    } catch (error: any) {
      console.error('Failed to retrieve XML shipment:', error);
      throw new Error(`Failed to retrieve shipment: ${error.message}`);
    }
  }

  /**
   * Get all XML shipments for a user
   */
  async getXmlShipmentsByUser(userId: string) {
    try {
      return await db.query.xmlShipments.findMany({
        where: (xmlShipments, { eq }) => eq(xmlShipments.userId, userId),
        orderBy: (xmlShipments, { desc }) => [desc(xmlShipments.createdAt)]
      });
    } catch (error: any) {
      console.error('Failed to retrieve user XML shipments:', error);
      throw new Error(`Failed to retrieve shipments: ${error.message}`);
    }
  }
}

export const xmlShipmentProcessor = new XmlShipmentProcessor();