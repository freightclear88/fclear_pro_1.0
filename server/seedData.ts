import { storage } from "./storage";

export async function seedTestData(userId: string) {
  try {
    // Create sample shipments with different transport modes
    const airShipment = await storage.createShipment({
      userId,
      shipmentId: "AIR-2025-001",
      origin: "Shanghai, China",
      originPort: "PVG",
      destination: "Los Angeles, USA", 
      destinationPort: "LAX",
      transportMode: "air",
      status: "in_transit",
      vessel: "Lufthansa Cargo Flight LH8123",
      totalValue: "125000.00",
    });

    const oceanShipment = await storage.createShipment({
      userId,
      shipmentId: "SEA-2025-002",
      origin: "Hamburg, Germany",
      originPort: "DEHAM",
      destination: "New York, USA",
      destinationPort: "USNYC",
      transportMode: "ocean",
      status: "arrived",
      vessel: "MSC Gulsun",
      containerNumber: "MSCU4567890",
      billOfLading: "MSC240125001",
      totalValue: "450000.00",
    });

    const truckingShipment = await storage.createShipment({
      userId,
      shipmentId: "TRK-2025-003",
      origin: "Toronto, Canada",
      destination: "Chicago, USA",
      transportMode: "trucking",
      status: "delivered",
      vessel: "Freightliner Cascadia - Driver: John Smith",
      totalValue: "75000.00",
    });

    const pendingShipment = await storage.createShipment({
      userId,
      shipmentId: "SEA-2025-004",
      origin: "Shenzhen, China",
      originPort: "CNSZX",
      destination: "Long Beach, USA",
      destinationPort: "USLGB",
      transportMode: "ocean",
      status: "pending",
      vessel: "OOCL Hong Kong",
      containerNumber: "OOLU1234567",
      billOfLading: "OOCL240125002",
      totalValue: "320000.00",
    });

    // Create sample documents
    await storage.createDocument({
      userId,
      shipmentId: airShipment.id,
      fileName: "awb_air2025001.pdf",
      originalName: "Air Waybill - AIR-2025-001.pdf",
      fileType: "application/pdf",
      fileSize: 2048576,
      category: "airway_bill",
      status: "processed",
      filePath: "/uploads/awb_air2025001.pdf",
    });

    await storage.createDocument({
      userId,
      shipmentId: oceanShipment.id,
      fileName: "bol_sea2025002.pdf",
      originalName: "Bill of Lading - SEA-2025-002.pdf",
      fileType: "application/pdf",
      fileSize: 1536000,
      category: "bill_of_lading",
      status: "processed",
      filePath: "/uploads/bol_sea2025002.pdf",
    });

    await storage.createDocument({
      userId,
      shipmentId: oceanShipment.id,
      fileName: "commercial_invoice_sea2025002.pdf",
      originalName: "Commercial Invoice - SEA-2025-002.pdf",
      fileType: "application/pdf",
      fileSize: 856432,
      category: "commercial_invoice",
      status: "processed",
      filePath: "/uploads/commercial_invoice_sea2025002.pdf",
    });

    await storage.createDocument({
      userId,
      shipmentId: pendingShipment.id,
      fileName: "isf_sea2025004.pdf",
      originalName: "ISF Data Sheet - SEA-2025-004.pdf",
      fileType: "application/pdf",
      fileSize: 1024000,
      category: "isf_data_sheet",
      status: "pending",
      filePath: "/uploads/isf_sea2025004.pdf",
    });

    console.log("✅ Test data seeded successfully");
    return {
      shipments: [airShipment, oceanShipment, truckingShipment, pendingShipment],
      message: "Test environment ready with sample data"
    };
  } catch (error) {
    console.error("❌ Error seeding test data:", error);
    throw error;
  }
}