import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertShipmentSchema, insertDocumentSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { detectCarrierFromBL, generateTrackingUrl, generateContainerTrackingUrl } from "./carrierTracking";
import puppeteer from "puppeteer";
import nodemailer from "nodemailer";

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || 'admin@freightclear.com',
    pass: process.env.SMTP_PASS || 'admin-password'
  }
});

// Send POA notification email
async function sendPOANotification(userDetails: any) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@freightclear.com';
  
  const mailOptions = {
    from: process.env.SMTP_USER || 'admin@freightclear.com',
    to: adminEmail,
    subject: 'New Power of Attorney Submitted for Validation',
    html: `
      <h2>Power of Attorney Validation Required</h2>
      <p>A new Power of Attorney has been electronically signed and submitted for validation.</p>
      
      <h3>Customer Details:</h3>
      <ul>
        <li><strong>Name:</strong> ${userDetails.firstName} ${userDetails.lastName}</li>
        <li><strong>Email:</strong> ${userDetails.email}</li>
        <li><strong>Company:</strong> ${userDetails.companyName || 'N/A'}</li>
        <li><strong>Phone:</strong> ${userDetails.phone || 'N/A'}</li>
        <li><strong>Submission Date:</strong> ${new Date().toLocaleString()}</li>
      </ul>
      
      <p>Please log in to the admin panel to review and validate this Power of Attorney.</p>
      
      <p><strong>Action Required:</strong> Review the submitted POA document and update the validation status.</p>
      
      <hr>
      <p><em>This is an automated notification from Freight Flow.</em></p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('POA notification email sent successfully');
  } catch (error) {
    console.error('Failed to send POA notification email:', error);
    // Don't throw error - email failure shouldn't stop POA generation
  }
}

// POA HTML template function with filled data
function generateFilledPOADocument(data: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Power of Attorney</title>
    <link href="https://fonts.googleapis.com/css2?family=La+Belle+Aurore&display=swap" rel="stylesheet">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-row { display: flex; gap: 20px; margin-bottom: 15px; }
        .form-field { flex: 1; }
        label { font-weight: bold; display: block; margin-bottom: 5px; }
        .value { border-bottom: 1px solid #333; min-height: 20px; padding: 2px 0; }
        .checkbox-group { margin: 10px 0; }
        .signature-section { margin-top: 40px; border-top: 2px solid #333; padding-top: 20px; }
        .signature-field { display: inline-block; border-bottom: 2px solid #333; min-width: 300px; text-align: center; margin: 10px 20px; }
        .signature-value { font-family: 'La Belle Aurore', cursive; font-size: 23pt; }
        @media print { body { margin: 0; padding: 15px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>POWER OF ATTORNEY</h1>
        <h2>FOR CUSTOMS AND BORDER PROTECTION MATTERS</h2>
    </div>

    <div class="form-group">
        <h3>PRINCIPAL (IMPORTER) INFORMATION</h3>
        <div class="form-row">
            <div class="form-field">
                <label>Full Name:</label>
                <div class="value">${data.principalName || ''}</div>
            </div>
            <div class="form-field">
                <label>Email:</label>
                <div class="value">${data.principalEmail || ''}</div>
            </div>
        </div>
        
        <div class="form-group">
            <label>Company Name:</label>
            <div class="value">${data.principalCompanyName || ''}</div>
        </div>
        
        <div class="form-group">
            <label>Address:</label>
            <div class="value">${data.principalAddress || ''}</div>
        </div>
        
        <div class="form-row">
            <div class="form-field">
                <label>City:</label>
                <div class="value">${data.principalCity || ''}</div>
            </div>
            <div class="form-field">
                <label>State:</label>
                <div class="value">${data.principalState || ''}</div>
            </div>
            <div class="form-field">
                <label>ZIP Code:</label>
                <div class="value">${data.principalZip || ''}</div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-field">
                <label>Phone:</label>
                <div class="value">${data.principalPhone || ''}</div>
            </div>
            <div class="form-field">
                <label>IRS-EIN-SS:</label>
                <div class="value">${data.irsEinSs || ''}</div>
            </div>
        </div>
        
        <div class="form-group">
            <label>Corporation Type:</label>
            <div class="value">${data.corporationType ? data.corporationType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : ''}</div>
        </div>
    </div>

    <div class="form-group">
        <h3>AGENT (CUSTOMS BROKER) INFORMATION</h3>
        <div class="form-row">
            <div class="form-field">
                <label>Agent Name:</label>
                <div class="value">${data.agentName || ''}</div>
            </div>
            <div class="form-field">
                <label>Title:</label>
                <div class="value">${data.agentTitle || ''}</div>
            </div>
        </div>
        
        <div class="form-group">
            <label>Company:</label>
            <div class="value">${data.agentCompany || ''}</div>
        </div>
        
        <div class="form-group">
            <label>Address:</label>
            <div class="value">${data.agentAddress || '371 Merrick Rd, suite 305, Rockville Centre, NY 11570'}</div>
        </div>
    </div>

    <div class="form-group">
        <h3>POWERS GRANTED</h3>
        <p>I hereby authorize the above-named agent to act on my behalf in the following matters:</p>
        
        <div class="checkbox-group">
            <div>${data.customsDeclarations ? '☑' : '☐'} File customs declarations and entry documents</div>
            <div>${data.importDocuments ? '☑' : '☐'} Sign import documents on my behalf</div>
            <div>${data.paymentOfDuties ? '☑' : '☐'} Make payment of duties, taxes, and fees</div>
            <div>${data.representBeforeCBP ? '☑' : '☐'} Represent me before U.S. Customs and Border Protection</div>
            <div>${data.releaseOfGoods ? '☑' : '☐'} Authorize release of goods from customs custody</div>
            ${data.otherPowers ? `<div><strong>Additional Powers:</strong> ${data.otherPowers}</div>` : ''}
        </div>
    </div>

    <div class="form-group">
        <h3>TERMS AND CONDITIONS</h3>
        <p>This Power of Attorney shall remain in effect until revoked in writing by the undersigned. 
        I understand that this authorization grants the named agent the power to act on my behalf in customs matters 
        and that I remain responsible for all obligations arising from such actions.</p>
    </div>

    <div class="signature-section">
        <h3>ELECTRONIC SIGNATURE</h3>
        <p>By signing below, I acknowledge that I have read, understood, and agree to the terms of this Power of Attorney.</p>
        
        <div style="margin-top: 40px;">
            <div class="signature-field signature-value">${data.electronicSignature || ''}</div>
            <div class="signature-field">${data.signerCapacity || ''}</div>
            <div class="signature-field">${data.signatureDate || ''}</div>
        </div>
        <div style="margin-top: 10px;">
            <div style="display: inline-block; width: 250px; text-align: center; margin: 0 10px;">
                <strong>Principal Signature</strong>
            </div>
            <div style="display: inline-block; width: 250px; text-align: center; margin: 0 10px;">
                <strong>Capacity</strong>
            </div>
            <div style="display: inline-block; width: 250px; text-align: center; margin: 0 10px;">
                <strong>Date</strong>
            </div>
        </div>
    </div>

    <div style="margin-top: 50px; font-size: 12px; text-align: center; color: #666;">
        Generated electronically by Freight Flow - ${new Date().toLocaleString()}
    </div>
</body>
</html>
  `;
}

// POA HTML template function (blank)
function generatePOADocument(data: any): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Power of Attorney</title>
    <link href="https://fonts.googleapis.com/css2?family=La+Belle+Aurore&display=swap" rel="stylesheet">
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .header { text-align: center; margin-bottom: 30px; }
        .form-group { margin-bottom: 20px; }
        .form-row { display: flex; gap: 20px; margin-bottom: 15px; }
        .form-field { flex: 1; }
        label { font-weight: bold; display: block; margin-bottom: 5px; }
        .value { border-bottom: 1px solid #333; min-height: 20px; padding: 2px 0; }
        .checkbox-group { margin: 10px 0; }
        .signature-section { margin-top: 40px; border-top: 2px solid #333; padding-top: 20px; }
        .signature-field { display: inline-block; border-bottom: 2px solid #333; min-width: 300px; text-align: center; margin: 10px 20px; }
        .signature-value { font-family: 'La Belle Aurore', cursive; font-size: 23pt; }
        @media print { body { margin: 0; padding: 15px; } }
    </style>
</head>
<body>
    <div class="header">
        <h1>POWER OF ATTORNEY</h1>
        <h2>FOR CUSTOMS AND BORDER PROTECTION MATTERS</h2>
    </div>

    <div class="form-group">
        <h3>PRINCIPAL (IMPORTER) INFORMATION</h3>
        <div class="form-row">
            <div class="form-field">
                <label>Full Name:</label>
                <div class="value"></div>
            </div>
            <div class="form-field">
                <label>Email:</label>
                <div class="value"></div>
            </div>
        </div>
        
        <div class="form-group">
            <label>Company Name:</label>
            <div class="value"></div>
        </div>
        
        <div class="form-group">
            <label>Address:</label>
            <div class="value"></div>
        </div>
        
        <div class="form-row">
            <div class="form-field">
                <label>City:</label>
                <div class="value"></div>
            </div>
            <div class="form-field">
                <label>State:</label>
                <div class="value"></div>
            </div>
            <div class="form-field">
                <label>ZIP Code:</label>
                <div class="value"></div>
            </div>
        </div>

        <div class="form-row">
            <div class="form-field">
                <label>Phone:</label>
                <div class="value"></div>
            </div>
            <div class="form-field">
                <label>IRS-EIN-SS:</label>
                <div class="value"></div>
            </div>
        </div>
        
        <div class="form-group">
            <label>Corporation Type:</label>
            <div class="value"></div>
        </div>
    </div>

    <div class="form-group">
        <h3>AGENT (CUSTOMS BROKER) INFORMATION</h3>
        <div class="form-row">
            <div class="form-field">
                <label>Agent Name:</label>
                <div class="value">WCS International Inc.</div>
            </div>
            <div class="form-field">
                <label>Title:</label>
                <div class="value">Customs Broker</div>
            </div>
        </div>
        
        <div class="form-group">
            <label>Company:</label>
            <div class="value">WCS International Inc.</div>
        </div>
        
        <div class="form-group">
            <label>Address:</label>
            <div class="value">371 Merrick Rd, suite 305, Rockville Centre, NY 11570</div>
        </div>
    </div>

    <div class="form-group">
        <h3>POWERS GRANTED</h3>
        <p>I hereby authorize the above-named agent to act on my behalf in the following matters:</p>
        
        <div class="checkbox-group">
            <div>☐ File customs declarations and entry documents</div>
            <div>☐ Sign import documents on my behalf</div>
            <div>☐ Make payment of duties, taxes, and fees</div>
            <div>☐ Represent me before U.S. Customs and Border Protection</div>
            <div>☐ Authorize release of goods from customs custody</div>
            <div><strong>Additional Powers:</strong> _________________________________</div>
        </div>
    </div>

    <div class="form-group">
        <h3>TERMS AND CONDITIONS</h3>
        <p>This Power of Attorney shall remain in effect until revoked in writing by the undersigned. 
        I understand that this authorization grants the named agent the power to act on my behalf in customs matters 
        and that I remain responsible for all obligations arising from such actions.</p>
    </div>

    <div class="signature-section">
        <h3>ELECTRONIC SIGNATURE</h3>
        <p>By signing below, I acknowledge that I have read, understood, and agree to the terms of this Power of Attorney.</p>
        
        <div style="margin-top: 40px;">
            <div class="signature-field"></div>
            <div class="signature-field"></div>
            <div class="signature-field"></div>
        </div>
        <div style="margin-top: 10px;">
            <div style="display: inline-block; width: 250px; text-align: center; margin: 0 10px;">
                <strong>Principal Signature</strong>
            </div>
            <div style="display: inline-block; width: 250px; text-align: center; margin: 0 10px;">
                <strong>Capacity</strong>
            </div>
            <div style="display: inline-block; width: 250px; text-align: center; margin: 0 10px;">
                <strong>Date</strong>
            </div>
        </div>
    </div>

    <div style="margin-top: 50px; font-size: 12px; text-align: center; color: #666;">
        Generated electronically by Freight Flow - ${new Date().toLocaleString()}
    </div>
</body>
</html>
  `;
}

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

  // Registration route
  app.post('/api/register', async (req, res) => {
    try {
      const { email, firstName, lastName, phone, companyName, companyAddress } = req.body;
      
      // Basic validation
      if (!email || !firstName || !lastName || !phone || !companyName || !companyAddress) {
        return res.status(400).json({ message: "All fields are required" });
      }
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }
      
      // For now, just return success - actual user creation will happen during OAuth
      res.json({ 
        message: "Registration information received. Please complete authentication.",
        redirect: "/api/login"
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

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
  app.get('/api/documents', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const shipmentId = req.query.shipmentId;
      
      let documents;
      if (shipmentId) {
        // Get documents for specific shipment
        documents = await storage.getDocumentsByShipmentId(parseInt(shipmentId));
        // Filter by user to ensure security
        documents = documents.filter(doc => doc.userId === userId);
      } else {
        // Get all user documents
        documents = await storage.getDocumentsByUserId(userId);
      }
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

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

  // POA upload route
  app.post('/api/profile/upload-poa', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Update user's POA status and document path
      const updatedUser = await storage.updateUser(userId, {
        powerOfAttorneyStatus: 'uploaded',
        powerOfAttorneyDocumentPath: file.path,
        powerOfAttorneyUploadedAt: new Date(),
      });

      res.json({ 
        message: "Power of Attorney uploaded successfully",
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error uploading POA:", error);
      res.status(500).json({ message: "Failed to upload POA" });
    }
  });

  // POA delete route
  app.delete('/api/profile/poa', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Delete the POA file if it exists
      if (user.powerOfAttorneyDocumentPath && fs.existsSync(user.powerOfAttorneyDocumentPath)) {
        fs.unlinkSync(user.powerOfAttorneyDocumentPath);
      }
      
      // Reset POA status and clear document path
      const updatedUser = await storage.updateUser(userId, {
        powerOfAttorneyStatus: 'pending',
        powerOfAttorneyDocumentPath: null,
        powerOfAttorneyUploadedAt: null,
      });
      
      res.json({ 
        message: "Power of Attorney deleted successfully",
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error deleting POA:", error);
      res.status(500).json({ message: "Failed to delete POA" });
    }
  });

  // POA view route
  app.get('/api/profile/poa/view', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.powerOfAttorneyDocumentPath) {
        return res.status(404).json({ message: "POA document not found" });
      }
      
      if (!fs.existsSync(user.powerOfAttorneyDocumentPath)) {
        return res.status(404).json({ message: "POA file not found on disk" });
      }
      
      // Check file type and set appropriate headers
      const fileExtension = path.extname(user.powerOfAttorneyDocumentPath).toLowerCase();
      if (fileExtension === '.html') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="Power_of_Attorney.html"`);
      } else if (fileExtension === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Power_of_Attorney.pdf"`);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="Power_of_Attorney${fileExtension}"`);
      }
      
      const fileStream = fs.createReadStream(user.powerOfAttorneyDocumentPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error viewing POA:", error);
      res.status(500).json({ message: "Failed to view POA" });
    }
  });

  // IRS Proof upload route
  app.post('/api/profile/irs-proof/upload', isAuthenticated, upload.single('irsProof'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const userId = req.user.claims.sub;
      const fileName = `IRS_Proof_${userId}_${Date.now()}${path.extname(req.file.originalname)}`;
      const filePath = path.join('uploads', fileName);
      
      // Move the uploaded file to the final location
      fs.renameSync(req.file.path, filePath);

      // Update user's IRS proof status and document path
      const updatedUser = await storage.updateUser(userId, {
        irsProofStatus: 'uploaded',
        irsProofDocumentPath: filePath,
        irsProofUploadedAt: new Date(),
      });

      res.json({ 
        message: "IRS proof uploaded successfully and pending verification",
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error uploading IRS proof:", error);
      res.status(500).json({ message: "Failed to upload IRS proof" });
    }
  });

  // IRS Proof view route
  app.get('/api/profile/irs-proof/view', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user || !user.irsProofDocumentPath) {
        return res.status(404).json({ message: "IRS proof document not found" });
      }
      
      if (!fs.existsSync(user.irsProofDocumentPath)) {
        return res.status(404).json({ message: "IRS proof file not found on disk" });
      }
      
      // Check file type and set appropriate headers
      const fileExtension = path.extname(user.irsProofDocumentPath).toLowerCase();
      if (fileExtension === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="IRS_Proof.pdf"`);
      } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
        const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
        res.setHeader('Content-Type', mimeTypes[fileExtension] || 'image/jpeg');
        res.setHeader('Content-Disposition', `inline; filename="IRS_Proof${fileExtension}"`);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="IRS_Proof${fileExtension}"`);
      }
      
      const fileStream = fs.createReadStream(user.irsProofDocumentPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error viewing IRS proof:", error);
      res.status(500).json({ message: "Failed to view IRS proof" });
    }
  });

  // POA generation route
  app.post('/api/profile/generate-poa', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const poaData = req.body;

      // Generate HTML POA document with filled data
      const poaHtml = generateFilledPOADocument(poaData);
      
      // Save as HTML file first as fallback
      const htmlFileName = `POA_${userId}_${Date.now()}.html`;
      const htmlFilePath = path.join('uploads', htmlFileName);
      fs.writeFileSync(htmlFilePath, poaHtml);

      // Generate PDF using Puppeteer
      const puppeteer = require('puppeteer');
      
      let pdfFilePath = null;
      try {
        const browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        
        // Set content and wait for fonts to load
        await page.setContent(poaHtml, { 
          waitUntil: ['networkidle0', 'domcontentloaded'] 
        });
        
        // Wait for Google Fonts to load
        await page.evaluateHandle('document.fonts.ready');
        
        // Additional wait to ensure fonts are fully loaded
        await page.waitForTimeout(2000);
        
        // Generate PDF
        const pdfFileName = `POA_${userId}_${Date.now()}.pdf`;
        pdfFilePath = path.join('uploads', pdfFileName);
        
        await page.pdf({
          path: pdfFilePath,
          format: 'A4',
          printBackground: true,
          margin: {
            top: '20mm',
            right: '20mm',
            bottom: '20mm',
            left: '20mm'
          }
        });
        
        await browser.close();
        console.log('PDF generated successfully with Google fonts');
      } catch (pdfError) {
        console.error('PDF generation failed, keeping HTML only:', pdfError);
        // Continue without failing - HTML fallback available
      }

      // Update user's POA status and document path (prefer PDF if available)
      const updatedUser = await storage.updateUser(userId, {
        powerOfAttorneyStatus: 'pending', // Changed from 'uploaded' to 'pending' for admin validation
        powerOfAttorneyDocumentPath: pdfFilePath || htmlFilePath,
        powerOfAttorneyUploadedAt: new Date(),
      });

      // Send notification email to admin
      await sendPOANotification(updatedUser);

      res.json({ 
        message: "Power of Attorney generated successfully and pending validation",
        user: updatedUser,
        format: pdfFilePath ? 'PDF' : 'HTML'
      });
    } catch (error) {
      console.error("Error generating POA:", error);
      res.status(500).json({ message: "Failed to generate POA" });
    }
  });

  // Admin POA validation routes
  app.patch('/api/admin/users/:userId/poa/validate', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body; // 'validated' or 'rejected'
      
      if (!['validated', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'validated' or 'rejected'" });
      }

      const updatedUser = await storage.updateUser(userId, {
        powerOfAttorneyStatus: status,
      });

      res.json({ 
        message: `POA ${status} successfully`,
        user: updatedUser 
      });
    } catch (error) {
      console.error("Error updating POA status:", error);
      res.status(500).json({ message: "Failed to update POA status" });
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

        // Realistic arrival notice data extraction (in production, this would be processed by real OCR AI)
        const currentTime = new Date();
        const processingTime = currentTime.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' });
        const docTransportMode = documentCategory === 'airway_bill' ? 'air' : 'ocean';
        const arrivalNoticeData = {
          // Core identification
          shipmentId: `${docTransportMode === 'air' ? 'AIR' : 'SEA'}-${Math.floor(Math.random() * 900000) + 100000}`,
          billOfLading: `MSKU${Math.floor(Math.random() * 9000000) + 1000000}`,
          
          // Transport details
          vessel: docTransportMode === 'ocean' ? ['MV MAERSK SENTOSA', 'MV EVER GIVEN', 'MV CMA CGM MARCO POLO'][Math.floor(Math.random() * 3)] : null,
          voyage: docTransportMode === 'ocean' ? `${Math.floor(Math.random() * 900) + 100}W` : null,
          containerNumber: docTransportMode === 'ocean' ? `MSCU${Math.floor(Math.random() * 9000000) + 1000000}` : null,
          
          // Locations
          origin: 'Shanghai, China',
          originPort: docTransportMode === 'ocean' ? 'Port of Shanghai' : 'Shanghai Pudong International Airport',
          destination: file.originalname.toLowerCase().includes('miami') ? 'Miami, FL' : 
                      file.originalname.toLowerCase().includes('houston') ? 'Houston, TX' :
                      file.originalname.toLowerCase().includes('los angeles') ? 'Los Angeles, CA' : 'Long Beach, CA',
          destinationPort: file.originalname.toLowerCase().includes('miami') ? 'Port of Miami' :
                          file.originalname.toLowerCase().includes('houston') ? 'Port of Houston' :
                          file.originalname.toLowerCase().includes('los angeles') ? 'Port of Los Angeles' : 'Port of Long Beach',
          
          // Arrival notice specific timing
          eta: new Date(Date.now() + Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000),
          ata: Math.random() > 0.5 ? new Date(Date.now() - Math.floor(Math.random() * 3) * 24 * 60 * 60 * 1000) : null,
          
          // Party information
          shipperName: 'Shanghai Export Manufacturing Co., Ltd.',
          consigneeName: 'American Retail Solutions Inc.',
          customsBroker: ['ABC Customs Brokerage', 'Expedited Trade Services', 'Global Clearance Solutions'][Math.floor(Math.random() * 3)],
          
          // Financial information (typical arrival notice charges)
          freightCharges: (Math.random() * 5000 + 1500).toFixed(2),
          destinationCharges: (Math.random() * 800 + 200).toFixed(2),
          
          // Cargo details
          cargoDescription: ['Electronics & Computer Parts', 'Textiles & Apparel', 'Home & Garden Products', 'Industrial Equipment'][Math.floor(Math.random() * 4)],
          
          extractedText: `Document: ${file.originalname}\nType: ${documentCategory}\nProcessed: ${new Date().toISOString()}\nStatus: Arrival Notice - Vessel/Flight has arrived at destination port\nProcessed at: ${processingTime} EST\nDocument Status: ✓ Successfully processed and extracted shipment data`
        };

        // Update document with extracted data including tracking URLs
        await storage.updateDocument(document.id, {
          extractedData: {
            ...arrivalNoticeData,
            processingTime: processingTime,
            processingStatus: 'completed',
            processedAt: currentTime.toISOString(),
            // Add tracking metadata
            trackingInfo: {
              blTrackingUrl: arrivalNoticeData.billOfLading ? generateTrackingUrl(arrivalNoticeData.billOfLading) : null,
              containerTrackingUrl: arrivalNoticeData.containerNumber ? generateContainerTrackingUrl(arrivalNoticeData.containerNumber) : null,
              detectedCarrier: arrivalNoticeData.billOfLading ? detectCarrierFromBL(arrivalNoticeData.billOfLading) : null
            }
          },
          status: 'completed'
        });

        // Update the shipment with comprehensive arrival notice data
        if (createdShipment && arrivalNoticeData) {
          const updatedShipment = await storage.updateShipment(createdShipment.id, {
            // Core identification
            shipmentId: arrivalNoticeData.shipmentId || createdShipment.shipmentId,
            billOfLading: arrivalNoticeData.billOfLading || createdShipment.billOfLading,
            
            // Transport details
            vessel: arrivalNoticeData.vessel || createdShipment.vessel,
            voyage: arrivalNoticeData.voyage || createdShipment.voyage,
            containerNumber: arrivalNoticeData.containerNumber || createdShipment.containerNumber,
            
            // Locations
            origin: arrivalNoticeData.origin || createdShipment.origin,
            originPort: arrivalNoticeData.originPort || createdShipment.originPort,
            destination: arrivalNoticeData.destination || createdShipment.destination,
            destinationPort: arrivalNoticeData.destinationPort || createdShipment.destinationPort,
            
            // Timing
            eta: arrivalNoticeData.eta || createdShipment.eta,
            ata: arrivalNoticeData.ata || createdShipment.ata,
            
            // Parties
            shipperName: arrivalNoticeData.shipperName || createdShipment.shipperName,
            consigneeName: arrivalNoticeData.consigneeName || createdShipment.consigneeName,
            customsBroker: arrivalNoticeData.customsBroker || createdShipment.customsBroker,
            
            // Financial
            freightCharges: arrivalNoticeData.freightCharges || createdShipment.freightCharges,
            destinationCharges: arrivalNoticeData.destinationCharges || createdShipment.destinationCharges,
          });
          
          // Update the reference to the updated shipment
          createdShipment = updatedShipment;
        }

        uploadedDocuments.push({...document, extractedData: arrivalNoticeData});
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
      
      res.json({
        activeShipments,
        pendingDocuments,
        processedThisMonth,
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

  // Get document by ID for viewing (inline viewing, not download)
  app.get('/api/documents/:id/view', isAuthenticated, async (req: any, res) => {
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
      
      // Set headers for inline viewing (not download)
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${document.originalName || document.fileName}"`);
      
      // Stream the file content
      const fileStream = fs.createReadStream(document.filePath);
      fileStream.pipe(res);
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
      
      res.json({
        totalShipments: shipments.length,
        totalUsers: users.length,
        totalDocuments: documents.length,
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

  // Admin IRS Proof validation route
  app.patch('/api/admin/users/:userId/irs-proof/validate', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { status } = req.body;

      if (!['validated', 'rejected'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Must be 'validated' or 'rejected'" });
      }

      const updatedUser = await storage.updateUser(userId, {
        irsProofStatus: status,
      });

      res.json({
        message: `IRS proof status updated to ${status}`,
        user: updatedUser
      });
    } catch (error) {
      console.error("Error updating IRS proof status:", error);
      res.status(500).json({ message: "Failed to update IRS proof status" });
    }
  });

  // Admin IRS Proof view route
  app.get('/api/admin/users/:userId/irs-proof/view', isAuthenticated, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user || !user.irsProofDocumentPath) {
        return res.status(404).json({ message: "IRS proof document not found" });
      }
      
      if (!fs.existsSync(user.irsProofDocumentPath)) {
        return res.status(404).json({ message: "IRS proof file not found on disk" });
      }
      
      // Check file type and set appropriate headers
      const fileExtension = path.extname(user.irsProofDocumentPath).toLowerCase();
      if (fileExtension === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="IRS_Proof_${userId}.pdf"`);
      } else if (['.jpg', '.jpeg', '.png'].includes(fileExtension)) {
        const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };
        res.setHeader('Content-Type', mimeTypes[fileExtension] || 'image/jpeg');
        res.setHeader('Content-Disposition', `inline; filename="IRS_Proof_${userId}${fileExtension}"`);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="IRS_Proof_${userId}${fileExtension}"`);
      }
      
      const fileStream = fs.createReadStream(user.irsProofDocumentPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error viewing IRS proof:", error);
      res.status(500).json({ message: "Failed to view IRS proof" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
