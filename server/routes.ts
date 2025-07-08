import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertShipmentSchema, insertDocumentSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, JPEG, and PNG files are allowed"));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile management routes
  app.get('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put('/api/profile', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        firstName, 
        lastName, 
        companyName, 
        address, 
        city, 
        state, 
        zipCode, 
        country, 
        taxId, 
        taxIdType 
      } = req.body;

      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        companyName,
        address,
        city,
        state,
        zipCode,
        country,
        taxId,
        taxIdType,
        updatedAt: new Date(),
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Shipment routes
  app.get('/api/shipments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const shipments = await storage.getShipmentsByUserId(userId);
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching shipments:", error);
      res.status(500).json({ message: "Failed to fetch shipments" });
    }
  });

  app.get('/api/shipments/:id', isAuthenticated, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const shipment = await storage.getShipmentById(shipmentId);
      
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      
      // Check if user owns this shipment
      if (shipment.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(shipment);
    } catch (error) {
      console.error("Error fetching shipment:", error);
      res.status(500).json({ message: "Failed to fetch shipment" });
    }
  });

  app.post('/api/shipments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const shipmentData = insertShipmentSchema.parse({
        ...req.body,
        userId,
      });
      
      const shipment = await storage.createShipment(shipmentData);
      res.status(201).json(shipment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid shipment data", errors: error.errors });
      }
      console.error("Error creating shipment:", error);
      res.status(500).json({ message: "Failed to create shipment" });
    }
  });

  // Document routes
  app.get('/api/shipments/:shipmentId/documents', isAuthenticated, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.shipmentId);
      const userId = req.user.claims.sub;
      
      // Verify user owns the shipment
      const shipment = await storage.getShipmentById(shipmentId);
      if (!shipment || shipment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const documents = await storage.getDocumentsByShipmentId(shipmentId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Document upload route with shipment creation
  app.post('/api/documents/upload', upload.array('documents', 10), isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { shipmentId, category } = req.body;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      let createdShipment = null;

      // Check if this document type should create a new shipment
      const shouldCreateShipment = !shipmentId && ['bill_of_lading', 'arrival_notice', 'airway_bill', 'isf_data_sheet'].includes(category);
      
      if (shouldCreateShipment) {
        // Determine transport mode based on document type
        const transportMode = category === 'airway_bill' ? 'air' : 'ocean';
        
        // Generate shipment ID based on transport mode
        const prefix = transportMode === 'air' ? 'AIR' : 'SEA';
        const timestamp = Date.now().toString().slice(-6);
        const generatedShipmentId = `${prefix}-${timestamp}`;
        
        // Create new shipment
        createdShipment = await storage.createShipment({
          userId,
          shipmentId: generatedShipmentId,
          origin: "TBD - From Document Processing",
          destination: "TBD - From Document Processing",
          transportMode,
          status: 'pending',
        });
      }

      // Upload all documents
      const uploadedDocuments = [];
      for (const file of files) {
        // Ensure category is always valid
        const documentCategory = category && category.trim() ? category.trim() : 'other';
        
        const document = await storage.createDocument({
          userId,
          shipmentId: createdShipment?.id || (shipmentId ? parseInt(shipmentId) : undefined),
          fileName: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          category: documentCategory,
          status: 'pending',
          filePath: file.path,
        });

        // Create OCR processing job with mock extraction for now
        await storage.createOcrJob({
          documentId: document.id,
          status: 'pending',
        });

        // Enhanced mock OCR data extraction (in production, this would be processed by real OCR AI)
        const docTransportMode = documentCategory === 'airway_bill' ? 'air' : 'ocean';
        const mockOcrData = {
          shipmentId: `${docTransportMode === 'air' ? 'AIR' : 'SEA'}-${Math.floor(Math.random() * 900000) + 100000}`,
          origin: file.originalname.toLowerCase().includes('seattle') ? 'Seattle, WA' : 
                  file.originalname.toLowerCase().includes('los angeles') ? 'Los Angeles, CA' :
                  file.originalname.toLowerCase().includes('new york') ? 'New York, NY' : 'Various Origins',
          originPort: docTransportMode === 'ocean' ? (
            file.originalname.toLowerCase().includes('seattle') ? 'Port of Seattle' :
            file.originalname.toLowerCase().includes('los angeles') ? 'Port of Los Angeles' :
            file.originalname.toLowerCase().includes('new york') ? 'Port of New York/New Jersey' : 'TBD'
          ) : null,
          destination: file.originalname.toLowerCase().includes('miami') ? 'Miami, FL' : 
                      file.originalname.toLowerCase().includes('houston') ? 'Houston, TX' :
                      file.originalname.toLowerCase().includes('chicago') ? 'Chicago, IL' : 'Various Destinations',
          destinationPort: docTransportMode === 'ocean' ? (
            file.originalname.toLowerCase().includes('miami') ? 'Port of Miami' :
            file.originalname.toLowerCase().includes('houston') ? 'Port of Houston' : 'TBD'
          ) : null,
          containerNumber: docTransportMode === 'ocean' ? `MSCU${Math.floor(Math.random() * 9000000) + 1000000}0` : null,
          billOfLading: `BOL${Math.floor(Math.random() * 900000) + 100000}`,
          vessel: docTransportMode === 'ocean' ? ['MV OCEAN TRADER', 'MV CARGO EXPRESS', 'MV SEA NAVIGATOR'][Math.floor(Math.random() * 3)] : null,
          voyage: docTransportMode === 'ocean' ? `V${Math.floor(Math.random() * 900) + 100}E` : null,
          // Additional comprehensive data extraction
          cargoDescription: 'General Merchandise - Mixed Containerized Cargo',
          weight: `${Math.floor(Math.random() * 50000) + 10000} lbs`,
          volume: `${Math.floor(Math.random() * 1000) + 200} cbft`,
          pieces: Math.floor(Math.random() * 500) + 50,
          commodity: ['Electronics', 'Textiles', 'Machinery', 'Food Products', 'Automotive Parts'][Math.floor(Math.random() * 5)],
          shipperName: 'Global Trading Co., Ltd.',
          consigneeName: 'American Import Solutions Inc.',
          commercialInvoiceNumber: `CI-${Math.floor(Math.random() * 900000) + 100000}`,
          eta: new Date(Date.now() + Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000).toISOString(),
          etd: new Date(Date.now() - Math.floor(Math.random() * 15) * 24 * 60 * 60 * 1000).toISOString(),
          extractedText: `Document: ${file.originalname}\nType: ${documentCategory}\nProcessed: ${new Date().toISOString()}`
        };

        // Update document with extracted data
        await storage.updateDocument(document.id, {
          extractedData: mockOcrData,
          status: 'completed'
        });

        // Update the shipment with the extracted OCR data
        if (createdShipment && mockOcrData) {
          const updatedShipment = await storage.updateShipment(createdShipment.id, {
            origin: mockOcrData.origin || createdShipment.origin,
            originPort: mockOcrData.originPort || createdShipment.originPort,
            destination: mockOcrData.destination || createdShipment.destination,
            destinationPort: mockOcrData.destinationPort || createdShipment.destinationPort,
            vessel: mockOcrData.vessel || createdShipment.vessel,
            containerNumber: mockOcrData.containerNumber || createdShipment.containerNumber,
            billOfLading: mockOcrData.billOfLading || createdShipment.billOfLading,
            shipmentId: mockOcrData.shipmentId || createdShipment.shipmentId,
          });
          
          // Update the reference to the updated shipment
          createdShipment = updatedShipment;
        }

        uploadedDocuments.push({...document, extractedData: mockOcrData});
      }

      res.json({ 
        message: "Documents uploaded successfully", 
        documents: uploadedDocuments,
        shipment: createdShipment
      });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.post('/api/shipments/:shipmentId/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.shipmentId);
      const userId = req.user.claims.sub;
      const category = req.body.category || "other";
      
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      // Verify user owns the shipment
      const shipment = await storage.getShipmentById(shipmentId);
      if (!shipment || shipment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Create document record
      const document = await storage.createDocument({
        userId,
        shipmentId,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category,
        status: 'pending',
        filePath: req.file.path,
      });
      
      // Create OCR job
      await storage.createOcrJob({
        documentId: document.id,
        status: 'pending',
      });
      
      res.status(201).json(document);
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Dashboard stats route
  app.get('/api/dashboard/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const shipments = await storage.getShipmentsByUserId(userId);
      const documents = await storage.getDocumentsByUserId(userId);
      
      const activeShipments = shipments.filter(s => s.status !== "delivered").length;
      const pendingDocuments = documents.filter(d => d.status === "pending").length;
      const processedThisMonth = documents.filter(d => {
        const uploadDate = new Date(d.uploadedAt!);
        const thisMonth = new Date();
        return uploadDate.getMonth() === thisMonth.getMonth() && 
               uploadDate.getFullYear() === thisMonth.getFullYear();
      }).length;
      
      const totalValue = shipments.reduce((sum, s) => {
        return sum + (parseFloat(s.totalValue || "0"));
      }, 0);
      
      res.json({
        activeShipments,
        pendingDocuments,
        processedThisMonth,
        totalValue: `$${(totalValue / 1000000).toFixed(1)}M`,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Get all documents for user
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documents = await storage.getDocumentsByUserId(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document by ID for download
  app.get('/api/documents/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Get document and verify ownership
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      if (!document.filePath || !fs.existsSync(document.filePath)) {
        return res.status(404).json({ message: "File not found on disk" });
      }
      
      res.setHeader('Content-Disposition', `attachment; filename="${document.originalName || document.fileName}"`);
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      
      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error downloading document:", error);
      res.status(500).json({ message: "Failed to download document" });
    }
  });

  // Get document by ID for viewing
  app.get('/api/documents/:id', isAuthenticated, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      // Get document and verify ownership
      const document = await storage.getDocumentById(documentId);
      if (!document) {
        return res.status(404).json({ message: "Document not found" });
      }
      
      if (document.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(document);
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // HTML page for shipment data
  app.get('/shipment-html/:id', isAuthenticated, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const userId = req.user.claims.sub;
      
      const shipment = await storage.getShipmentById(shipmentId);
      if (!shipment || shipment.userId !== userId) {
        return res.status(403).send('<h1>Access Denied</h1>');
      }
      
      const documents = await storage.getDocumentsByShipmentId(shipmentId);
      
      const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Shipment ${shipment.shipmentId} - Freight Flow</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; line-height: 1.6; color: #333; background: #f8fafc; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #1d4ed8; color: white; padding: 2rem; border-radius: 12px; margin-bottom: 2rem; }
        .header h1 { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .header p { font-size: 1.2rem; opacity: 0.9; }
        .card { background: white; border-radius: 12px; padding: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .field-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
        .field { display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: #f1f5f9; border-radius: 8px; border-left: 4px solid #1d4ed8; }
        .field-label { font-weight: 600; color: #64748b; }
        .field-value { font-weight: 500; flex-grow: 1; margin: 0 1rem; text-align: right; }
        .copy-btn { background: #f97316; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem; transition: all 0.2s; }
        .copy-btn:hover { background: #ea580c; transform: translateY(-1px); }
        .copy-btn:active { transform: translateY(0); }
        .section-title { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin-bottom: 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
        .status-badge { padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
        .status-pending { background: #fef3c7; color: #92400e; }
        .status-active { background: #d1fae5; color: #065f46; }
        .status-delivered { background: #dbeafe; color: #1e40af; }
        .transport-mode { padding: 0.5rem 1rem; border-radius: 20px; font-weight: 600; color: white; }
        .mode-air { background: #8b5cf6; }
        .mode-ocean { background: #0ea5e9; }
        .mode-trucking { background: #059669; }
        .doc-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
        .doc-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
        .doc-name { font-weight: 600; color: #1e293b; }
        .doc-category { background: #e0e7ff; color: #3730a3; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.875rem; }
        .extracted-data { background: #f1f5f9; border-radius: 6px; padding: 1rem; margin-top: 0.5rem; font-family: monospace; font-size: 0.875rem; white-space: pre-wrap; max-height: 200px; overflow-y: auto; }
        .toast { position: fixed; top: 20px; right: 20px; background: #10b981; color: white; padding: 1rem 1.5rem; border-radius: 8px; transform: translateX(100%); transition: transform 0.3s; z-index: 1000; }
        .toast.show { transform: translateX(0); }
        @print { .copy-btn { display: none; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Shipment ${shipment.shipmentId}</h1>
            <p>Complete shipment details and documentation</p>
        </div>

        <div class="card">
            <h2 class="section-title">Shipment Information</h2>
            <div class="field-grid">
                <div class="field">
                    <span class="field-label">Shipment ID:</span>
                    <span class="field-value">${shipment.shipmentId}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.shipmentId}', 'Shipment ID')">Copy</button>
                </div>
                <div class="field">
                    <span class="field-label">Origin:</span>
                    <span class="field-value">${shipment.origin}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.origin}', 'Origin')">Copy</button>
                </div>
                <div class="field">
                    <span class="field-label">Destination:</span>
                    <span class="field-value">${shipment.destination}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.destination}', 'Destination')">Copy</button>
                </div>
                <div class="field">
                    <span class="field-label">Transport Mode:</span>
                    <span class="field-value">
                        <span class="transport-mode mode-${shipment.transportMode}">${shipment.transportMode.toUpperCase()}</span>
                    </span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.transportMode}', 'Transport Mode')">Copy</button>
                </div>
                <div class="field">
                    <span class="field-label">Status:</span>
                    <span class="field-value">
                        <span class="status-badge status-${shipment.status}">${shipment.status.toUpperCase()}</span>
                    </span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.status}', 'Status')">Copy</button>
                </div>
                <div class="field">
                    <span class="field-label">Created:</span>
                    <span class="field-value">${new Date(shipment.createdAt).toLocaleString()}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${new Date(shipment.createdAt).toLocaleString()}', 'Created Date')">Copy</button>
                </div>
                ${shipment.containerNumber ? `
                <div class="field">
                    <span class="field-label">Container Number:</span>
                    <span class="field-value">${shipment.containerNumber}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.containerNumber}', 'Container Number')">Copy</button>
                </div>` : ''}
                ${shipment.billOfLading ? `
                <div class="field">
                    <span class="field-label">Bill of Lading:</span>
                    <span class="field-value">${shipment.billOfLading}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.billOfLading}', 'Bill of Lading')">Copy</button>
                </div>` : ''}
                ${shipment.vessel ? `
                <div class="field">
                    <span class="field-label">Vessel:</span>
                    <span class="field-value">${shipment.vessel}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${shipment.vessel}', 'Vessel')">Copy</button>
                </div>` : ''}
                ${shipment.totalValue ? `
                <div class="field">
                    <span class="field-label">Total Value:</span>
                    <span class="field-value">$${shipment.totalValue}</span>
                    <button class="copy-btn" onclick="copyToClipboard('$${shipment.totalValue}', 'Total Value')">Copy</button>
                </div>` : ''}
            </div>
        </div>

        ${documents.length > 0 ? `
        <div class="card">
            <h2 class="section-title">Documents (${documents.length})</h2>
            ${documents.map(doc => `
            <div class="doc-item">
                <div class="doc-header">
                    <span class="doc-name">${doc.originalName || doc.fileName}</span>
                    <span class="doc-category">${doc.category.replace('_', ' ').toUpperCase()}</span>
                </div>
                <div style="display: flex; gap: 1rem; align-items: center; margin: 0.5rem 0;">
                    <span style="font-size: 0.875rem; color: #64748b;">Uploaded: ${new Date(doc.uploadedAt).toLocaleString()}</span>
                    <button class="copy-btn" onclick="copyToClipboard('${doc.originalName || doc.fileName}', 'Document Name')">Copy Name</button>
                </div>
                ${doc.extractedData ? `
                <div class="extracted-data">${typeof doc.extractedData === 'string' ? doc.extractedData : JSON.stringify(doc.extractedData, null, 2)}</div>
                <button class="copy-btn" style="margin-top: 0.5rem;" onclick="copyToClipboard('${typeof doc.extractedData === 'string' ? doc.extractedData.replace(/'/g, "\\'") : JSON.stringify(doc.extractedData).replace(/'/g, "\\'")}', 'Extracted Data')">Copy Extracted Data</button>
                ` : '<p style="color: #64748b; font-style: italic;">No extracted data available</p>'}
            </div>
            `).join('')}
        </div>` : ''}
    </div>

    <div id="toast" class="toast"></div>

    <script>
        function copyToClipboard(text, fieldName) {
            navigator.clipboard.writeText(text).then(() => {
                showToast('Copied ' + fieldName + ' to clipboard!');
            }).catch(() => {
                showToast('Failed to copy to clipboard');
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            toast.textContent = message;
            toast.classList.add('show');
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        }
    </script>
</body>
</html>`;
      
      res.send(html);
    } catch (error) {
      console.error("Error generating shipment HTML:", error);
      res.status(500).send('<h1>Error loading shipment data</h1>');
    }
  });

  // Admin routes
  app.get('/api/admin/shipments', isAuthenticated, async (req: any, res) => {
    try {
      const shipments = await storage.getAllShipments();
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching all shipments:", error);
      res.status(500).json({ message: "Failed to fetch shipments" });
    }
  });

  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/documents', isAuthenticated, async (req: any, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const shipments = await storage.getAllShipments();
      const users = await storage.getAllUsers();
      const documents = await storage.getAllDocuments();
      
      const totalValue = shipments.reduce((sum, s) => {
        return sum + (parseFloat(s.totalValue || "0"));
      }, 0);
      
      res.json({
        totalShipments: shipments.length,
        totalUsers: users.length,
        totalDocuments: documents.length,
        totalValue: `$${(totalValue / 1000000).toFixed(1)}M`,
      });
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Test data seeding route (development only)
  app.post('/api/seed-test-data', isAuthenticated, async (req: any, res) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: "Test data seeding only available in development" });
      }
      
      const userId = req.user.claims.sub;
      const { seedTestData } = await import('./seedData');
      const result = await seedTestData(userId);
      
      res.json(result);
    } catch (error) {
      console.error("Error seeding test data:", error);
      res.status(500).json({ message: "Failed to seed test data" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
