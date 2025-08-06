import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, requireSubscription, requireAdmin, requireAgent, requireChatAccess } from "./replitAuth";
import ApiContracts from 'authorizenet/lib/apicontracts.js';
import ApiControllers from 'authorizenet/lib/apicontrollers.js';
import SDKConstants from 'authorizenet/lib/constants.js';
import puppeteer from 'puppeteer';
import { insertShipmentSchema, insertDocumentSchema, type InsertShipment } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { z } from "zod";
import { detectCarrierFromBL, generateTrackingUrl, generateContainerTrackingUrl } from "./carrierTracking";
import nodemailer from "nodemailer";
import { xmlIntegrator } from './xmlIntegration';
import zendesk from 'node-zendesk';
import { AIDocumentProcessor } from './aiDocumentProcessor';
import { xmlShipmentProcessor } from './xmlShipmentProcessor';
import { xmlExporter } from './xmlExporter';
import { simpleXmlScheduler } from './simpleXmlScheduler';
import { xmlSources, xmlScheduledJobs } from '@shared/schema';
import { db } from './db';
import { eq, and } from 'drizzle-orm';
import * as cron from 'node-cron';
import { NotificationService } from './notificationService';

// Initialize OpenAI Document Processor
const aiDocProcessor = new AIDocumentProcessor();
// PDF parsing will be dynamically imported when needed

// Multi-document data consolidation function
function consolidateMultiDocumentData(allExtractedData: any[]): any {
  const consolidated: any = {};
  const sourceTracker: any = {}; // Track which document each field came from
  
  // Priority hierarchy for document types (higher priority documents override lower ones)
  // ISF Information Sheet has highest priority for ISF-specific fields
  const documentTypePriority = {
    'isf_information_sheet': 15, // Highest priority for ISF forms
    'isf_data_sheet': 14,        // Second highest for ISF data
    'bill_of_lading': 10,
    'arrival_notice': 9,
    'commercial_invoice': 8,
    'packing_list': 7,
    'airway_bill': 10, // Same priority as B/L for air shipments
    'delivery_order': 5,
    'other': 1
  };
  
  // ISF-specific fields that should ALWAYS be prioritized from ISF documents
  const isfSpecificFields = [
    'consolidatorStufferInfo', 'consolidatorInformation', 'consolidator', 'consolidatorName', 
    'consolidatorStufferName', 'consolidatorAddress', 'containerStuffer', 'stufferName', 'cfsOperator', 'cfsFacility',
    'amsNumber', 'amsNo', 'amsReference',
    'manifestNumber', 'manufacturerInformation', 'manufacturerName', 'manufacturerAddress',
    'buyerInformation', 'sellerInformation', 'shipToPartyInformation'
  ];
  
  // Process each document's extracted data
  for (const docData of allExtractedData) {
    const { documentType, fileName, data } = docData;
    const priority = documentTypePriority[documentType] || 1;
    
    // Helper function to flatten nested Azure data structure
    const flattenAzureData = (obj: any, prefix = ''): any => {
      const flattened: any = {};
      
      for (const [key, value] of Object.entries(obj || {})) {
        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
          // Handle nested objects like shipper: { company: 'X', address: 'Y' }
          const nested = flattenAzureData(value, key);
          Object.assign(flattened, nested);
        } else if (value && value !== '' && value !== 'Processing' && value !== null && value !== undefined) {
          // Map Azure fields to shipment schema fields
          const fieldName = prefix ? mapAzureFieldToShipment(prefix, key) : mapAzureFieldToShipment('', key);
          if (fieldName) {
            flattened[fieldName] = value;
            console.log(`Mapped ${prefix ? prefix + '.' + key : key} -> ${fieldName} = ${value}`);
          } else {
            console.log(`No mapping found for field: ${prefix ? prefix + '.' + key : key}`);
          }
        }
      }
      
      return flattened;
    };
    
    // Flatten Azure data structure or process regular extracted data
    let extractedFields: any = {};
    
    if (data && typeof data === 'object') {
      // Check if this looks like Azure nested structure (prioritize Azure detection)
      const hasNestedObjects = Object.keys(data).some(key => 
        typeof data[key] === 'object' && data[key] !== null && !Array.isArray(data[key])
      );
      const hasAzureFields = data.shipper || data.consignee || data.bill_of_lading_no || 
                            data.vessel_voyage || data.particulars_furnished_by_shipper || 
                            data.contact_for_release || data.place_and_date_of_issue || data.notify_party;
      
      // Force Azure detection if we have 50+ fields from document extraction (indicates complex Azure response)
      const hasComplexExtraction = Object.keys(data).length > 50;
      
      if (hasAzureFields || hasNestedObjects || hasComplexExtraction) {
        console.log(`Processing Azure nested data with ${Object.keys(data).length} top-level fields`);
        console.log('Azure data keys:', Object.keys(data));
        console.log('Has nested objects:', hasNestedObjects);
        console.log('Has Azure fields:', hasAzureFields);
        console.log('Has complex extraction:', hasComplexExtraction);
        console.log('Sample extracted values:', {
          billOfLadingNumber: data.billOfLadingNumber,
          vesselAndVoyage: data.vesselAndVoyage,
          shipperName: data.shipperName,
          consigneeName: data.consigneeName,
          cargoDescription: data.cargoDescription,
          numberOfPackages: data.numberOfPackages
        });
        console.log('First 10 actual field values:', Object.entries(data).slice(0, 10).map(([k, v]) => `${k}: ${v}`));
        extractedFields = flattenAzureData(data);
        console.log(`Flattened to ${Object.keys(extractedFields).length} mapped fields:`, Object.keys(extractedFields));
        console.log('Successfully mapped fields:', Object.keys(extractedFields).filter(key => extractedFields[key] !== null && extractedFields[key] !== undefined));
      } else if (Object.keys(data).length === 0) {
        // Empty Azure response - skip this document entirely
        console.log(`Skipping empty Azure data from ${fileName}`);
        continue;
      } else {
        // Check if this is a proper shipment data structure with meaningful fields
        // Include both Azure/PDF format and Excel/ISF format field names
        const meaningfulFields = [
          // Standard shipment fields
          'billOfLadingNumber', 'vesselAndVoyage', 'containerNumber', 
          'shipperName', 'consigneeName', 'portOfLoading', 'portOfDischarge',
          // ISF-specific fields from Excel
          'billOfLading', 'vesselName', 'containerNumbers', 'importerName', 
          'importerAddress', 'htsusNumber', 'commodityDescription',
          'portOfEntry', 'foreignPortOfLading', 'scacCode', 'mblScacCode', 'hblScacCode', 'amsNumber',
          'containerStuffingLocation', 'consolidatorInformation', 'consolidator'
        ];
        const hasValidData = meaningfulFields.some(field => data[field] && data[field] !== null);
        
        if (hasValidData) {
          console.log(`Processing structured shipment data with ${Object.keys(data).length} fields`);
          for (const [field, value] of Object.entries(data)) {
            if (value && value !== '' && value !== 'Processing' && value !== null && value !== undefined) {
              extractedFields[field] = value;
            }
          }
        } else {
          console.log(`Skipping document ${fileName} - contains no meaningful shipment data`);
          continue;
        }
      }
    }
    
    // Update consolidated data with priority-based logic
    for (const [field, value] of Object.entries(extractedFields)) {
      const currentPriority = sourceTracker[field]?.priority || 0;
      const currentDocType = sourceTracker[field]?.documentType || '';
      
      // Special handling for ISF-specific fields: ISF documents always win
      if (isfSpecificFields.includes(field)) {
        if (documentType === 'isf_information_sheet' || documentType === 'isf_data_sheet') {
          // ISF document data always takes priority for ISF fields
          consolidated[field] = value;
          sourceTracker[field] = {
            source: fileName,
            documentType,
            priority
          };
          console.log(`🎯 ISF FIELD OVERRIDE: ${field} set from ISF document: ${value}`);
        } else if (!currentDocType.includes('isf_') && (!consolidated[field] || priority > currentPriority)) {
          // Only update if current data isn't from an ISF document
          consolidated[field] = value;
          sourceTracker[field] = {
            source: fileName,
            documentType,
            priority
          };
        }
      } else {
        // Regular priority-based consolidation for non-ISF fields
        if (!consolidated[field] || priority > currentPriority) {
          consolidated[field] = value;
          sourceTracker[field] = {
            source: fileName,
            documentType,
            priority
          };
        }
      }
    }
  }
  
  console.log(`Consolidated ${Object.keys(consolidated).length} fields from ${allExtractedData.length} documents`);
  console.log('Field sources:', Object.fromEntries(
    Object.entries(sourceTracker).map(([field, info]: [string, any]) => [field, `${info.documentType}:${info.source}`])
  ));
  
  return consolidated;
}

// Helper function to map Azure Document Intelligence fields to shipment schema
function mapAzureFieldToShipment(prefix: string, field: string): string | null {
  const mappings: Record<string, string> = {
    // Core Bill of Lading identifiers
    'billOfLadingNumber': 'billOfLadingNumber',
    'bill_of_lading_no': 'billOfLadingNumber',
    'airWaybillNumber': 'airWaybillNumber',
    'air_waybill_number': 'airWaybillNumber',
    'awb_number': 'airWaybillNumber',
    'awbNumber': 'airWaybillNumber',
    'vesselAndVoyage': 'vesselAndVoyage',
    'vessel_voyage': 'vesselAndVoyage',
    'containerNumber': 'containerNumber',
    'container_number': 'containerNumber',
    'containerType': 'containerType',
    'container_type': 'containerType',
    'sealNumbers': 'sealNumbers',
    'seal_numbers': 'sealNumbers',
    
    // Port and location information
    'portOfLoading': 'portOfLoading',
    'port_of_loading': 'portOfLoading',
    'portOfDischarge': 'portOfDischarge',
    'port_of_discharge': 'portOfDischarge',
    'placeOfReceipt': 'placeOfReceipt',
    'place_of_receipt': 'placeOfReceipt',
    'placeOfDelivery': 'placeOfDelivery',
    'place_of_delivery': 'placeOfDelivery',
    
    // Shipper information (flat fields from Azure)
    'shipperName': 'shipperName',
    'shipper_name': 'shipperName',
    'shipperAddress': 'shipperAddress',
    'shipper_address': 'shipperAddress',
    'shipperCity': 'shipperCity',
    'shipper_city': 'shipperCity',
    'shipperState': 'shipperState',
    'shipper_state': 'shipperState',
    'shipperZipCode': 'shipperZipCode',
    'shipper_zip_code': 'shipperZipCode',
    'shipperCountry': 'shipperCountry',
    'shipper_country': 'shipperCountry',
    'shipperContactPerson': 'shipperContactPerson',
    'shipper_contact_person': 'shipperContactPerson',
    'shipperPhone': 'shipperPhone',
    'shipper_phone': 'shipperPhone',
    'shipperEmail': 'shipperEmail',
    'shipper_email': 'shipperEmail',
    
    // Consignee information (flat fields from Azure)
    'consigneeName': 'consigneeName',
    'consignee_name': 'consigneeName',
    'consigneeAddress': 'consigneeAddress',
    'consignee_address': 'consigneeAddress',
    'consigneeCity': 'consigneeCity',
    'consignee_city': 'consigneeCity',
    'consigneeState': 'consigneeState',
    'consignee_state': 'consigneeState',
    'consigneeZipCode': 'consigneeZipCode',
    'consignee_zip_code': 'consigneeZipCode',
    'consigneeCountry': 'consigneeCountry',
    'consignee_country': 'consigneeCountry',
    'consigneeContactPerson': 'consigneeContactPerson',
    'consignee_contact_person': 'consigneeContactPerson',
    'consigneePhone': 'consigneePhone',
    'consignee_phone': 'consigneePhone',
    'consigneeEmail': 'consigneeEmail',
    'consignee_email': 'consigneeEmail',
    
    // Notify party information
    'notifyPartyName': 'notifyPartyName',
    'notify_party_name': 'notifyPartyName',
    'notifyPartyAddress': 'notifyPartyAddress',
    'notify_party_address': 'notifyPartyAddress',
    'notifyPartyCity': 'notifyPartyCity',
    'notify_party_city': 'notifyPartyCity',
    'notifyPartyState': 'notifyPartyState',
    'notify_party_state': 'notifyPartyState',
    'notifyPartyZipCode': 'notifyPartyZipCode',
    'notify_party_zip_code': 'notifyPartyZipCode',
    'notifyPartyCountry': 'notifyPartyCountry',
    'notify_party_country': 'notifyPartyCountry',
    'notifyPartyContactPerson': 'notifyPartyContactPerson',
    'notify_party_contact_person': 'notifyPartyContactPerson',
    'notifyPartyPhone': 'notifyPartyPhone',
    'notify_party_phone': 'notifyPartyPhone',
    'notifyPartyEmail': 'notifyPartyEmail',
    'notify_party_email': 'notifyPartyEmail',
    
    // Forwarding agent information
    'forwardingAgentName': 'forwardingAgentName',
    'forwarding_agent_name': 'forwardingAgentName',
    'forwardingAgentAddress': 'forwardingAgentAddress',
    'forwarding_agent_address': 'forwardingAgentAddress',
    'forwardingAgentPhone': 'forwardingAgentPhone',
    'forwarding_agent_phone': 'forwardingAgentPhone',
    'forwardingAgentEmail': 'forwardingAgentEmail',
    'forwarding_agent_email': 'forwardingAgentEmail',
    
    // Cargo and package information
    'cargoDescription': 'cargoDescription',
    'cargo_description': 'cargoDescription',
    'commodity': 'commodity',
    'numberOfPackages': 'numberOfPackages',
    'number_of_packages': 'numberOfPackages',
    'kindOfPackages': 'kindOfPackages',
    'kind_of_packages': 'kindOfPackages',
    'grossWeight': 'grossWeight',
    'gross_weight': 'grossWeight',
    'netWeight': 'netWeight',
    'net_weight': 'netWeight',
    'weight': 'weight',
    'weightUnit': 'weightUnit',
    'weight_unit': 'weightUnit',
    'volume': 'volume',
    'volumeUnit': 'volumeUnit',
    'volume_unit': 'volumeUnit',
    'measurement': 'measurement',
    'marksAndNumbers': 'marksAndNumbers',
    'marks_and_numbers': 'marksAndNumbers',
    
    // Hazardous materials
    'isHazardous': 'isHazardous',
    'is_hazardous': 'isHazardous',
    'hazardClass': 'hazardClass',
    'hazard_class': 'hazardClass',
    'unNumber': 'unNumber',
    'un_number': 'unNumber',
    'properShippingName': 'properShippingName',
    'proper_shipping_name': 'properShippingName',
    'packingGroup': 'packingGroup',
    'packing_group': 'packingGroup',
    'emergencyContact': 'emergencyContact',
    'emergency_contact': 'emergencyContact',
    
    // Booking and commercial information
    'bookingNumber': 'bookingNumber',
    'booking_number': 'bookingNumber',
    'bookingConfirmationNumber': 'bookingConfirmationNumber',
    'booking_confirmation_number': 'bookingConfirmationNumber',
    'freightCharges': 'freightCharges',
    'freight_charges': 'freightCharges',
    'freightPaymentTerms': 'freightPaymentTerms',
    'freight_payment_terms': 'freightPaymentTerms',
    'freightPayableAt': 'freightPayableAt',
    'freight_payable_at': 'freightPayableAt',
    'prepaidCollectDesignation': 'prepaidCollectDesignation',
    'prepaid_collect_designation': 'prepaidCollectDesignation',
    'destinationCharges': 'destinationCharges',
    'destination_charges': 'destinationCharges',
    'declaredValue': 'declaredValue',
    'declared_value': 'declaredValue',
    'totalValue': 'totalValue',
    'total_value': 'totalValue',
    'currency': 'currency',
    'freightCurrency': 'freightCurrency',
    'freight_currency': 'freightCurrency',
    
    // Country and trade information
    'countryOfOrigin': 'countryOfOrigin',
    'country_of_origin': 'countryOfOrigin',
    'countryOfManufacture': 'countryOfManufacture',
    'country_of_manufacture': 'countryOfManufacture',
    'htsCode': 'htsCode',
    'hts_code': 'htsCode',
    'scheduleBCode': 'scheduleBCode',
    'schedule_b_code': 'scheduleBCode',
    'exportLicense': 'exportLicense',
    'export_license': 'exportLicense',
    'importLicense': 'importLicense',
    'import_license': 'importLicense',
    'customsBroker': 'customsBroker',
    'customs_broker': 'customsBroker',
    'customsBrokerLicense': 'customsBrokerLicense',
    'customs_broker_license': 'customsBrokerLicense',
    
    // Date and time information
    'eta': 'eta',
    'etd': 'etd',
    'ata': 'ata',
    'atd': 'atd',
    'dateIssued': 'issueDate',
    'date_issued': 'issueDate',
    'dateOfShipment': 'dateOfShipment',
    'date_of_shipment': 'dateOfShipment',
    'onBoardDate': 'onBoardDate',
    'on_board_date': 'onBoardDate',
    
    // Legacy nested field support (for existing Azure patterns)
    'shipper.company': 'shipperName',
    'shipper.address': 'shipperAddress',
    'shipper.contact_person': 'shipperContactPerson',
    'shipper.tel': 'shipperPhone',
    'shipper.email': 'shipperEmail',
    'consignee.company': 'consigneeName',
    'consignee.address': 'consigneeAddress',
    'consignee.contact_person': 'consigneeContactPerson',
    'consignee.company_tel': 'consigneePhone',
    'consignee.email': 'consigneeEmail',
    'notify_party': 'notifyPartyName',
    'particulars_furnished_by_shipper.description_of_goods': 'cargoDescription',
    'particulars_furnished_by_shipper.no_of_pkgs': 'numberOfPackages',
    'particulars_furnished_by_shipper.gross_weight_kgs': 'grossWeight',
    'particulars_furnished_by_shipper.measurement_cbm': 'measurement',
    'particulars_furnished_by_shipper.marks_numbers': 'marksAndNumbers',
    'contact_for_release.company': 'forwardingAgentName',
    'contact_for_release.address': 'forwardingAgentAddress',
    'contact_for_release.tel': 'forwardingAgentPhone',
    'contact_for_release.fax': 'forwardingAgentPhone'
  };
  
  // Create full field path for nested objects
  const fullPath = prefix ? `${prefix}.${field}` : field;
  const result = mappings[fullPath] || mappings[field] || null;
  console.log(`Field mapping: "${fullPath}" -> "${result}"`);
  return result;
}

// Zendesk API configuration
let zendeskClient: any = null;

// Initialize Zendesk client if credentials are available
if (process.env.ZENDESK_USERNAME && process.env.ZENDESK_API_TOKEN) {
  try {
    zendeskClient = zendesk.createClient({
      username: process.env.ZENDESK_USERNAME,
      token: process.env.ZENDESK_API_TOKEN,
      remoteUri: 'https://wcscargo.zendesk.com/api/v2',
    });
    console.log('Zendesk client initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Zendesk client:', error);
  }
} else {
  console.log('Zendesk credentials not found - API will return configuration message');
}

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
      <p><em>This is an automated notification from Freightclear Workflows.</em></p>
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

// Send invoice notification email
async function sendInvoiceNotification(userDetails: any, invoiceDetails: any, adminUser: any) {
  const domainUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
  
  const mailOptions = {
    from: process.env.SMTP_USER || 'admin@freightclear.com',
    to: userDetails.email,
    subject: invoiceDetails.emailSubject || 'New Invoice from Freightclear Workflows',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Freightclear Workflows</h1>
          <p style="color: #64748b; font-size: 16px;">Streamlined Import Management</p>
        </div>
        
        <h2 style="color: #1e293b;">📧 New Invoice Available</h2>
        
        <p>Hello ${userDetails.firstName} ${userDetails.lastName},</p>
        
        <p>${invoiceDetails.emailMessage || 'You have received a new invoice. Please log in to your account to view and pay this invoice.'}</p>
        
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="color: white; margin: 0 0 15px 0;">📋 Invoice Details</h3>
          <div style="color: white;">
            <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${invoiceDetails.invoiceNumber}</p>
            <p style="margin: 5px 0;"><strong>Amount:</strong> $${parseFloat(invoiceDetails.invoiceAmount).toFixed(2)} USD</p>
            ${invoiceDetails.dueDate ? `<p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(invoiceDetails.dueDate).toLocaleDateString()}</p>` : ''}
            ${invoiceDetails.description ? `<p style="margin: 5px 0;"><strong>Description:</strong> ${invoiceDetails.description}</p>` : ''}
          </div>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${domainUrl}/payments" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            💳 View & Pay Invoice
          </a>
        </div>
        
        <div style="background: #f8fafc; border-left: 4px solid #0ea5e9; padding: 15px; margin: 20px 0;">
          <h4 style="color: #1e293b; margin: 0 0 10px 0;">💡 How to Pay:</h4>
          <ol style="color: #64748b; margin: 0; padding-left: 20px;">
            <li>Log in to your Freightclear Workflows account</li>
            <li>Navigate to the Payments section</li>
            <li>Find your invoice in the "Shipping Invoices" section</li>
            <li>Click "View" to see details or "Pay Now" to process payment</li>
          </ol>
        </div>
        
        <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
          If you have any questions about this invoice, please contact us or reply to this email.
        </p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        <p style="color: #64748b; font-size: 12px; text-align: center;">
          <em>This invoice was sent by ${adminUser.firstName} ${adminUser.lastName} from Freightclear Workflows.<br>
          Invoice sent on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</em>
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Invoice notification email sent successfully to:', userDetails.email);
  } catch (error) {
    console.error('Failed to send invoice notification email:', error);
    // Don't throw error - email failure shouldn't stop invoice upload
  }
}

// Send user invitation email
async function sendUserInvitationEmail(invitation: any, inviterUser: any) {
  const inviteToken = invitation.inviteToken;
  const inviteUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}/accept-invite?token=${inviteToken}`;
  
  const mailOptions = {
    from: process.env.SMTP_USER || 'admin@freightclear.com',
    to: invitation.email,
    subject: 'You\'re Invited to Join Freightclear Workflows',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin-bottom: 10px;">Freightclear Workflows</h1>
          <p style="color: #64748b; font-size: 16px;">Streamlined Import Management</p>
        </div>
        
        <h2 style="color: #1e293b;">You're Invited!</h2>
        
        <p>Hello ${invitation.firstName} ${invitation.lastName},</p>
        
        <p>${inviterUser.firstName} ${inviterUser.lastName} has invited you to join <strong>Freightclear Workflows</strong>, our comprehensive platform for managing freight shipments and documents.</p>
        
        <div style="background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); border-radius: 10px; padding: 20px; margin: 20px 0; text-align: center;">
          <h3 style="color: white; margin: 0 0 15px 0;">What you'll get access to:</h3>
          <ul style="color: white; text-align: left; max-width: 400px; margin: 0 auto;">
            <li>Shipment tracking and management</li>
            <li>Document upload and OCR processing</li>
            <li>Power of Attorney e-signature</li>
            <li>Real-time carrier tracking</li>
            <li>AI-powered document processing</li>
          </ul>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${inviteUrl}" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Accept Invitation
          </a>
        </div>
        
        <p style="color: #64748b; font-size: 14px;">This invitation will expire in 7 days. If you're unable to click the button above, copy and paste this link into your browser:</p>
        <p style="color: #3b82f6; word-break: break-all; font-size: 14px;">${inviteUrl}</p>
        
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
        <p style="color: #64748b; font-size: 12px; text-align: center;">
          <em>This invitation was sent by ${inviterUser.firstName} ${inviterUser.lastName} from Freightclear Workflows.</em>
        </p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('User invitation email sent successfully to:', invitation.email);
  } catch (error) {
    console.error('Failed to send user invitation email:', error);
    throw error; // Throw error for invitation failures
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
        Generated electronically by Freightclear Workflows - ${new Date().toLocaleString()}
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
        Generated electronically by Freightclear Workflows - ${new Date().toLocaleString()}
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
    const allowedTypes = /pdf|jpg|jpeg|png|doc|docx|xls|xlsx|xml/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) ||
                    file.mimetype === 'application/vnd.ms-excel' ||
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/msword' ||
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    file.mimetype === 'application/xml' ||
                    file.mimetype === 'text/xml';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX, and XML files are allowed"));
    }
  },
});

// Configure multer for ISF document uploads with organized folders
const isfUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Create ISF-specific folder structure
      const isfFolder = path.join(uploadDir, "isf-documents");
      const timestamp = Date.now().toString().slice(-6);
      const isfNumber = `ISF-${timestamp}`;
      const isfDir = path.join(isfFolder, isfNumber);
      
      // Create directories if they don't exist
      if (!fs.existsSync(isfFolder)) {
        fs.mkdirSync(isfFolder, { recursive: true });
      }
      if (!fs.existsSync(isfDir)) {
        fs.mkdirSync(isfDir, { recursive: true });
      }
      
      // Store the ISF directory path in req for later use
      (req as any).isfDirectory = isfDir;
      (req as any).isfNumber = isfNumber;
      
      cb(null, isfDir);
    },
    filename: (req, file, cb) => {
      // Use original filename with timestamp to avoid conflicts
      const timestamp = Date.now();
      const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
      cb(null, `${timestamp}_${sanitizedName}`);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /pdf|jpg|jpeg|png|doc|docx|xls|xlsx|xml/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) ||
                    file.mimetype === 'application/vnd.ms-excel' ||
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                    file.mimetype === 'application/msword' ||
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                    file.mimetype === 'application/xml' ||
                    file.mimetype === 'text/xml';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only PDF, JPG, JPEG, PNG, DOC, DOCX, XLS, XLSX, and XML files are allowed"));
    }
  },
});

// Helper function to get user ID in both development and production modes
function getUserId(req: any): string {
  // Get from authenticated user
  if (!req.user?.claims?.sub) {
    throw new Error('User not authenticated');
  }
  
  return req.user.claims.sub;
}

// Enhanced AI response generator using trained data
async function generateAIResponse(userMessage: string): Promise<string> {
  const message = userMessage.toLowerCase();
  const messageWords = message.split(/\s+/).filter(word => word.length > 2);
  
  try {
    // First, try to find a matching trained response
    const trainedResponses = await storage.searchAiTrainingData(messageWords);
    
    if (trainedResponses.length > 0) {
      // Return the highest priority trained response
      return trainedResponses[0].answer;
    }
    
    // Fall back to built-in responses if no trained data matches
    // Common shipping/freight questions
    if (message.includes('shipping') || message.includes('freight')) {
      return "I can help you with shipping and freight questions! You can create shipments, track your cargo, and manage documents all in one place. What specific shipping question can I help you with?";
    }
    
    if (message.includes('document') || message.includes('upload')) {
      return "For document management, you can upload bills of lading, commercial invoices, packing lists, and other shipping documents. Each document gets automatically categorized and linked to your shipments. Need help with a specific document type?";
    }
    
    if (message.includes('customs') || message.includes('clearance')) {
      return "For customs clearance, make sure you have your Power of Attorney validated and IRS proof uploaded. Our system helps streamline the customs process by organizing all required documents. Are you having issues with customs documentation?";
    }
    
    if (message.includes('payment') || message.includes('subscription')) {
      return "For payment and subscription questions, you can manage your billing through the Subscription page. We offer Free, Starter ($49/month), and Pro ($175/month) plans. Need help with billing?";
    }
    
    if (message.includes('poa') || message.includes('power of attorney')) {
      return "The Power of Attorney (POA) is required for customs clearance. You can create and submit your POA through the Profile page. Once submitted, an admin will review and validate it. The POA authorizes WCS International Inc. to act on your behalf for customs matters.";
    }
    
    if (message.includes('irs') || message.includes('tax')) {
      return "IRS proof is required for verification. Companies/LLCs should upload IRS Letter 147C or equivalent with company name, address, and EIN. Individual importers should upload a PDF of their social security card. This gets reviewed by our admin team.";
    }
    
    if (message.includes('help') || message.includes('support')) {
      return "I'm here to help! I can assist with shipping questions, document uploads, customs clearance, payments, and general platform navigation. You can also contact our admin team for more complex issues. What do you need help with?";
    }
    
    if (message.includes('admin') || message.includes('contact')) {
      return "To contact an admin, you can continue this conversation and an admin will be notified. Alternatively, you can reach out through the support channels. Our admin team handles POA validation, IRS proof verification, and complex shipping issues.";
    }
    
    // Default response
    return "Thanks for your message! I can help with shipping, documents, customs clearance, payments, and general platform questions. For more complex issues, I can connect you with our admin team. What would you like to know about?";
    
  } catch (error) {
    console.error("Error generating AI response:", error);
    return "I'm here to help! I can assist with shipping, documents, customs clearance, payments, and general platform questions. What would you like to know about?";
  }
}

// Demo-compatible middleware for document access
function requireDocumentAccess(req: any, res: any, next: any) {
  try {
    // In development mode, always allow access
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    
    // Production mode - require authentication
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Allow access to registration and landing pages without authentication
  app.get(['/', '/register', '/landing'], (req, res, next) => {
    // These routes should be accessible without authentication
    // Pass through to client-side routing (Vite middleware)
    next();
  });

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
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      // Require authentication
      if (!req.isAuthenticated() || !req.user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Profile management routes
  app.get('/api/profile', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put('/api/profile', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
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
  app.get('/api/shipments', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const shipments = await storage.getShipmentsByUserId(userId);
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching shipments:", error);
      res.status(500).json({ message: "Failed to fetch shipments" });
    }
  });

  app.get('/api/shipments/:id', requireSubscription, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const shipment = await storage.getShipmentById(shipmentId);
      
      if (!shipment) {
        return res.status(404).json({ message: "Shipment not found" });
      }
      
      // Check if user owns this shipment
      if (shipment.userId !== getUserId(req)) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(shipment);
    } catch (error) {
      console.error("Error fetching shipment:", error);
      res.status(500).json({ message: "Failed to fetch shipment" });
    }
  });

  app.post('/api/shipments', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
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
  app.get('/api/documents', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
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

  app.get('/api/shipments/:shipmentId/documents', requireSubscription, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.shipmentId);
      const userId = getUserId(req);
      
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

  // XML shipment processing route
  app.post('/api/shipments/xml/process', requireSubscription, upload.single('xmlFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No XML file uploaded" });
      }

      const userId = getUserId(req);
      
      // Read the uploaded XML file
      const xmlContent = fs.readFileSync(req.file.path, 'utf8');
      
      // Process the XML and create hierarchical shipment data
      const shipmentId = await xmlShipmentProcessor.processXmlShipment(xmlContent, userId);
      
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      // Get the complete processed shipment data
      const completeShipment = await xmlShipmentProcessor.getXmlShipmentById(shipmentId);
      
      res.status(201).json({
        message: "XML shipment processed successfully",
        shipmentId,
        shipment: completeShipment
      });
      
    } catch (error: any) {
      console.error("Error processing XML shipment:", error);
      
      // Clean up uploaded file if it exists
      if (req.file?.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({ 
        message: "Failed to process XML shipment", 
        error: error.message 
      });
    }
  });

  // Get XML shipments for a user
  app.get('/api/shipments/xml', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const xmlShipments = await xmlShipmentProcessor.getXmlShipmentsByUser(userId);
      res.json(xmlShipments);
    } catch (error) {
      console.error("Error fetching XML shipments:", error);
      res.status(500).json({ message: "Failed to fetch XML shipments" });
    }
  });

  // Get specific XML shipment with all related data
  app.get('/api/shipments/xml/:id', requireSubscription, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const userId = getUserId(req);
      
      const completeShipment = await xmlShipmentProcessor.getXmlShipmentById(shipmentId);
      
      // Verify user owns this shipment
      if (completeShipment.shipment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      res.json(completeShipment);
    } catch (error) {
      console.error("Error fetching XML shipment:", error);
      res.status(500).json({ message: "Failed to fetch XML shipment" });
    }
  });

  // Export XML shipment to various formats
  app.get('/api/shipments/xml/:id/export/:format', requireSubscription, async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.id);
      const format = req.params.format.toLowerCase();
      const userId = getUserId(req);
      
      // Verify user owns this shipment
      const completeShipment = await xmlShipmentProcessor.getXmlShipmentById(shipmentId);
      if (completeShipment.shipment.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      switch (format) {
        case 'xml':
          const xmlData = await xmlExporter.exportShipmentToXml(shipmentId);
          res.setHeader('Content-Type', 'application/xml');
          res.setHeader('Content-Disposition', `attachment; filename="shipment_${shipmentId}.xml"`);
          res.send(xmlData);
          break;

        case 'csv':
          const csvData = await xmlExporter.exportShipmentToCsv(shipmentId);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="shipment_${shipmentId}.csv"`);
          res.send(csvData);
          break;

        case 'json':
          const jsonData = await xmlExporter.exportShipmentToJson(shipmentId);
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="shipment_${shipmentId}.json"`);
          res.json(jsonData);
          break;

        default:
          return res.status(400).json({ message: "Unsupported export format. Use xml, csv, or json." });
      }

    } catch (error: any) {
      console.error("Error exporting XML shipment:", error);
      res.status(500).json({ message: "Failed to export XML shipment", error: error.message });
    }
  });

  // Bulk export all XML shipments for a user
  app.get('/api/shipments/xml/export/:format', requireSubscription, async (req: any, res) => {
    try {
      const format = req.params.format.toLowerCase();
      const userId = getUserId(req);
      
      const xmlShipments = await xmlShipmentProcessor.getXmlShipmentsByUser(userId);
      
      if (xmlShipments.length === 0) {
        return res.status(404).json({ message: "No XML shipments found" });
      }

      switch (format) {
        case 'json':
          // Export all shipments as a JSON array
          const allJsonData = [];
          for (const shipment of xmlShipments) {
            const shipmentData = await xmlExporter.exportShipmentToJson(shipment.id);
            allJsonData.push(shipmentData);
          }
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Content-Disposition', `attachment; filename="all_xml_shipments.json"`);
          res.json(allJsonData);
          break;

        case 'csv':
          // Export summary CSV of all shipments
          let bulkCsv = 'Shipment ID,Transaction ID,Transaction Date,Shipment Type,Transportation Method,Vessel Name,Master Bill,House Bill,Booking Number,Status\n';
          for (const shipment of xmlShipments) {
            bulkCsv += `${shipment.id},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.transactionId)},`;
            bulkCsv += `${shipment.transactionDateTime.toISOString()},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.shipmentType || '')},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.transportationMethod || '')},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.vesselName || '')},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.masterBillNumber || '')},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.houseBillNumber || '')},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.bookingNumber || '')},`;
            bulkCsv += `${xmlExporter['escapeCsv'](shipment.status)}\n`;
          }
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename="all_xml_shipments_summary.csv"`);
          res.send(bulkCsv);
          break;

        default:
          return res.status(400).json({ message: "Unsupported bulk export format. Use csv or json." });
      }

    } catch (error: any) {
      console.error("Error bulk exporting XML shipments:", error);
      res.status(500).json({ message: "Failed to bulk export XML shipments", error: error.message });
    }
  });

  // XML Source Management Routes
  
  // Get all XML sources for a user
  app.get('/api/xml-sources', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const sources = await db.query.xmlSources.findMany({
        where: eq(xmlSources.userId, userId),
        orderBy: (table, { desc }) => [desc(table.createdAt)],
      });
      
      res.json(sources);
    } catch (error: any) {
      console.error("Error fetching XML sources:", error);
      res.status(500).json({ message: "Failed to fetch XML sources" });
    }
  });

  // Create new XML source
  app.post('/api/xml-sources', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { name, url, authType, authConfig, schedule } = req.body;

      // Validate cron expression
      if (!cron.validate(schedule)) {
        return res.status(400).json({ message: "Invalid cron schedule expression" });
      }

      // Validate URL
      try {
        new URL(url);
      } catch {
        return res.status(400).json({ message: "Invalid URL format" });
      }

      const [newSource] = await db.insert(xmlSources).values({
        name,
        url,
        authType,
        authConfig,
        schedule,
        userId,
        isActive: true,
      }).returning();

      // Schedule the new source
      simpleXmlScheduler.scheduleXmlRetrieval(newSource as any);

      res.json(newSource);
    } catch (error: any) {
      console.error("Error creating XML source:", error);
      res.status(500).json({ message: "Failed to create XML source", error: error.message });
    }
  });

  // Update XML source
  app.put('/api/xml-sources/:id', requireSubscription, async (req: any, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const userId = getUserId(req);
      const updates = req.body;

      // Verify ownership
      const existingSource = await db.query.xmlSources.findFirst({
        where: and(eq(xmlSources.id, sourceId), eq(xmlSources.userId, userId)),
      });

      if (!existingSource) {
        return res.status(404).json({ message: "XML source not found" });
      }

      // Validate cron expression if schedule is being updated
      if (updates.schedule && !cron.validate(updates.schedule)) {
        return res.status(400).json({ message: "Invalid cron schedule expression" });
      }

      const [updatedSource] = await db.update(xmlSources)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(xmlSources.id, sourceId))
        .returning();

      // Reschedule if needed
      if (updates.schedule || updates.hasOwnProperty('isActive')) {
        simpleXmlScheduler.scheduleXmlRetrieval(updatedSource as any);
      }

      res.json(updatedSource);
    } catch (error: any) {
      console.error("Error updating XML source:", error);
      res.status(500).json({ message: "Failed to update XML source", error: error.message });
    }
  });

  // Delete XML source
  app.delete('/api/xml-sources/:id', requireSubscription, async (req: any, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const userId = getUserId(req);

      // Verify ownership
      const existingSource = await db.query.xmlSources.findFirst({
        where: and(eq(xmlSources.id, sourceId), eq(xmlSources.userId, userId)),
      });

      if (!existingSource) {
        return res.status(404).json({ message: "XML source not found" });
      }

      await db.delete(xmlSources).where(eq(xmlSources.id, sourceId));

      res.json({ message: "XML source deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting XML source:", error);
      res.status(500).json({ message: "Failed to delete XML source" });
    }
  });

  // Test XML source connection
  app.post('/api/xml-sources/test', requireSubscription, async (req: any, res) => {
    try {
      const { url, authType, authConfig } = req.body;

      // Prepare request headers
      const headers: Record<string, string> = {
        'User-Agent': 'FreightClear-XMLRetriever/1.0',
        'Accept': 'application/xml, text/xml, */*'
      };

      // Add authentication
      if (authType === 'basic' && authConfig?.username && authConfig?.password) {
        const credentials = Buffer.from(`${authConfig.username}:${authConfig.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      } else if (authType === 'bearer' && authConfig?.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      } else if (authType === 'apikey' && authConfig?.apiKey && authConfig?.headerName) {
        headers[authConfig.headerName] = authConfig.apiKey;
      }

      // Test connection
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        return res.json({
          success: false,
          message: `HTTP ${response.status}: ${response.statusText}`
        });
      }

      const xmlContent = await response.text();

      if (!xmlContent || xmlContent.trim().length === 0) {
        return res.json({
          success: false,
          message: 'Empty XML content received'
        });
      }

      // Basic XML validation
      if (!xmlContent.includes('<Shipment>') && !xmlContent.includes('<shipment>')) {
        return res.json({
          success: false,
          message: 'Invalid XML format - no shipment data found',
          preview: xmlContent.substring(0, 500)
        });
      }

      res.json({
        success: true,
        message: 'Connection successful - valid XML data received',
        preview: xmlContent.substring(0, 500)
      });

    } catch (error: any) {
      res.json({
        success: false,
        message: `Connection failed: ${error.message}`
      });
    }
  });

  // Manually trigger XML retrieval
  app.post('/api/xml-sources/:id/retrieve', requireSubscription, async (req: any, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const userId = getUserId(req);

      // Verify ownership
      const existingSource = await db.query.xmlSources.findFirst({
        where: and(eq(xmlSources.id, sourceId), eq(xmlSources.userId, userId)),
      });

      if (!existingSource) {
        return res.status(404).json({ message: "XML source not found" });
      }

      const result = await simpleXmlScheduler.manualRetrieve(sourceId);
      res.json(result);

    } catch (error: any) {
      console.error("Error manually retrieving XML:", error);
      res.status(500).json({ message: "Failed to retrieve XML", error: error.message });
    }
  });

  // Get job history for a source
  app.get('/api/xml-sources/:id/jobs', requireSubscription, async (req: any, res) => {
    try {
      const sourceId = parseInt(req.params.id);
      const userId = getUserId(req);
      const limit = parseInt(req.query.limit as string) || 50;

      // Verify ownership
      const existingSource = await db.query.xmlSources.findFirst({
        where: and(eq(xmlSources.id, sourceId), eq(xmlSources.userId, userId)),
      });

      if (!existingSource) {
        return res.status(404).json({ message: "XML source not found" });
      }

      const jobs = await db.query.xmlScheduledJobs.findMany({
        where: eq(xmlScheduledJobs.sourceId, sourceId),
        orderBy: (table, { desc }) => [desc(table.executedAt)],
        limit,
      });

      res.json(jobs);

    } catch (error: any) {
      console.error("Error fetching job history:", error);
      res.status(500).json({ message: "Failed to fetch job history" });
    }
  });

  // POA upload route
  app.post('/api/profile/upload-poa', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const userId = getUserId(req);
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
      const userId = getUserId(req);
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
  app.get('/api/profile/poa/view', requireDocumentAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      
      if (!user || !user.powerOfAttorneyDocumentPath) {
        return res.status(404).json({ message: "POA document not found" });
      }
      
      if (!fs.existsSync(user.powerOfAttorneyDocumentPath)) {
        return res.status(404).json({ message: "POA file not found on disk" });
      }
      
      // Check file type and set appropriate headers with Chrome compatibility
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
      
      // Chrome compatibility headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
      
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

      const userId = getUserId(req);
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
      const userId = getUserId(req);
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
      const userId = getUserId(req);
      const poaData = req.body;

      // Generate HTML POA document with filled data
      const poaHtml = generateFilledPOADocument(poaData);
      
      // Save as HTML file first as fallback
      const htmlFileName = `POA_${userId}_${Date.now()}.html`;
      const htmlFilePath = path.join('uploads', htmlFileName);
      fs.writeFileSync(htmlFilePath, poaHtml);

      // Generate PDF using Puppeteer
      
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
  // Admin route to view user's POA document
  app.get('/api/admin/users/:userId/poa/view', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const user = await storage.getUser(userId);
      
      if (!user || !user.powerOfAttorneyDocumentPath) {
        return res.status(404).json({ message: "POA document not found" });
      }
      
      if (!fs.existsSync(user.powerOfAttorneyDocumentPath)) {
        return res.status(404).json({ message: "POA file not found on disk" });
      }
      
      // Check file type and set appropriate headers with Chrome compatibility
      const fileExtension = path.extname(user.powerOfAttorneyDocumentPath).toLowerCase();
      if (fileExtension === '.html') {
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="Power_of_Attorney_${user.firstName}_${user.lastName}.html"`);
      } else if (fileExtension === '.pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Power_of_Attorney_${user.firstName}_${user.lastName}.pdf"`);
      } else {
        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="Power_of_Attorney_${user.firstName}_${user.lastName}${fileExtension}"`);
      }
      
      // Chrome compatibility headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
      
      const fileStream = fs.createReadStream(user.powerOfAttorneyDocumentPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error viewing user POA:", error);
      res.status(500).json({ message: "Failed to view POA" });
    }
  });

  app.patch('/api/admin/users/:userId/poa/validate', requireAdmin, async (req: any, res) => {
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
  app.post('/api/documents/upload', upload.array('documents', 10), requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { shipmentId, documentTypes, subCategories } = req.body;
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: "No files uploaded" });
      }

      const files = req.files as Express.Multer.File[];
      let createdShipment = null;

      // Parse document types and sub-categories (arrays from form data)
      const documentTypesArray = Array.isArray(documentTypes) ? documentTypes : [documentTypes];
      const subCategoriesArray = Array.isArray(subCategories) ? subCategories : [subCategories];

      // Check if any document type should create a new shipment
      const shouldCreateShipment = !shipmentId && documentTypesArray.some(docType => 
        ['bill_of_lading', 'arrival_notice', 'airway_bill', 'isf_data_sheet', 'delivery_order'].includes(docType)
      );
      
      if (shouldCreateShipment) {
        // Determine transport mode based on first shipment-creating document type
        const shipmentCreatingType = documentTypesArray.find(docType => 
          ['bill_of_lading', 'arrival_notice', 'airway_bill', 'isf_data_sheet', 'delivery_order'].includes(docType)
        );
        
        let transportMode = 'ocean'; // default
        if (shipmentCreatingType === 'airway_bill') {
          transportMode = 'air';
        } else if (shipmentCreatingType === 'delivery_order') {
          transportMode = 'last_mile';
        }
        
        // Generate shipment ID based on transport mode
        let prefix = 'SEA';
        if (transportMode === 'air') {
          prefix = 'AIR';
        } else if (transportMode === 'last_mile') {
          prefix = 'LM';
        }
        const timestamp = Date.now().toString().slice(-6);
        const generatedShipmentId = `${prefix}-${timestamp}`;
        
        // Create new shipment - set minimal required fields, will be updated with AI extraction
        createdShipment = await storage.createShipment({
          userId,
          shipmentId: generatedShipmentId,
          portOfLoading: 'Processing',
          portOfDischarge: 'Processing',
          transportMode,
          status: 'pending',
        });
      }

      // Upload all documents and collect extracted data for consolidation
      const uploadedDocuments = [];
      const allExtractedData = []; // Collect data from all documents for consolidation
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Get document type for this specific file
        const documentCategory = documentTypesArray[i] && documentTypesArray[i].trim() ? documentTypesArray[i].trim() : 'other';
        
        // Auto-assign subcategory for delivery orders
        let finalSubCategory = subCategoriesArray[i] || '';
        if (documentCategory === 'delivery_order' && !finalSubCategory) {
          finalSubCategory = 'last_mile';
        }

        const document = await storage.createDocument({
          userId,
          shipmentId: createdShipment?.id || (shipmentId ? parseInt(shipmentId) : undefined),
          fileName: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          category: documentCategory,
          subCategory: finalSubCategory || null,
          status: 'pending',
          filePath: file.path,
        });

        // Create OCR processing job with mock extraction for now
        await storage.createOcrJob({
          documentId: document.id,
          status: 'pending',
        });

        // Real document data extraction using PDF parsing
        let arrivalNoticeData = {};
        const currentTime = new Date();
        const processingTime = currentTime.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' });
        
        try {
          // Use AI-powered document processing for intelligent data extraction
          const supportedMimeTypes = [
            'application/pdf',
            'image/jpeg',
            'image/jpg', 
            'image/png',
            'image/tiff',
            'image/bmp'
          ];
          
          if (supportedMimeTypes.includes(file.mimetype)) {
            console.log(`Processing ${file.mimetype} with AI: ${file.originalname} at ${file.path}`);
            
            try {
              // Use enhanced Azure Document Intelligence to extract structured data from the document
              console.log('Starting Azure Document Intelligence analysis...');
              const extractedData = await aiDocProcessor.extractShipmentData(
                file.path, 
                documentCategory.replace('_', ' ')
              );
              
              console.log('Azure Document Intelligence extracted data:', extractedData);
              
              // Map extracted Azure data to our comprehensive shipping document format
              arrivalNoticeData = {
                  documentType: documentCategory.replace('_', ' ').toUpperCase(),
                  fileName: file.originalname,
                  
                  // Core shipping data from Document Intelligence
                  billOfLadingNumber: extractedData.billOfLadingNumber,
                  airWaybillNumber: extractedData.airWaybillNumber,
                  vesselAndVoyage: extractedData.vesselAndVoyage,
                  containerNumber: extractedData.containerNumber,
                  containerType: extractedData.containerType,
                  sealNumbers: extractedData.sealNumbers,
                  
                  // Location information
                  portOfLoading: extractedData.portOfLoading,
                  portOfDischarge: extractedData.portOfDischarge,
                  placeOfReceipt: extractedData.placeOfReceipt,
                  placeOfDelivery: extractedData.placeOfDelivery,
                  
                  // Comprehensive shipper information
                  shipperName: extractedData.shipperName,
                  shipperAddress: extractedData.shipperAddress,
                  shipperCity: extractedData.shipperCity,
                  shipperState: extractedData.shipperState,
                  shipperZipCode: extractedData.shipperZipCode,
                  shipperCountry: extractedData.shipperCountry,
                  shipperContactPerson: extractedData.shipperContactPerson,
                  shipperPhone: extractedData.shipperPhone,
                  shipperEmail: extractedData.shipperEmail,
                  
                  // Comprehensive consignee information
                  consigneeName: extractedData.consigneeName,
                  consigneeAddress: extractedData.consigneeAddress,
                  consigneeCity: extractedData.consigneeCity,
                  consigneeState: extractedData.consigneeState,
                  consigneeZipCode: extractedData.consigneeZipCode,
                  consigneeCountry: extractedData.consigneeCountry,
                  consigneeContactPerson: extractedData.consigneeContactPerson,
                  consigneePhone: extractedData.consigneePhone,
                  consigneeEmail: extractedData.consigneeEmail,
                  
                  // Notify party information
                  notifyPartyName: extractedData.notifyPartyName,
                  notifyPartyAddress: extractedData.notifyPartyAddress,
                  notifyPartyCity: extractedData.notifyPartyCity,
                  notifyPartyState: extractedData.notifyPartyState,
                  notifyPartyZipCode: extractedData.notifyPartyZipCode,
                  notifyPartyCountry: extractedData.notifyPartyCountry,
                  notifyPartyContactPerson: extractedData.notifyPartyContactPerson,
                  notifyPartyPhone: extractedData.notifyPartyPhone,
                  notifyPartyEmail: extractedData.notifyPartyEmail,
                  
                  // Forwarding agent details
                  forwardingAgentName: extractedData.forwardingAgentName,
                  forwardingAgentAddress: extractedData.forwardingAgentAddress,
                  forwardingAgentPhone: extractedData.forwardingAgentPhone,
                  forwardingAgentEmail: extractedData.forwardingAgentEmail,
                  
                  // Comprehensive cargo details
                  cargoDescription: extractedData.cargoDescription,
                  commodity: extractedData.commodity,
                  numberOfPackages: extractedData.numberOfPackages,
                  kindOfPackages: extractedData.kindOfPackages,
                  grossWeight: extractedData.grossWeight,
                  netWeight: extractedData.netWeight,
                  weight: extractedData.weight, // Backward compatibility
                  weightUnit: extractedData.weightUnit,
                  volume: extractedData.volume,
                  volumeUnit: extractedData.volumeUnit,
                  measurement: extractedData.measurement,
                  marksAndNumbers: extractedData.marksAndNumbers,
                  
                  // Hazardous materials information
                  isHazardous: extractedData.isHazardous,
                  hazardClass: extractedData.hazardClass,
                  unNumber: extractedData.unNumber,
                  properShippingName: extractedData.properShippingName,
                  packingGroup: extractedData.packingGroup,
                  emergencyContact: extractedData.emergencyContact,
                  
                  // Commercial and financial details
                  bookingNumber: extractedData.bookingNumber,
                  bookingConfirmationNumber: extractedData.bookingConfirmationNumber,
                  freightCharges: extractedData.freightCharges,
                  freightPaymentTerms: extractedData.freightPaymentTerms,
                  freightPayableAt: extractedData.freightPayableAt,
                  prepaidCollectDesignation: extractedData.prepaidCollectDesignation,
                  destinationCharges: extractedData.destinationCharges,
                  declaredValue: extractedData.declaredValue,
                  totalValue: extractedData.totalValue,
                  currency: extractedData.currency,
                  freightCurrency: extractedData.freightCurrency,
                  
                  // Regulatory and trade information
                  countryOfOrigin: extractedData.countryOfOrigin,
                  countryOfManufacture: extractedData.countryOfManufacture,
                  htsCode: extractedData.htsCode,
                  scheduleBCode: extractedData.scheduleBCode,
                  exportLicense: extractedData.exportLicense,
                  importLicense: extractedData.importLicense,
                  
                  // Customs and broker information
                  customsBroker: extractedData.customsBroker,
                  customsBrokerLicense: extractedData.customsBrokerLicense,
                  
                  // Comprehensive date information (parse safely)
                  eta: extractedData.eta && !isNaN(Date.parse(extractedData.eta)) ? new Date(extractedData.eta) : null,
                  etd: extractedData.etd && !isNaN(Date.parse(extractedData.etd)) ? new Date(extractedData.etd) : null,
                  ata: extractedData.ata && !isNaN(Date.parse(extractedData.ata)) ? new Date(extractedData.ata) : null,
                  atd: extractedData.atd && !isNaN(Date.parse(extractedData.atd)) ? new Date(extractedData.atd) : null,
                  dateIssued: extractedData.dateIssued && !isNaN(Date.parse(extractedData.dateIssued)) ? new Date(extractedData.dateIssued) : null,
                  dateOfShipment: extractedData.dateOfShipment && !isNaN(Date.parse(extractedData.dateOfShipment)) ? new Date(extractedData.dateOfShipment) : null,
                  onBoardDate: extractedData.onBoardDate && !isNaN(Date.parse(extractedData.onBoardDate)) ? new Date(extractedData.onBoardDate) : null,
                  
                  // Processing metadata
                  extractedText: `AI-processed Ocean Bill of Lading: ${file.originalname}\nType: ${documentCategory}\nProcessed: ${new Date().toISOString()}\nComprehensive data fields extracted: ${Object.keys(extractedData).filter(key => extractedData[key] !== undefined && extractedData[key] !== null && extractedData[key] !== '').length}\nProcessed at: ${processingTime} EST`,
                  processingNote: `OpenAI extracted ${Object.keys(extractedData).filter(key => extractedData[key] !== undefined && extractedData[key] !== null && extractedData[key] !== '').length} Ocean Bill of Lading data fields`
                };
              
            } catch (aiError) {
              console.error('AI document processing failed:', aiError);
              arrivalNoticeData = {
                documentType: documentCategory.replace('_', ' ').toUpperCase(),
                fileName: file.originalname,
                extractedText: `Document: ${file.originalname}\nType: ${documentCategory}\nUploaded: ${new Date().toISOString()}\nAI Error: ${aiError.message}\nProcessed at: ${processingTime} EST`,
                processingNote: 'AI processing failed - document stored'
              };
            }
          } else {
            // For unsupported file types, create basic structure
            arrivalNoticeData = {
              shipmentId: `DOC-${Date.now().toString().slice(-6)}`,
              extractedText: `Document: ${file.originalname}\nType: ${documentCategory}\nProcessed: ${new Date().toISOString()}\nNote: AI data extraction supports PDF, JPEG, PNG, TIFF, and BMP files\nFile type: ${file.mimetype}\nProcessed at: ${processingTime} EST`
            };
          }
        } catch (error) {
          console.error('Error extracting data from document:', error);
          // Fallback to basic structure if extraction fails
          arrivalNoticeData = {
            shipmentId: `ERR-${Date.now().toString().slice(-6)}`,
            extractedText: `Document: ${file.originalname}\nType: ${documentCategory}\nProcessed: ${new Date().toISOString()}\nError: Failed to extract data from document\nProcessed at: ${processingTime} EST`
          };
        }

        // Update document with extracted data including tracking URLs
        await storage.updateDocument(document.id, {
          extractedData: {
            ...arrivalNoticeData,
            processingTime: processingTime,
            processingStatus: 'completed',
            processedAt: currentTime.toISOString(),
            // Add tracking metadata
            trackingInfo: {
              blTrackingUrl: arrivalNoticeData.billOfLadingNumber ? generateTrackingUrl(arrivalNoticeData.billOfLadingNumber) : null,
              containerTrackingUrl: arrivalNoticeData.containerNumber ? generateContainerTrackingUrl(arrivalNoticeData.containerNumber) : null,
              detectedCarrier: arrivalNoticeData.billOfLadingNumber ? detectCarrierFromBL(arrivalNoticeData.billOfLadingNumber) : null
            }
          },
          status: 'completed'
        });

        // Update shipment with AI-extracted data
        if (createdShipment && arrivalNoticeData) {
          const updateData: any = {};
          
          // Map comprehensive Ocean Bill of Lading data to shipment fields (only if values exist and aren't placeholders)
          
          // Core shipping identifiers
          if (arrivalNoticeData.billOfLadingNumber && arrivalNoticeData.billOfLadingNumber !== 'Processing') {
            updateData.billOfLadingNumber = arrivalNoticeData.billOfLadingNumber;
          }
          if (arrivalNoticeData.vesselAndVoyage) updateData.vesselAndVoyage = arrivalNoticeData.vesselAndVoyage;
          if (arrivalNoticeData.containerNumber) updateData.containerNumber = arrivalNoticeData.containerNumber;
          if (arrivalNoticeData.containerType) updateData.containerType = arrivalNoticeData.containerType;
          if (arrivalNoticeData.sealNumbers) updateData.sealNumbers = arrivalNoticeData.sealNumbers;
          
          // Location and port information
          if (arrivalNoticeData.portOfLoading) updateData.portOfLoading = arrivalNoticeData.portOfLoading;
          if (arrivalNoticeData.portOfDischarge) updateData.portOfDischarge = arrivalNoticeData.portOfDischarge;
          if (arrivalNoticeData.placeOfReceipt) updateData.placeOfReceipt = arrivalNoticeData.placeOfReceipt;
          if (arrivalNoticeData.placeOfDelivery) updateData.placeOfDelivery = arrivalNoticeData.placeOfDelivery;
          
          // Comprehensive shipper information
          if (arrivalNoticeData.shipperName) updateData.shipperName = arrivalNoticeData.shipperName;
          if (arrivalNoticeData.shipperAddress) updateData.shipperAddress = arrivalNoticeData.shipperAddress;
          if (arrivalNoticeData.shipperCity) updateData.shipperCity = arrivalNoticeData.shipperCity;
          if (arrivalNoticeData.shipperState) updateData.shipperState = arrivalNoticeData.shipperState;
          if (arrivalNoticeData.shipperZipCode) updateData.shipperZipCode = arrivalNoticeData.shipperZipCode;
          if (arrivalNoticeData.shipperCountry) updateData.shipperCountry = arrivalNoticeData.shipperCountry;
          if (arrivalNoticeData.shipperContactPerson) updateData.shipperContactPerson = arrivalNoticeData.shipperContactPerson;
          if (arrivalNoticeData.shipperPhone) updateData.shipperPhone = arrivalNoticeData.shipperPhone;
          if (arrivalNoticeData.shipperEmail) updateData.shipperEmail = arrivalNoticeData.shipperEmail;
          
          // Comprehensive consignee information
          if (arrivalNoticeData.consigneeName) updateData.consigneeName = arrivalNoticeData.consigneeName;
          if (arrivalNoticeData.consigneeAddress) updateData.consigneeAddress = arrivalNoticeData.consigneeAddress;
          if (arrivalNoticeData.consigneeCity) updateData.consigneeCity = arrivalNoticeData.consigneeCity;
          if (arrivalNoticeData.consigneeState) updateData.consigneeState = arrivalNoticeData.consigneeState;
          if (arrivalNoticeData.consigneeZipCode) updateData.consigneeZipCode = arrivalNoticeData.consigneeZipCode;
          if (arrivalNoticeData.consigneeCountry) updateData.consigneeCountry = arrivalNoticeData.consigneeCountry;
          if (arrivalNoticeData.consigneeContactPerson) updateData.consigneeContactPerson = arrivalNoticeData.consigneeContactPerson;
          if (arrivalNoticeData.consigneePhone) updateData.consigneePhone = arrivalNoticeData.consigneePhone;
          if (arrivalNoticeData.consigneeEmail) updateData.consigneeEmail = arrivalNoticeData.consigneeEmail;
          
          // Notify party information
          if (arrivalNoticeData.notifyPartyName) updateData.notifyPartyName = arrivalNoticeData.notifyPartyName;
          if (arrivalNoticeData.notifyPartyAddress) updateData.notifyPartyAddress = arrivalNoticeData.notifyPartyAddress;
          if (arrivalNoticeData.notifyPartyCity) updateData.notifyPartyCity = arrivalNoticeData.notifyPartyCity;
          if (arrivalNoticeData.notifyPartyState) updateData.notifyPartyState = arrivalNoticeData.notifyPartyState;
          if (arrivalNoticeData.notifyPartyZipCode) updateData.notifyPartyZipCode = arrivalNoticeData.notifyPartyZipCode;
          if (arrivalNoticeData.notifyPartyCountry) updateData.notifyPartyCountry = arrivalNoticeData.notifyPartyCountry;
          if (arrivalNoticeData.notifyPartyContactPerson) updateData.notifyPartyContactPerson = arrivalNoticeData.notifyPartyContactPerson;
          if (arrivalNoticeData.notifyPartyPhone) updateData.notifyPartyPhone = arrivalNoticeData.notifyPartyPhone;
          if (arrivalNoticeData.notifyPartyEmail) updateData.notifyPartyEmail = arrivalNoticeData.notifyPartyEmail;
          
          // Forwarding agent information
          if (arrivalNoticeData.forwardingAgentName) updateData.forwardingAgentName = arrivalNoticeData.forwardingAgentName;
          if (arrivalNoticeData.forwardingAgentAddress) updateData.forwardingAgentAddress = arrivalNoticeData.forwardingAgentAddress;
          if (arrivalNoticeData.forwardingAgentPhone) updateData.forwardingAgentPhone = arrivalNoticeData.forwardingAgentPhone;
          if (arrivalNoticeData.forwardingAgentEmail) updateData.forwardingAgentEmail = arrivalNoticeData.forwardingAgentEmail;
          
          // Comprehensive cargo information
          if (arrivalNoticeData.cargoDescription) updateData.cargoDescription = arrivalNoticeData.cargoDescription;
          if (arrivalNoticeData.commodity) updateData.commodity = arrivalNoticeData.commodity;
          if (arrivalNoticeData.numberOfPackages) updateData.numberOfPackages = arrivalNoticeData.numberOfPackages;
          if (arrivalNoticeData.kindOfPackages) updateData.kindOfPackages = arrivalNoticeData.kindOfPackages;
          if (arrivalNoticeData.grossWeight) updateData.grossWeight = arrivalNoticeData.grossWeight;
          if (arrivalNoticeData.netWeight) updateData.netWeight = arrivalNoticeData.netWeight;
          if (arrivalNoticeData.weight) updateData.weight = arrivalNoticeData.weight; // Backward compatibility
          if (arrivalNoticeData.weightUnit) updateData.weightUnit = arrivalNoticeData.weightUnit;
          if (arrivalNoticeData.volume) updateData.volume = arrivalNoticeData.volume;
          if (arrivalNoticeData.volumeUnit) updateData.volumeUnit = arrivalNoticeData.volumeUnit;
          if (arrivalNoticeData.measurement) updateData.measurement = arrivalNoticeData.measurement;
          if (arrivalNoticeData.marksAndNumbers) updateData.marksAndNumbers = arrivalNoticeData.marksAndNumbers;
          
          // Hazardous materials information
          if (arrivalNoticeData.isHazardous !== undefined) updateData.isHazardous = arrivalNoticeData.isHazardous;
          if (arrivalNoticeData.hazardClass) updateData.hazardClass = arrivalNoticeData.hazardClass;
          if (arrivalNoticeData.unNumber) updateData.unNumber = arrivalNoticeData.unNumber;
          if (arrivalNoticeData.properShippingName) updateData.properShippingName = arrivalNoticeData.properShippingName;
          if (arrivalNoticeData.packingGroup) updateData.packingGroup = arrivalNoticeData.packingGroup;
          if (arrivalNoticeData.emergencyContact) updateData.emergencyContact = arrivalNoticeData.emergencyContact;
          
          // Commercial and financial details
          if (arrivalNoticeData.bookingNumber) updateData.bookingNumber = arrivalNoticeData.bookingNumber;
          if (arrivalNoticeData.bookingConfirmationNumber) updateData.bookingConfirmationNumber = arrivalNoticeData.bookingConfirmationNumber;
          if (arrivalNoticeData.freightCharges) updateData.freightCharges = arrivalNoticeData.freightCharges;
          if (arrivalNoticeData.freightPaymentTerms) updateData.freightPaymentTerms = arrivalNoticeData.freightPaymentTerms;
          if (arrivalNoticeData.freightPayableAt) updateData.freightPayableAt = arrivalNoticeData.freightPayableAt;
          if (arrivalNoticeData.prepaidCollectDesignation) updateData.prepaidCollectDesignation = arrivalNoticeData.prepaidCollectDesignation;
          if (arrivalNoticeData.destinationCharges) updateData.destinationCharges = arrivalNoticeData.destinationCharges;
          if (arrivalNoticeData.declaredValue) updateData.declaredValue = arrivalNoticeData.declaredValue;
          if (arrivalNoticeData.totalValue) updateData.totalValue = arrivalNoticeData.totalValue;
          if (arrivalNoticeData.currency) updateData.currency = arrivalNoticeData.currency;
          if (arrivalNoticeData.freightCurrency) updateData.freightCurrency = arrivalNoticeData.freightCurrency;
          
          // Regulatory and trade information
          if (arrivalNoticeData.countryOfOrigin) updateData.countryOfOrigin = arrivalNoticeData.countryOfOrigin;
          if (arrivalNoticeData.countryOfManufacture) updateData.countryOfManufacture = arrivalNoticeData.countryOfManufacture;
          if (arrivalNoticeData.htsCode) updateData.htsCode = arrivalNoticeData.htsCode;
          if (arrivalNoticeData.scheduleBCode) updateData.scheduleBCode = arrivalNoticeData.scheduleBCode;
          if (arrivalNoticeData.exportLicense) updateData.exportLicense = arrivalNoticeData.exportLicense;
          if (arrivalNoticeData.importLicense) updateData.importLicense = arrivalNoticeData.importLicense;
          
          // Customs and broker information
          if (arrivalNoticeData.customsBroker) updateData.customsBroker = arrivalNoticeData.customsBroker;
          if (arrivalNoticeData.customsBrokerLicense) updateData.customsBrokerLicense = arrivalNoticeData.customsBrokerLicense;
          
          // Comprehensive date information
          if (arrivalNoticeData.eta) updateData.eta = arrivalNoticeData.eta;
          if (arrivalNoticeData.etd) updateData.etd = arrivalNoticeData.etd;
          if (arrivalNoticeData.ata) updateData.ata = arrivalNoticeData.ata;
          if (arrivalNoticeData.atd) updateData.atd = arrivalNoticeData.atd;
          if (arrivalNoticeData.dateIssued) updateData.issueDate = arrivalNoticeData.dateIssued;
          if (arrivalNoticeData.dateOfShipment) updateData.dateOfShipment = arrivalNoticeData.dateOfShipment;
          if (arrivalNoticeData.onBoardDate) updateData.onBoardDate = arrivalNoticeData.onBoardDate;
          
          // Always update the shipment, even if just with processing metadata
          if (Object.keys(updateData).length > 0) {
            const updatedShipment = await storage.updateShipment(createdShipment.id, updateData);
            createdShipment = updatedShipment;
            console.log('Updated shipment with AI-extracted data:', Object.keys(updateData));
          } else {
            console.log('No AI-extracted data to update shipment fields');
          }
        }

        uploadedDocuments.push({...document, extractedData: arrivalNoticeData});
        
        // Store extracted data for consolidation
        if (arrivalNoticeData && Object.keys(arrivalNoticeData).length > 0) {
          allExtractedData.push({
            documentType: documentCategory,
            fileName: file.originalname,
            data: arrivalNoticeData
          });
        }
      }

      // After processing all documents, perform data consolidation for shipment creation
      if (createdShipment && allExtractedData.length > 0) {
        console.log(`Consolidating data from ${allExtractedData.length} documents for shipment ${createdShipment.shipmentId}`);
        
        // Consolidate data from all documents to get the most complete picture
        const consolidatedData = consolidateMultiDocumentData(allExtractedData);
        
        // Update shipment with consolidated data
        if (Object.keys(consolidatedData).length > 0) {
          await storage.updateShipment(createdShipment.id, consolidatedData);
          console.log(`Updated shipment ${createdShipment.shipmentId} with consolidated data from ${allExtractedData.length} documents`);
        }
      }

      // Send notifications for document processing and shipment creation
      // Notify about document processing
      if (uploadedDocuments.length > 1) {
        await NotificationService.notifyMultiDocumentProcessed(
          userId, 
          uploadedDocuments.length, 
          createdShipment?.shipmentId || 'Unknown'
        );
      } else if (uploadedDocuments.length === 1) {
        await NotificationService.notifyDocumentProcessed(
          userId, 
          uploadedDocuments[0].originalName, 
          true
        );
      }

      // Notify about shipment creation
      if (createdShipment) {
        await NotificationService.notifyShipmentCreated(userId, createdShipment.shipmentId);
      }

      res.json({ 
        message: `${uploadedDocuments.length} document(s) uploaded successfully${createdShipment ? ` and new shipment ${createdShipment.shipmentId} created with consolidated data` : ''}`, 
        documents: uploadedDocuments,
        shipment: createdShipment,
        processedDocuments: allExtractedData.length,
        consolidatedFields: createdShipment && allExtractedData.length > 0 ? 
          Object.keys(consolidateMultiDocumentData(allExtractedData)).length : 0
      });
    } catch (error) {
      console.error("Error uploading documents:", error);
      res.status(500).json({ message: "Failed to upload documents" });
    }
  });

  app.post('/api/shipments/:shipmentId/documents', isAuthenticated, upload.single('file'), async (req: any, res) => {
    try {
      const shipmentId = parseInt(req.params.shipmentId);
      const userId = getUserId(req);
      const category = req.body.category || "other";
      const subCategory = req.body.subCategory || null;
      
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
        subCategory,
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

  // Subscription access check
  app.get('/api/subscription/access', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const accessInfo = await storage.checkUserAccess(userId);
      res.json(accessInfo);
    } catch (error) {
      console.error("Error checking subscription access:", error);
      res.status(500).json({ message: "Failed to check subscription access" });
    }
  });

  // Payment configuration
  app.get('/api/payment/config', requireSubscription, async (req: any, res) => {
    try {
      const clientKey = process.env.AUTHORIZE_NET_CLIENT_KEY;
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      
      if (!clientKey || !apiLoginId) {
        return res.status(500).json({ 
          success: false, 
          error: "Payment system not configured" 
        });
      }
      
      res.json({
        success: true,
        clientKey,
        apiLoginId,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ message: "Failed to fetch payment configuration" });
    }
  });

  // Dashboard stats route
  app.get('/api/dashboard/stats', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
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
  app.get('/api/documents', requireDocumentAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const documents = await storage.getDocumentsByUserId(userId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get documents by category
  app.get('/api/documents/category/:category', requireDocumentAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { category } = req.params;
      const documents = await storage.getDocumentsByCategory(userId, category);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents by category:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get document by ID for download
  app.get('/api/documents/:id/download', requireDocumentAccess, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = getUserId(req);
      
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
  app.get('/api/documents/:id/view', requireDocumentAccess, async (req: any, res) => {
    try {
      const documentId = parseInt(req.params.id);
      const userId = getUserId(req);
      
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
      
      // Set headers for inline viewing with Chrome compatibility
      res.setHeader('Content-Type', document.fileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${document.originalName || document.fileName}"`);
      
      // Chrome compatibility headers
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // Allow iframe embedding from same origin
      res.setHeader('X-Frame-Options', 'SAMEORIGIN');
      res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
      
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
      const userId = getUserId(req);
      
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
    <title>Shipment ${shipment.shipmentId} - Freightclear Workflows</title>
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
  app.get('/api/admin/shipments', requireAdmin, async (req: any, res) => {
    try {
      const shipments = await storage.getAllShipments();
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching all shipments:", error);
      res.status(500).json({ message: "Failed to fetch shipments" });
    }
  });

  // Agent routes (similar to admin but without user management)
  app.get('/api/agent/shipments', requireAgent, async (req: any, res) => {
    try {
      const shipments = await storage.getAllShipments();
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching all shipments:", error);
      res.status(500).json({ message: "Failed to fetch shipments" });
    }
  });

  app.get('/api/agent/documents', requireAgent, async (req: any, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.get('/api/admin/users', requireAgent, async (req: any, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching all users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Admin route to set user as agent
  app.post('/api/admin/users/:userId/agent', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { isAgent } = req.body;
      
      const user = await storage.setUserAgent(userId, isAgent);
      res.json({ 
        message: isAgent ? 'User granted agent access' : 'Agent access removed',
        user 
      });
    } catch (error) {
      console.error("Error updating user agent status:", error);
      res.status(500).json({ message: "Failed to update agent status" });
    }
  });

  app.get('/api/admin/documents', requireAdmin, async (req: any, res) => {
    try {
      const documents = await storage.getAllDocuments();
      res.json(documents);
    } catch (error) {
      console.error("Error fetching all documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Admin AI Training Routes
  app.get('/api/admin/ai-training', requireAdmin, async (req, res) => {
    try {
      const trainingData = await storage.getAllAiTrainingData();
      res.json(trainingData);
    } catch (error) {
      console.error("Error fetching AI training data:", error);
      res.status(500).json({ error: "Failed to fetch AI training data" });
    }
  });

  app.post('/api/admin/ai-training', requireAdmin, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { question, answer, keywords, category, priority } = req.body;

      if (!question || !answer) {
        return res.status(400).json({ error: "Question and answer are required" });
      }

      const trainingData = await storage.createAiTrainingData({
        question,
        answer,
        keywords: keywords || [],
        category: category || 'general',
        priority: priority || 1,
        createdBy: userId,
      });

      res.json(trainingData);
    } catch (error) {
      console.error("Error creating AI training data:", error);
      res.status(500).json({ error: "Failed to create AI training data" });
    }
  });

  app.put('/api/admin/ai-training/:id', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { question, answer, keywords, category, priority, isActive } = req.body;

      const trainingData = await storage.updateAiTrainingData(parseInt(id), {
        question,
        answer,
        keywords,
        category,
        priority,
        isActive,
      });

      res.json(trainingData);
    } catch (error) {
      console.error("Error updating AI training data:", error);
      res.status(500).json({ error: "Failed to update AI training data" });
    }
  });

  app.delete('/api/admin/ai-training/:id', requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      await storage.deleteAiTrainingData(parseInt(id));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting AI training data:", error);
      res.status(500).json({ error: "Failed to delete AI training data" });
    }
  });

  app.get('/api/admin/stats', requireAdmin, async (req: any, res) => {
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

  // User invitation routes (admin and agent access)
  app.post('/api/invitations', requireAgent, async (req: any, res) => {
    try {
      const inviterUserId = getUserId(req);
      const { firstName, lastName, email } = req.body;

      // Validate required fields
      if (!firstName || !lastName || !email) {
        return res.status(400).json({ 
          error: "First name, last name, and email are required" 
        });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ 
          error: "A user with this email address already exists" 
        });
      }

      // Check if invitation already exists for this email
      const existingInvitations = await storage.getAllUserInvitations();
      const pendingInvitation = existingInvitations.find(
        inv => inv.email === email && inv.status === 'pending'
      );
      
      if (pendingInvitation) {
        return res.status(400).json({ 
          error: "An invitation has already been sent to this email address" 
        });
      }

      // Generate unique invitation token
      const inviteToken = require('crypto').randomBytes(32).toString('hex');
      
      // Create invitation record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
      
      const invitation = await storage.createUserInvitation({
        firstName,
        lastName,
        email,
        inviteToken,
        invitedBy: inviterUserId,
        status: 'pending',
        expiresAt
      });

      // Get inviter user details for email
      const inviterUser = await storage.getUser(inviterUserId);
      if (!inviterUser) {
        return res.status(500).json({ error: "Failed to get inviter details" });
      }

      // Send invitation email
      try {
        await sendUserInvitationEmail(invitation, inviterUser);
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
        return res.status(500).json({ 
          error: "Failed to send invitation email. Please try again." 
        });
      }

      res.json({ 
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          email: invitation.email,
          status: invitation.status,
          createdAt: invitation.createdAt
        }
      });
    } catch (error) {
      console.error("Error creating invitation:", error);
      res.status(500).json({ error: "Failed to create invitation" });
    }
  });

  app.get('/api/invitations', requireAgent, async (req: any, res) => {
    try {
      const invitations = await storage.getAllUserInvitations();
      res.json(invitations);
    } catch (error) {
      console.error("Error fetching invitations:", error);
      res.status(500).json({ error: "Failed to fetch invitations" });
    }
  });

  app.get('/api/invitations/token/:token', async (req: any, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Invitation has already been used" });
      }

      // Check if invitation is expired (7 days)
      const inviteDate = new Date(invitation.createdAt!);
      const now = new Date();
      const daysDiff = Math.floor((now.getTime() - inviteDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        await storage.updateUserInvitation(invitation.id, { status: 'expired' });
        return res.status(400).json({ error: "Invitation has expired" });
      }

      res.json({
        firstName: invitation.firstName,
        lastName: invitation.lastName,
        email: invitation.email
      });
    } catch (error) {
      console.error("Error validating invitation:", error);
      res.status(500).json({ error: "Failed to validate invitation" });
    }
  });

  app.post('/api/invitations/accept/:token', async (req: any, res) => {
    try {
      const { token } = req.params;
      const invitation = await storage.getUserInvitationByToken(token);
      
      if (!invitation) {
        return res.status(404).json({ error: "Invitation not found or expired" });
      }

      if (invitation.status !== 'pending') {
        return res.status(400).json({ error: "Invitation has already been used" });
      }

      // Mark invitation as accepted
      await storage.updateUserInvitation(invitation.id, { 
        status: 'accepted',
        acceptedAt: new Date()
      });

      res.json({ 
        message: "Invitation accepted successfully",
        redirectTo: "/api/login" // Redirect to login to complete registration
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Failed to accept invitation" });
    }
  });

  // Test data seeding route (development only)
  app.post('/api/seed-test-data', isAuthenticated, async (req: any, res) => {
    try {
      if (process.env.NODE_ENV !== 'development') {
        return res.status(403).json({ message: "Test data seeding only available in development" });
      }
      
      const userId = getUserId(req);
      const { seedTestData } = await import('./seedData');
      const result = await seedTestData(userId);
      
      res.json(result);
    } catch (error) {
      console.error("Error seeding test data:", error);
      res.status(500).json({ message: "Failed to seed test data" });
    }
  });

  // Admin IRS Proof validation route
  app.patch('/api/admin/users/:userId/irs-proof/validate', requireAdmin, async (req: any, res) => {
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
  app.get('/api/admin/users/:userId/irs-proof/view', requireAdmin, async (req: any, res) => {
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

  // Payment Configuration Route
  app.get('/api/payment/config', requireSubscription, async (req, res) => {
    try {
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const clientKey = process.env.AUTHORIZE_NET_CLIENT_KEY;
      
      if (!apiLoginId || !clientKey) {
        return res.json({ success: false });
      }
      
      res.json({
        success: true,
        apiLoginId: apiLoginId,
        clientKey: clientKey,
        environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
      });
    } catch (error) {
      console.error("Error fetching payment config:", error);
      res.status(500).json({ success: false, error: "Configuration error" });
    }
  });

  // Payment Processing Route
  app.post('/api/payment/process', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const {
        invoiceNumber,
        companyName,
        amount,
        description,
        opaqueData,
        billingInfo
      } = req.body;

      // Validate required fields
      if (!invoiceNumber || !companyName || !amount || !opaqueData) {
        return res.status(400).json({
          success: false,
          error: "Missing required payment information"
        });
      }

      // Validate amount
      const paymentAmount = parseFloat(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid payment amount"
        });
      }

      // Check for API credentials
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

      if (!apiLoginId || !transactionKey) {
        return res.status(500).json({
          success: false,
          error: "Payment system not configured"
        });
      }

      // Create merchant authentication
      const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
      merchantAuthenticationType.setName(apiLoginId);
      merchantAuthenticationType.setTransactionKey(transactionKey);

      // Create payment object using opaque data (payment nonce)
      const opaqueDataObject = new ApiContracts.OpaqueDataType();
      opaqueDataObject.setDataDescriptor(opaqueData.dataDescriptor);
      opaqueDataObject.setDataValue(opaqueData.dataValue);

      const paymentType = new ApiContracts.PaymentType();
      paymentType.setOpaqueData(opaqueDataObject);

      // Create billing address if provided
      const billTo = new ApiContracts.CustomerAddressType();
      if (billingInfo?.firstName) billTo.setFirstName(billingInfo.firstName);
      if (billingInfo?.lastName) billTo.setLastName(billingInfo.lastName);
      if (billingInfo?.zip) billTo.setZip(billingInfo.zip);
      billTo.setCompany(companyName);

      // Create customer data
      const customerData = new ApiContracts.CustomerDataType();
      customerData.setType(ApiContracts.CustomerTypeEnum.INDIVIDUAL);
      if (req.user.claims.email) {
        customerData.setEmail(req.user.claims.email);
      }

      // Create transaction request
      const transactionRequest = new ApiContracts.TransactionRequestType();
      transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
      transactionRequest.setPayment(paymentType);
      transactionRequest.setAmount(paymentAmount.toFixed(2));
      transactionRequest.setBillTo(billTo);
      transactionRequest.setCustomer(customerData);

      // Add invoice and description
      transactionRequest.setInvoiceNumber(invoiceNumber);
      if (description) {
        transactionRequest.setDescription(description);
      }

      // Create the main request
      const createRequest = new ApiContracts.CreateTransactionRequest();
      createRequest.setMerchantAuthentication(merchantAuthenticationType);
      createRequest.setTransactionRequest(transactionRequest);

      // Execute the request
      const ctrl = new ApiControllers.CreateTransactionController(createRequest.getJSON());
      
      // Set environment (sandbox or production)
      if (process.env.NODE_ENV === 'production') {
        ctrl.setEnvironment(SDKConstants.endpoint.production);
      } else {
        ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
      }

      // Process the transaction
      await new Promise<void>((resolve, reject) => {
        ctrl.execute(() => {
          try {
            const apiResponse = ctrl.getResponse();
            const response = new ApiContracts.CreateTransactionResponse(apiResponse);
            
            if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
              const transactionResponse = response.getTransactionResponse();
              
              if (transactionResponse && transactionResponse.getResponseCode() === '1') {
                // Transaction approved
                console.log(`Payment successful - Transaction ID: ${transactionResponse.getTransId()}`);
                
                res.json({
                  success: true,
                  transactionId: transactionResponse.getTransId(),
                  authCode: transactionResponse.getAuthCode(),
                  responseCode: transactionResponse.getResponseCode(),
                  message: "Payment processed successfully"
                });
              } else {
                // Transaction declined
                const errorCode = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorCode() || 'Unknown';
                const errorText = transactionResponse?.getErrors()?.getError()?.[0]?.getErrorText() || 'Transaction declined';
                
                console.error(`Payment declined - Code: ${errorCode}, Text: ${errorText}`);
                
                res.json({
                  success: false,
                  error: `Payment declined: ${errorText}`,
                  errorCode: errorCode
                });
              }
            } else {
              // API error
              const errorMessage = response.getMessages().getMessage()[0].getText();
              console.error(`Payment API error: ${errorMessage}`);
              
              res.json({
                success: false,
                error: `Payment processing error: ${errorMessage}`
              });
            }
            resolve();
          } catch (error) {
            console.error("Payment processing error:", error);
            res.status(500).json({
              success: false,
              error: "Payment processing failed"
            });
            reject(error);
          }
        });
      });

    } catch (error) {
      console.error("Payment route error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error during payment processing"
      });
    }
  });

  // Subscription Plans Route
  app.get('/api/subscription/plans', async (req, res) => {
    try {
      // Get subscription plans from database
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ error: "Failed to fetch subscription plans" });
    }
  });

  // Invoice Payment Route
  app.post('/api/payment/invoice', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const {
        invoiceNumber,
        amount,
        description,
        paymentNonce,
        paymentMethod
      } = req.body;

      // Validate required fields
      if (!invoiceNumber || !amount || !paymentMethod) {
        return res.status(400).json({
          success: false,
          error: "Missing required payment information"
        });
      }

      // Validate amount
      const baseAmount = parseFloat(amount);
      if (isNaN(baseAmount) || baseAmount <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid payment amount"
        });
      }

      // Calculate service fee and total (automatically applied)
      const serviceFeeRate = 0.035; // 3.5%
      const serviceFee = baseAmount * serviceFeeRate;
      const totalAmount = baseAmount + serviceFee;

      // Check for API credentials
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

      if (!apiLoginId || !transactionKey) {
        return res.status(500).json({
          success: false,
          error: "Payment system not configured"
        });
      }

      // Create merchant authentication
      const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
      merchantAuthenticationType.setName(apiLoginId);
      merchantAuthenticationType.setTransactionKey(transactionKey);

      // Create transaction request
      const transactionRequest = new ApiContracts.TransactionRequestType();
      transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
      transactionRequest.setAmount(totalAmount.toFixed(2));

      // Create payment using credit card details
      const creditCard = new ApiContracts.CreditCardType();
      creditCard.setCardNumber(paymentMethod.cardNumber);
      creditCard.setExpirationDate(paymentMethod.expiryMonth + paymentMethod.expiryYear);
      creditCard.setCardCode(paymentMethod.cardCode);

      const payment = new ApiContracts.PaymentType();
      payment.setCreditCard(creditCard);
      transactionRequest.setPayment(payment);

      // Set billing information
      const billTo = new ApiContracts.CustomerAddressType();
      billTo.setFirstName(paymentMethod.cardholderName.split(' ')[0] || '');
      billTo.setLastName(paymentMethod.cardholderName.split(' ').slice(1).join(' ') || '');
      if (paymentMethod.companyName) {
        billTo.setCompany(paymentMethod.companyName);
      }
      billTo.setZip(paymentMethod.zipCode);
      transactionRequest.setBillTo(billTo);

      // Set order information
      const order = new ApiContracts.OrderType();
      order.setInvoiceNumber(invoiceNumber);
      order.setDescription(description || `Payment for invoice ${invoiceNumber}`);
      transactionRequest.setOrder(order);

      // Add line items for detailed breakdown
      if (serviceFee > 0) {
        const lineItems = [];
        
        // Invoice amount line item
        const invoiceLineItem = new ApiContracts.LineItemType();
        invoiceLineItem.setItemId('invoice');
        invoiceLineItem.setName(description || `Invoice ${invoiceNumber}`);
        invoiceLineItem.setDescription('Invoice payment');
        invoiceLineItem.setQuantity('1');
        invoiceLineItem.setUnitPrice(baseAmount.toFixed(2));
        invoiceLineItem.setTaxable(false);
        lineItems.push(invoiceLineItem);
        
        // Service fee line item
        const serviceFeeLineItem = new ApiContracts.LineItemType();
        serviceFeeLineItem.setItemId('service_fee');
        serviceFeeLineItem.setName('Credit Card Service Fee');
        serviceFeeLineItem.setDescription('3.5% processing fee for credit card transactions');
        serviceFeeLineItem.setQuantity('1');
        serviceFeeLineItem.setUnitPrice(serviceFee.toFixed(2));
        serviceFeeLineItem.setTaxable(false);
        lineItems.push(serviceFeeLineItem);
        
        transactionRequest.setLineItems(lineItems);
      }

      // Create transaction
      const createTransactionRequest = new ApiContracts.CreateTransactionRequest();
      createTransactionRequest.setMerchantAuthentication(merchantAuthenticationType);
      createTransactionRequest.setTransactionRequest(transactionRequest);

      const ctrl = new ApiControllers.CreateTransactionController(createTransactionRequest.getJSON());
      
      // Set environment
      if (process.env.NODE_ENV === 'production') {
        ctrl.setEnvironment(SDKConstants.endpoint.production);
      } else {
        ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
      }

      // Execute transaction
      const transactionResult = await new Promise<any>((resolve, reject) => {
        ctrl.execute(() => {
          try {
            const apiResponse = ctrl.getResponse();
            const response = new ApiContracts.CreateTransactionResponse(apiResponse);
            
            if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
              const transactionResponse = response.getTransactionResponse();
              
              if (transactionResponse && transactionResponse.getResponseCode() === '1') {
                resolve({
                  success: true,
                  transactionId: transactionResponse.getTransId(),
                  authCode: transactionResponse.getAuthCode(),
                  amount: paymentAmount,
                  invoiceNumber: invoiceNumber
                });
              } else {
                const errorText = transactionResponse?.getErrors()?.getError()[0]?.getErrorText() || 'Transaction failed';
                reject(new Error(errorText));
              }
            } else {
              const errorText = response.getMessages().getMessage()[0]?.getText() || 'Payment processing failed';
              reject(new Error(errorText));
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Record the payment transaction
      await storage.createPaymentTransaction({
        userId: userId,
        transactionId: transactionResult.transactionId,
        amount: paymentAmount,
        currency: 'USD',
        status: 'completed',
        paymentMethod: 'credit_card',
        description: `Invoice payment: ${invoiceNumber}`,
        authorizeNetResponse: JSON.stringify(transactionResult)
      });

      res.json({
        success: true,
        message: "Payment processed successfully",
        transactionId: transactionResult.transactionId,
        amount: paymentAmount,
        invoiceNumber: invoiceNumber
      });

    } catch (error) {
      console.error("Error processing invoice payment:", error);
      res.status(500).json({
        success: false,
        error: error.message || "Payment processing failed"
      });
    }
  });

  // User Access Check Route
  app.get('/api/subscription/access', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const accessInfo = await storage.checkUserAccess(userId);
      res.json(accessInfo);
    } catch (error) {
      console.error("Error checking user access:", error);
      res.status(500).json({ error: "Failed to check user access" });
    }
  });

  // Create Subscription Route
  app.post('/api/subscription/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const {
        planName,
        billingCycle,
        opaqueData,
        billingInfo
      } = req.body;

      // Validate required fields
      if (!planName || !billingCycle || !opaqueData) {
        return res.status(400).json({
          success: false,
          error: "Missing required subscription information"
        });
      }

      // Get plan details from database
      const selectedPlan = await storage.getSubscriptionPlan(planName);
      if (!selectedPlan) {
        return res.status(400).json({
          success: false,
          error: "Invalid subscription plan"
        });
      }

      const amount = billingCycle === 'yearly' ? parseFloat(selectedPlan.yearlyPrice) : parseFloat(selectedPlan.monthlyPrice);

      // Check for API credentials
      const apiLoginId = process.env.AUTHORIZE_NET_API_LOGIN_ID;
      const transactionKey = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

      if (!apiLoginId || !transactionKey) {
        return res.status(500).json({
          success: false,
          error: "Payment system not configured"
        });
      }

      // Create merchant authentication
      const merchantAuthenticationType = new ApiContracts.MerchantAuthenticationType();
      merchantAuthenticationType.setName(apiLoginId);
      merchantAuthenticationType.setTransactionKey(transactionKey);

      // Create customer profile first
      const customerProfile = new ApiContracts.CustomerProfileType();
      customerProfile.setMerchantCustomerId(userId);
      customerProfile.setEmail(req.user.claims.email || '');
      customerProfile.setDescription(`${billingInfo.firstName} ${billingInfo.lastName} - ${planName} plan`);

      // Create payment profile
      const creditCard = new ApiContracts.CreditCardType();
      const opaqueDataObject = new ApiContracts.OpaqueDataType();
      opaqueDataObject.setDataDescriptor(opaqueData.dataDescriptor);
      opaqueDataObject.setDataValue(opaqueData.dataValue);

      const paymentType = new ApiContracts.PaymentType();
      paymentType.setOpaqueData(opaqueDataObject);

      const paymentProfile = new ApiContracts.CustomerPaymentProfileType();
      paymentProfile.setCustomerType(ApiContracts.CustomerTypeEnum.INDIVIDUAL);
      paymentProfile.setPayment(paymentType);

      // Billing address
      const billTo = new ApiContracts.CustomerAddressType();
      billTo.setFirstName(billingInfo.firstName);
      billTo.setLastName(billingInfo.lastName);
      billTo.setCompany(billingInfo.company);
      billTo.setZip(billingInfo.zip);
      paymentProfile.setBillTo(billTo);

      customerProfile.setPaymentProfiles([paymentProfile]);

      const createRequest = new ApiContracts.CreateCustomerProfileRequest();
      createRequest.setProfile(customerProfile);
      createRequest.setMerchantAuthentication(merchantAuthenticationType);

      const ctrl = new ApiControllers.CreateCustomerProfileController(createRequest.getJSON());
      
      // Set environment
      if (process.env.NODE_ENV === 'production') {
        ctrl.setEnvironment(SDKConstants.endpoint.production);
      } else {
        ctrl.setEnvironment(SDKConstants.endpoint.sandbox);
      }

      // Create customer profile and process initial payment
      await new Promise<void>((resolve, reject) => {
        ctrl.execute(() => {
          try {
            const apiResponse = ctrl.getResponse();
            const response = new ApiContracts.CreateCustomerProfileResponse(apiResponse);
            
            if (response.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
              const customerProfileId = response.getCustomerProfileId();
              const paymentProfileId = response.getCustomerPaymentProfileIdList().getNumericString()[0];
              
              console.log(`Customer profile created: ${customerProfileId}`);
              
              // Process initial payment
              const transactionRequest = new ApiContracts.TransactionRequestType();
              transactionRequest.setTransactionType(ApiContracts.TransactionTypeEnum.AUTHCAPTURETRANSACTION);
              transactionRequest.setAmount(amount.toFixed(2));

              const profileToCharge = new ApiContracts.CustomerProfilePaymentType();
              profileToCharge.setCustomerProfileId(customerProfileId);
              
              const paymentProfileToCharge = new ApiContracts.PaymentProfileType();
              paymentProfileToCharge.setPaymentProfileId(paymentProfileId);
              profileToCharge.setPaymentProfile(paymentProfileToCharge);

              transactionRequest.setProfile(profileToCharge);
              transactionRequest.setLineItems([]);

              const createTransactionRequest = new ApiContracts.CreateTransactionRequest();
              createTransactionRequest.setMerchantAuthentication(merchantAuthenticationType);
              createTransactionRequest.setTransactionRequest(transactionRequest);

              const transactionCtrl = new ApiControllers.CreateTransactionController(createTransactionRequest.getJSON());
              
              // Set environment
              if (process.env.NODE_ENV === 'production') {
                transactionCtrl.setEnvironment(SDKConstants.endpoint.production);
              } else {
                transactionCtrl.setEnvironment(SDKConstants.endpoint.sandbox);
              }

              transactionCtrl.execute(async () => {
                try {
                  const transactionApiResponse = transactionCtrl.getResponse();
                  const transactionResponse = new ApiContracts.CreateTransactionResponse(transactionApiResponse);
                  
                  if (transactionResponse.getMessages().getResultCode() === ApiContracts.MessageTypeEnum.OK) {
                    const transactionResult = transactionResponse.getTransactionResponse();
                    
                    if (transactionResult && transactionResult.getResponseCode() === '1') {
                      // Transaction successful - update user subscription
                      const subscriptionEndDate = new Date();
                      if (billingCycle === 'yearly') {
                        subscriptionEndDate.setFullYear(subscriptionEndDate.getFullYear() + 1);
                      } else {
                        subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1);
                      }

                      const nextBillingDate = new Date(subscriptionEndDate);

                      await storage.updateUserSubscription(userId, {
                        subscriptionStatus: 'active',
                        subscriptionPlan: planName,
                        subscriptionStartDate: new Date(),
                        subscriptionEndDate: subscriptionEndDate,
                        nextBillingDate: nextBillingDate,
                        lastPaymentDate: new Date(),
                        billingCycle: billingCycle,
                        subscriptionAmount: amount.toString(),
                        customerProfileId: customerProfileId,
                        paymentProfileId: paymentProfileId,
                        isTrialActive: false,
                        maxShipments: selectedPlan.maxShipments,
                        maxDocuments: selectedPlan.maxDocuments,
                        paymentFailureCount: 0
                      });

                      // Store payment transaction
                      await storage.createPaymentTransaction({
                        userId: userId,
                        transactionId: transactionResult.getTransId(),
                        amount: amount.toString(),
                        status: 'success',
                        paymentMethod: 'credit_card',
                        authCode: transactionResult.getAuthCode(),
                        responseCode: transactionResult.getResponseCode(),
                        description: `${planName} plan - ${billingCycle} subscription`,
                        billingCycle: billingCycle,
                        rawResponse: transactionApiResponse
                      });

                      console.log(`Subscription created successfully for user ${userId}`);
                      
                      res.json({
                        success: true,
                        subscriptionId: customerProfileId,
                        transactionId: transactionResult.getTransId(),
                        message: "Subscription created successfully"
                      });
                    } else {
                      // Transaction declined
                      const errorCode = transactionResult?.getErrors()?.getError()?.[0]?.getErrorCode() || 'Unknown';
                      const errorText = transactionResult?.getErrors()?.getError()?.[0]?.getErrorText() || 'Transaction declined';
                      
                      res.json({
                        success: false,
                        error: `Payment declined: ${errorText}`,
                        errorCode: errorCode
                      });
                    }
                  } else {
                    // Transaction API error
                    const errorMessage = transactionResponse.getMessages().getMessage()[0].getText();
                    res.json({
                      success: false,
                      error: `Payment error: ${errorMessage}`
                    });
                  }
                  resolve();
                } catch (error) {
                  console.error("Transaction processing error:", error);
                  res.status(500).json({
                    success: false,
                    error: "Transaction processing failed"
                  });
                  reject(error);
                }
              });
            } else {
              // Profile creation error
              const errorMessage = response.getMessages().getMessage()[0].getText();
              res.json({
                success: false,
                error: `Profile creation error: ${errorMessage}`
              });
              resolve();
            }
          } catch (error) {
            console.error("Customer profile creation error:", error);
            res.status(500).json({
              success: false,
              error: "Customer profile creation failed"
            });
            reject(error);
          }
        });
      });

    } catch (error) {
      console.error("Subscription creation error:", error);
      res.status(500).json({
        success: false,
        error: "Internal server error during subscription creation"
      });
    }
  });

  // Cancel Subscription Route
  app.post('/api/subscription/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      await storage.updateUserSubscription(userId, {
        subscriptionStatus: 'cancelled',
        subscriptionEndDate: new Date() // End immediately
      });

      res.json({
        success: true,
        message: "Subscription cancelled successfully"
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ error: "Failed to cancel subscription" });
    }
  });

  // Payment History Route
  app.get('/api/payment/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const transactions = await storage.getPaymentTransactionsByUserId(userId);
      res.json({
        payments: transactions,
        total: transactions.length
      });
    } catch (error) {
      console.error("Error fetching payment history:", error);
      res.status(500).json({ error: "Failed to fetch payment history" });
    }
  });

  // Chat routes
  app.get('/api/chat/conversations', isAuthenticated, requireChatAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const conversations = await storage.getChatConversationsByUserId(userId);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching chat conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/chat/conversations', isAuthenticated, requireChatAccess, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { title } = req.body;
      
      const conversation = await storage.createChatConversation({
        userId,
        title: title || "New Conversation",
        status: "active"
      });
      
      res.json(conversation);
    } catch (error) {
      console.error("Error creating chat conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  app.get('/api/chat/conversations/:id/messages', isAuthenticated, requireChatAccess, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getChatMessagesByConversationId(conversationId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching chat messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post('/api/chat/conversations/:id/messages', isAuthenticated, requireChatAccess, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const userId = getUserId(req);
      const { content, messageType = 'text' } = req.body;
      
      const message = await storage.createChatMessage({
        conversationId,
        senderId: userId,
        senderType: 'user',
        content,
        messageType,
        isRead: false
      });
      
      // Check if we need to generate an AI response
      if (content.toLowerCase().includes('help') || content.toLowerCase().includes('question')) {
        // Simple AI response for common questions
        const aiResponse = await generateAIResponse(content);
        await storage.createChatMessage({
          conversationId,
          senderId: 'ai-assistant',
          senderType: 'ai',
          content: aiResponse,
          messageType: 'text',
          isRead: false
        });
      }
      
      res.json(message);
    } catch (error) {
      console.error("Error creating chat message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Admin chat routes
  app.get('/api/admin/chat/conversations', requireAdmin, async (req: any, res) => {
    try {
      const conversations = await storage.getAllChatConversations();
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching admin chat conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.post('/api/admin/chat/conversations/:id/messages', requireAdmin, async (req: any, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const adminId = getUserId(req);
      const { content, messageType = 'text' } = req.body;
      
      const message = await storage.createChatMessage({
        conversationId,
        senderId: adminId,
        senderType: 'admin',
        content,
        messageType,
        isRead: false
      });
      
      res.json(message);
    } catch (error) {
      console.error("Error creating admin chat message:", error);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // Admin subscription management
  app.post('/api/admin/users/:userId/subscription', requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const { planName, subscriptionStatus = 'active', durationMonths = 1 } = req.body;
      
      // Validate plan exists
      const plan = await storage.getSubscriptionPlan(planName);
      if (!plan) {
        return res.status(400).json({ message: "Invalid subscription plan" });
      }
      
      // Calculate end date
      const subscriptionEndDate = new Date();
      subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + durationMonths);
      
      // Update user subscription
      const updatedUser = await storage.updateUserSubscription(userId, {
        subscriptionPlan: planName,
        subscriptionStatus,
        subscriptionStartDate: new Date(),
        subscriptionEndDate,
        maxShipments: plan.maxShipments,
        maxDocuments: plan.maxDocuments,
        currentShipmentCount: 0,
        currentDocumentCount: 0,
        updatedAt: new Date()
      });
      
      res.json({
        success: true,
        message: `User subscription updated to ${plan.displayName}`,
        user: updatedUser
      });
    } catch (error) {
      console.error("Error updating user subscription:", error);
      res.status(500).json({ message: "Failed to update user subscription" });
    }
  });

  app.get('/api/admin/subscription/plans', requireAdmin, async (req: any, res) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching subscription plans:", error);
      res.status(500).json({ message: "Failed to fetch subscription plans" });
    }
  });

  // Admin/Agent route to get user shipments
  app.get('/api/admin/user-shipments/:userId', requireAgent, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const shipments = await storage.getShipmentsByUserId(userId);
      res.json(shipments);
    } catch (error) {
      console.error("Error fetching user shipments:", error);
      res.status(500).json({ message: "Failed to fetch user shipments" });
    }
  });

  // Admin/Agent invoice upload endpoint
  app.post('/api/admin/upload-invoice', requireAgent, upload.single('invoice'), async (req: any, res) => {
    try {
      const adminUserId = getUserId(req);
      const adminUser = await storage.getUser(adminUserId);
      
      if (!req.file) {
        return res.status(400).json({ error: "No invoice file uploaded" });
      }

      const {
        targetUserId,
        invoiceNumber,
        invoiceAmount,
        dueDate,
        description,
        shipmentId,
        emailSubject,
        emailMessage
      } = req.body;

      // Validate required fields
      if (!targetUserId || !invoiceNumber || !invoiceAmount) {
        return res.status(400).json({ 
          error: "Target user, invoice number, and amount are required" 
        });
      }

      // Get target user details
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) {
        return res.status(400).json({ error: "Target user not found" });
      }

      // Create document entry with invoice-specific fields
      const documentData = {
        userId: targetUserId, // Document belongs to target user
        shipmentId: shipmentId ? parseInt(shipmentId) : null,
        fileName: req.file.filename,
        originalName: req.file.originalname,
        fileType: req.file.mimetype,
        fileSize: req.file.size,
        category: 'shipping_invoice',
        status: 'completed',
        filePath: req.file.path,
        
        // Invoice-specific fields
        invoiceNumber,
        invoiceAmount: parseFloat(invoiceAmount),
        dueDate: dueDate ? new Date(dueDate) : null,
        invoiceStatus: 'sent',
        sentToUserId: targetUserId,
        sentByUserId: adminUserId,
        emailSentAt: new Date(),
      };

      const document = await storage.createDocument(documentData);

      // Send email notification to target user
      const invoiceDetails = {
        invoiceNumber,
        invoiceAmount,
        dueDate,
        description,
        emailSubject,
        emailMessage
      };

      await sendInvoiceNotification(targetUser, invoiceDetails, adminUser);

      res.json({
        success: true,
        message: "Invoice uploaded and notification sent successfully",
        document,
        targetUser: {
          email: targetUser.email,
          name: `${targetUser.firstName} ${targetUser.lastName}`,
          company: targetUser.companyName
        }
      });

    } catch (error) {
      console.error("Error uploading admin invoice:", error);
      res.status(500).json({ 
        error: "Failed to upload invoice",
        details: error.message 
      });
    }
  });

  // ================================
  // XML INTEGRATION ENDPOINTS
  // ================================

  // XML Shipment Data Upload - Admin/Agent Only
  app.post('/api/xml/shipments/upload', requireAgent, async (req: any, res) => {
    try {
      const { xmlContent, sourceSystem, userId } = req.body;
      
      if (!xmlContent) {
        return res.status(400).json({
          success: false,
          error: 'XML content is required'
        });
      }

      if (!sourceSystem) {
        return res.status(400).json({
          success: false,
          error: 'Source system identifier is required'
        });
      }

      console.log(`Processing XML data from ${sourceSystem}`);
      
      const results = await xmlIntegrator.processXMLShipmentData(
        xmlContent, 
        sourceSystem, 
        userId
      );

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Processed ${results.length} records: ${successCount} successful, ${errorCount} failed`,
        results: results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount
        }
      });

    } catch (error) {
      console.error('XML upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process XML data',
        details: error.message
      });
    }
  });

  // XML Shipment Data Upload via File - Admin/Agent Only
  app.post('/api/xml/shipments/upload-file', requireAgent, upload.single('xmlFile'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'XML file is required'
        });
      }

      const { sourceSystem, userId } = req.body;
      
      if (!sourceSystem) {
        return res.status(400).json({
          success: false,
          error: 'Source system identifier is required'
        });
      }

      // Read XML file content
      const xmlContent = fs.readFileSync(req.file.path, 'utf-8');
      
      console.log(`Processing XML file from ${sourceSystem}: ${req.file.originalname}`);
      
      const results = await xmlIntegrator.processXMLShipmentData(
        xmlContent, 
        sourceSystem, 
        userId
      );

      // Clean up uploaded file
      fs.unlinkSync(req.file.path);

      const successCount = results.filter(r => r.success).length;
      const errorCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Processed ${results.length} records from ${req.file.originalname}: ${successCount} successful, ${errorCount} failed`,
        results: results,
        summary: {
          total: results.length,
          successful: successCount,
          failed: errorCount,
          fileName: req.file.originalname
        }
      });

    } catch (error) {
      console.error('XML file upload error:', error);
      
      // Clean up file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      
      res.status(500).json({
        success: false,
        error: 'Failed to process XML file',
        details: error.message
      });
    }
  });

  // Get XML Integration Templates - Admin/Agent Only
  app.get('/api/xml/templates', requireAgent, async (req, res) => {
    try {
      const templates = {
        coprar: {
          name: 'UN/EDIFACT COPRAR (Container Report)',
          description: 'Container discharge/loading report format',
          example: `<?xml version="1.0" encoding="UTF-8"?>
<COPRAR>
  <message_header>
    <sender>SHIPPING_LINE</sender>
    <receiver>TERMINAL</receiver>
    <date>2025-01-17</date>
    <time>10:30:00</time>
  </message_header>
  <container>
    <container_number>MSKU1234567</container_number>
    <equipment_id>MSKU1234567</equipment_id>
    <bill_of_lading>MAEU123456789</bill_of_lading>
    <status>DISC</status>
    <movement_type>DISCHARGE</movement_type>
    <loading_port>CNSHA</loading_port>
    <discharge_port>USLAX</discharge_port>
    <vessel_name>MSC MAYA</vessel_name>
    <voyage_number>025W</voyage_number>
    <estimated_arrival_time>2025-01-20T14:00:00Z</estimated_arrival_time>
    <actual_arrival_time>2025-01-20T13:45:00Z</actual_arrival_time>
    <shipper>ACME CORPORATION</shipper>
    <consignee>TARGET IMPORTS LLC</consignee>
  </container>
</COPRAR>`
        },
        coparn: {
          name: 'UN/EDIFACT COPARN (Container Announcement)',
          description: 'Container announcement message format',
          example: `<?xml version="1.0" encoding="UTF-8"?>
<COPARN>
  <message_header>
    <sender>FREIGHT_FORWARDER</sender>
    <receiver>TERMINAL</receiver>
    <date>2025-01-17</date>
  </message_header>
  <container>
    <equipment_id>HLBU5678901</equipment_id>
    <container_number>HLBU5678901</container_number>
    <bill_of_lading>HLCU987654321</bill_of_lading>
    <place_of_loading>DEHAM</place_of_loading>
    <place_of_discharge>USNYC</place_of_discharge>
    <vessel_name>HAPAG EXPRESS</vessel_name>
    <voyage_number>052E</voyage_number>
    <estimated_time_arrival>2025-01-25T08:00:00Z</estimated_time_arrival>
    <shipper_party>EUROPEAN EXPORTS GMBH</shipper_party>
    <consignee_party>AMERICAN IMPORTS INC</consignee_party>
  </container>
</COPARN>`
        },
        generic: {
          name: 'Generic Shipments Format',
          description: 'Simple shipments XML format',
          example: `<?xml version="1.0" encoding="UTF-8"?>
<shipments>
  <shipment>
    <shipment_id>SEA-2025-001</shipment_id>
    <bill_of_lading>OOLU123456789</bill_of_lading>
    <container_number>OOLU1234567</container_number>
    <origin>Shanghai, China</origin>
    <origin_port>CNSHA</origin_port>
    <destination>Los Angeles, CA</destination>
    <destination_port>USLAX</destination_port>
    <transport_mode>ocean</transport_mode>
    <status>in_transit</status>
    <vessel>OOCL SHANGHAI</vessel>
    <voyage>038W</voyage>
    <eta>2025-01-22T10:00:00Z</eta>
    <shipper>SHANGHAI MANUFACTURING CO</shipper>
    <consignee>LA DISTRIBUTION CENTER</consignee>
    <freight_charges>2500.00</freight_charges>
    <total_value>45000.00</total_value>
  </shipment>
  <shipment>
    <shipment_id>AIR-2025-002</shipment_id>
    <bill_of_lading>180-12345678</bill_of_lading>
    <origin>Frankfurt, Germany</origin>
    <destination>Miami, FL</destination>
    <transport_mode>air</transport_mode>
    <status>departed</status>
    <vessel>LH441</vessel>
    <eta>2025-01-18T15:30:00Z</eta>
    <shipper>GERMAN PRECISION TOOLS</shipper>
    <consignee>MIAMI IMPORTS LLC</consignee>
    <freight_charges>890.00</freight_charges>
    <total_value>12000.00</total_value>
  </shipment>
</shipments>`
        },
        status_update: {
          name: 'Container Status Update',
          description: 'Status update format for existing containers',
          example: `<?xml version="1.0" encoding="UTF-8"?>
<container_status>
  <update>
    <container_number>MSKU1234567</container_number>
    <bill_of_lading>MAEU123456789</bill_of_lading>
    <status>delivered</status>
    <movement_type>DLVR</movement_type>
    <location>Customer Warehouse</location>
    <timestamp>2025-01-17T14:30:00Z</timestamp>
  </update>
  <update>
    <container_number>HLBU5678901</container_number>
    <status>customs_hold</status>
    <location>CBP Examination Station</location>
    <timestamp>2025-01-17T09:15:00Z</timestamp>
  </update>
</container_status>`
        }
      };

      res.json({
        success: true,
        templates: templates,
        supported_formats: [
          'UN/EDIFACT COPRAR',
          'UN/EDIFACT COPARN', 
          'Generic Shipments XML',
          'Container Status Updates',
          'Custom formats (auto-detected)'
        ]
      });

    } catch (error) {
      console.error('Template retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve XML templates'
      });
    }
  });

  // XML Integration Status - Admin Only
  app.get('/api/xml/integration/status', requireAdmin, async (req, res) => {
    try {
      // Get recent XML integration activity
      const allShipments = await storage.getAllShipments();
      const xmlShipments = allShipments.filter(s => 
        s.shipmentId.includes('COPRAR-') || 
        s.shipmentId.includes('COPARN-') || 
        s.shipmentId.includes('CUSTOM-')
      );

      const stats = {
        total_xml_shipments: xmlShipments.length,
        recent_activity: xmlShipments
          .sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0))
          .slice(0, 10)
          .map(s => ({
            shipment_id: s.shipmentId,
            status: s.status,
            transport_mode: s.transportMode,
            created_at: s.createdAt,
            source: s.shipmentId.startsWith('COPRAR-') ? 'COPRAR' :
                   s.shipmentId.startsWith('COPARN-') ? 'COPARN' : 'Custom'
          })),
        status_distribution: {
          pending: xmlShipments.filter(s => s.status === 'pending').length,
          in_transit: xmlShipments.filter(s => s.status === 'in_transit').length,
          delivered: xmlShipments.filter(s => s.status === 'delivered').length,
          customs_hold: xmlShipments.filter(s => s.status === 'customs_hold').length,
          other: xmlShipments.filter(s => !['pending', 'in_transit', 'delivered', 'customs_hold'].includes(s.status)).length
        }
      };

      res.json({
        success: true,
        integration_status: 'active',
        statistics: stats
      });

    } catch (error) {
      console.error('XML integration status error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve integration status'
      });
    }
  });

  // ===== DESCARTES ONEVIEW INTEGRATION ENDPOINTS =====
  
  // Descartes OneView XML export endpoints
  app.get('/api/xml/oneview/export/:shipmentId', requireAdmin, async (req, res) => {
    try {
      const { DescartesOneViewIntegration } = await import('./descartesOneViewIntegration');
      const oneViewIntegration = new DescartesOneViewIntegration();
      
      const shipmentId = parseInt(req.params.shipmentId);
      const format = req.query.format as 'edifact' | 'cargo-xml' | 'oneview-standard' || 'oneview-standard';
      
      if (isNaN(shipmentId)) {
        return res.status(400).json({ error: 'Invalid shipment ID' });
      }

      const xml = await oneViewIntegration.exportToOneViewXML(shipmentId, format);
      
      res.setHeader('Content-Type', 'application/xml');
      res.setHeader('Content-Disposition', `attachment; filename="oneview-shipment-${shipmentId}-${format}.xml"`);
      res.send(xml);
    } catch (error: any) {
      console.error('OneView XML export error:', error);
      res.status(500).json({ error: error.message || 'OneView XML export failed' });
    }
  });

  // Batch export multiple shipments to OneView
  app.post('/api/xml/oneview/batch-export', requireAdmin, async (req, res) => {
    try {
      const { DescartesOneViewIntegration } = await import('./descartesOneViewIntegration');
      const oneViewIntegration = new DescartesOneViewIntegration();
      
      const { shipmentIds, format = 'oneview-standard' } = req.body;
      
      if (!Array.isArray(shipmentIds) || shipmentIds.length === 0) {
        return res.status(400).json({ error: 'shipmentIds array is required' });
      }

      const results = await oneViewIntegration.batchExportToOneView(shipmentIds, format);
      
      res.json({
        success: true,
        results,
        totalShipments: shipmentIds.length,
        successfulExports: results.filter(r => r.success).length,
        failedExports: results.filter(r => !r.success).length
      });
    } catch (error: any) {
      console.error('OneView batch export error:', error);
      res.status(500).json({ error: error.message || 'OneView batch export failed' });
    }
  });

  // OneView integration status and configuration
  app.get('/api/xml/oneview/status', requireAdmin, async (req, res) => {
    try {
      // Get count of shipments available for OneView export from storage
      const allShipments = await storage.getAllShipments();
      const totalShipments = allShipments.length;

      res.json({
        success: true,
        integration_status: 'active',
        supported_formats: ['oneview-standard', 'edifact', 'cargo-xml'],
        total_exportable_shipments: totalShipments,
        last_updated: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('OneView status error:', error);
      res.status(500).json({ error: error.message || 'Failed to get OneView status' });
    }
  });

  // ISF Filing Routes
  app.get('/api/isf/filings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const filings = await storage.getIsfFilingsByUserId(userId);
      res.json(filings);
    } catch (error) {
      console.error("Error fetching ISF filings:", error);
      res.status(500).json({ message: "Failed to fetch ISF filings" });
    }
  });

  // Get specific ISF filing with documents
  app.get('/api/isf/filings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const filing = await storage.getIsfFilingById(parseInt(id));
      
      if (!filing) {
        return res.status(404).json({ message: "ISF filing not found" });
      }

      // Check if user owns this filing or is admin/agent
      const userId = getUserId(req);
      const user = await storage.getUser(userId);
      if (filing.userId !== userId && !user?.isAdmin && !user?.isAgent) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get associated documents
      const documents = await storage.getDocumentsByIsfId(parseInt(id));
      
      // Return filing with documents
      res.json({
        ...filing,
        documents: documents.map(doc => ({
          id: doc.id,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          uploadDate: doc.uploadDate,
          documentType: doc.documentType || 'Unknown'
        }))
      });
    } catch (error) {
      console.error("Error fetching ISF filing:", error);
      res.status(500).json({ message: "Failed to fetch ISF filing" });
    }
  });

  // Get documents associated with an ISF filing
  app.get('/api/documents/isf/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Get the ISF filing to check ownership
      const filing = await storage.getIsfFilingById(parseInt(id));
      if (!filing) {
        return res.status(404).json({ message: "ISF filing not found" });
      }

      // Check if user owns this filing or is admin/agent
      const user = await storage.getUser(userId);
      if (filing.userId !== userId && !user?.isAdmin && !user?.isAgent) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Get associated documents
      const documents = await storage.getDocumentsByIsfId(parseInt(id));
      
      res.json(documents);
    } catch (error) {
      console.error("Error fetching ISF documents:", error);
      res.status(500).json({ message: "Failed to fetch ISF documents" });
    }
  });

  // Update ISF filing
  app.put('/api/isf/filings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Get existing filing to check ownership
      const existingFiling = await storage.getIsfFilingById(parseInt(id));
      if (!existingFiling) {
        return res.status(404).json({ message: "ISF filing not found" });
      }

      // Check if user owns this filing or is admin/agent
      const user = await storage.getUser(userId);
      if (existingFiling.userId !== userId && !user?.isAdmin && !user?.isAgent) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Don't allow updates to submitted/paid filings unless admin
      if (existingFiling.status === 'submitted' && !user?.isAdmin) {
        return res.status(400).json({ message: "Cannot modify submitted ISF filing" });
      }

      // Convert date strings to Date objects for database compatibility
      const updateData = { ...req.body };
      
      // Handle all possible date fields
      const dateFields = ['estimatedArrivalDate', 'invoiceDate', 'filingDate', 'submittedAt', 'createdAt', 'updatedAt'];
      dateFields.forEach(field => {
        if (updateData[field] && typeof updateData[field] === 'string' && updateData[field].trim() !== '') {
          const date = new Date(updateData[field]);
          if (!isNaN(date.getTime())) {
            updateData[field] = date;
          } else {
            delete updateData[field]; // Remove invalid dates
          }
        } else if (updateData[field] === '') {
          updateData[field] = null; // Convert empty strings to null
        }
      });
      
      // Handle all numeric fields that might be empty strings
      const numericFields = [
        'invoiceValue', 'filingFee', 'paymentAmount', 'numberOfPackages', 
        'grossWeight', 'volume', 'invoiceValue'
      ];
      
      numericFields.forEach(field => {
        if (updateData[field] !== undefined) {
          if (updateData[field] === '' || updateData[field] === null) {
            updateData[field] = null;
          } else if (typeof updateData[field] === 'string') {
            const numValue = parseFloat(updateData[field]);
            updateData[field] = isNaN(numValue) ? null : numValue;
          }
        }
      });
      
      // Convert empty strings to null for all fields to prevent database errors
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          delete updateData[key];
        } else if (updateData[key] === '') {
          updateData[key] = null;
        }
      });

      // Update the filing with new data
      const updatedFiling = await storage.updateIsfFiling(parseInt(id), updateData);
      
      res.json({
        success: true,
        isfFiling: updatedFiling,
        message: "ISF filing updated successfully"
      });

    } catch (error) {
      console.error("Error updating ISF filing:", error);
      res.status(500).json({ message: "Failed to update ISF filing" });
    }
  });

  // Submit ISF filing for processing
  app.post('/api/isf/filings/:id/submit', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Get existing filing to check ownership and completeness
      const existingFiling = await storage.getIsfFilingById(parseInt(id));
      if (!existingFiling) {
        return res.status(404).json({ message: "ISF filing not found" });
      }

      // Check if user owns this filing
      if (existingFiling.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Check if already submitted
      if (existingFiling.status === 'submitted') {
        return res.status(400).json({ message: "ISF filing already submitted" });
      }

      // Validate required fields are not TBD
      const requiredFields = [
        'importerOfRecord', 'importerName', 'consigneeName', 'consignee',
        'manufacturerName', 'manufacturerCountry', 'shipToPartyName', 
        'countryOfOrigin', 'htsusNumber', 'commodityDescription',
        'containerStuffingLocation', 'bookingPartyName', 'portOfEntry', 'foreignPortOfUnlading'
      ];

      const missingFields = requiredFields.filter(field => 
        !existingFiling[field] || existingFiling[field] === 'TBD'
      );

      if (missingFields.length > 0) {
        return res.status(400).json({ 
          message: "Please complete all required fields before submission",
          missingFields
        });
      }

      // Update status to submitted and set submission timestamp
      const updatedFiling = await storage.updateIsfFiling(parseInt(id), {
        status: 'submitted',
        submittedAt: new Date()
      });

      res.json({
        success: true,
        isfFiling: updatedFiling,
        message: "ISF filing submitted successfully. Proceed to payment.",
        paymentRequired: true,
        amount: 35.00
      });

    } catch (error) {
      console.error("Error submitting ISF filing:", error);
      res.status(500).json({ message: "Failed to submit ISF filing" });
    }
  });

  // Multi-document ISF scan route using organized folder structure  
  app.post('/api/isf/scan-documents', requireSubscription, isfUpload.array('isfDocuments', 10), async (req: any, res) => {
    console.log('🎯 ISF SCAN-DOCUMENTS ROUTE HIT: Starting ISF document processing...');
    try {
      const files = req.files as Express.Multer.File[];
      console.log(`🎯 ISF ROUTE: Received ${files?.length || 0} files`);
      if (!files || files.length === 0) {
        console.log('🎯 ISF ROUTE: No files uploaded, returning error');
        return res.status(400).json({ error: "No documents uploaded" });
      }

      const userId = getUserId(req);
      console.log(`🎯 ISF ROUTE: Processing ${files.length} ISF documents for user ${userId} using shipment creation system`);
      
      const allExtractedData: any[] = [];
      const uploadedDocuments: any[] = [];

      // Process each document using the same logic as shipment creation
      for (const file of files) {
        console.log(`Processing ISF document: ${file.originalname}`);
        
        // Determine document type using same logic as shipment creation
        const fileName = file.originalname.toLowerCase();
        let documentCategory = 'isf_data_sheet'; // Default for ISF documents
        
        if (fileName.includes('isf') || fileName.includes('information_sheet') || fileName.includes('data_sheet')) {
          documentCategory = 'isf_information_sheet'; // Highest priority
        } else if (fileName.includes('bl') || fileName.includes('bill_of_lading') || fileName.includes('lading')) {
          documentCategory = 'bill_of_lading';
        } else if (fileName.includes('invoice')) {
          documentCategory = 'commercial_invoice';
        } else if (fileName.includes('packing')) {
          documentCategory = 'packing_list';
        }

        console.log(`Document ${file.originalname} identified as category: ${documentCategory}`);
        console.log(`🎯 ISF ROUTE DEBUG: About to call processDocument with category: "${documentCategory}"`);

        // Create temporary document record for processing (won't be saved to DB)
        const tempDocument = {
          id: Date.now(), // Temporary ID
          userId,
          fileName: file.filename,
          originalName: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          category: documentCategory,
          subCategory: null,
          filePath: file.path,
        };

        try {
          // Use the same aiDocumentProcessor system as shipment creation
          console.log(`Processing document with aiDocumentProcessor: ${file.originalname} (${documentCategory})`);
          console.log(`🎯 ISF ROUTE: Calling extractShipmentData with path="${tempDocument.filePath}" and type="${documentCategory}"`);
          
          const extractedData = await aiDocumentProcessor.extractShipmentData(tempDocument.filePath, documentCategory);
          console.log(`🎯 ISF ROUTE: extractShipmentData returned:`, extractedData ? Object.keys(extractedData) : 'null');
          
          if (extractedData && Object.keys(extractedData).length > 0) {
            console.log(`Successfully extracted ${Object.keys(extractedData).length} fields from ${file.originalname}`);
            console.log(`🔍 DEBUG aiDocumentProcessor extractedData for ${file.originalname}:`, JSON.stringify(extractedData, null, 2));
            
            // Store extracted data for consolidation using the same format as shipment creation
            allExtractedData.push({
              documentType: documentCategory,
              fileName: file.originalname,
              data: extractedData
            });

            uploadedDocuments.push({
              fileName: file.originalname,
              fileType: file.mimetype,
              category: documentCategory,
              extractedFields: Object.keys(extractedData).length,
              extractedData: extractedData
            });
          } else {
            console.log(`No meaningful data extracted from ${file.originalname}`);
            uploadedDocuments.push({
              fileName: file.originalname,
              fileType: file.mimetype,
              category: documentCategory,
              extractedFields: 0,
              error: "No meaningful data extracted"
            });
          }

        } catch (error) {
          console.error(`Error processing ${file.originalname}:`, error);
          uploadedDocuments.push({
            fileName: file.originalname,
            fileType: file.mimetype,
            category: documentCategory,
            error: error.message,
            extractedFields: 0
          });
        }
      }

      // Use the same consolidateMultiDocumentData function as shipment creation
      console.log(`Consolidating ISF data from ${allExtractedData.length} documents using shipment creation system`);
      const consolidatedData = consolidateMultiDocumentData(allExtractedData);
      
      console.log(`🎯 ISF CONSOLIDATED DATA:`, JSON.stringify(consolidatedData, null, 2));
      console.log(`🎯 ISF CONSOLIDATED FIELDS COUNT:`, Object.keys(consolidatedData).length);
      
      // Enhanced debug logging after mapping
      console.log('📋 MAPPED ISF FIELD VALUES:');
      console.log('Set importerName:', consolidatedData.importerName || consolidatedData.consigneeName);
      console.log('Set importerAddress:', consolidatedData.importerAddress || consolidatedData.consigneeAddress);
      console.log('Set consignee:', consolidatedData.consigneeName);
      console.log('Set consignee:', consolidatedData.consigneeAddress);
      
      // Manufacturer mapping debug
      let mappedManufacturer = null;
      if (consolidatedData.manufacturerName && consolidatedData.manufacturerAddress) {
        mappedManufacturer = `${consolidatedData.manufacturerName}\n${consolidatedData.manufacturerAddress}`;
      } else if (consolidatedData.manufacturerName && consolidatedData.manufacturerCountry) {
        mappedManufacturer = `${consolidatedData.manufacturerName}\nCountry: ${consolidatedData.manufacturerCountry}`;
      } else if (consolidatedData.manufacturerName) {
        mappedManufacturer = consolidatedData.manufacturerName;
      } else if (consolidatedData.manufacture) {
        mappedManufacturer = consolidatedData.manufacture;
      } else if (consolidatedData.shipperName && consolidatedData.countryOfOrigin && 
                 consolidatedData.shipperName !== consolidatedData.consolidatorName) {
        mappedManufacturer = `${consolidatedData.shipperName}\nCountry: ${consolidatedData.countryOfOrigin}`;
      } else if (consolidatedData.manufacturerCountry) {
        mappedManufacturer = `Country: ${consolidatedData.manufacturerCountry}`;
      }
      console.log('Set manufacturerInformation:', mappedManufacturer);
      
      // Seller mapping debug
      let mappedSeller = null;
      if (consolidatedData.sellerInformation) {
        mappedSeller = consolidatedData.sellerInformation;
      } else if (consolidatedData.sellerName && consolidatedData.sellerAddress) {
        mappedSeller = `${consolidatedData.sellerName}\n${consolidatedData.sellerAddress}`;
      } else if (consolidatedData.sellerName) {
        mappedSeller = consolidatedData.sellerName;
      } else if (consolidatedData.shipperName && consolidatedData.shipperAddress && 
                 consolidatedData.shipperName !== consolidatedData.consolidatorName) {
        mappedSeller = `${consolidatedData.shipperName}\n${consolidatedData.shipperAddress}`;
      }
      console.log('Set sellerInformation:', mappedSeller);
      
      // Buyer mapping debug
      let mappedBuyer = null;
      if (consolidatedData.buyerInformation) {
        mappedBuyer = consolidatedData.buyerInformation;
      } else if (consolidatedData.buyerName && consolidatedData.buyerAddress) {
        mappedBuyer = `${consolidatedData.buyerName}\n${consolidatedData.buyerAddress}`;
      } else if (consolidatedData.buyerName) {
        mappedBuyer = consolidatedData.buyerName;
      } else if (consolidatedData.consigneeName && consolidatedData.consigneeAddress) {
        mappedBuyer = `${consolidatedData.consigneeName}\n${consolidatedData.consigneeAddress}`;
      }
      console.log('Set buyerInformation:', mappedBuyer);
      
      // Ship-to mapping debug
      let mappedShipTo = null;
      if (consolidatedData.shipToPartyInformation) {
        mappedShipTo = consolidatedData.shipToPartyInformation;
      } else if (consolidatedData.shipToPartyName && consolidatedData.shipToPartyAddress) {
        mappedShipTo = `${consolidatedData.shipToPartyName}\n${consolidatedData.shipToPartyAddress}`;
      } else if (consolidatedData.shipToPartyName) {
        mappedShipTo = consolidatedData.shipToPartyName;
      } else if (consolidatedData.consigneeName && consolidatedData.consigneeAddress) {
        mappedShipTo = `${consolidatedData.consigneeName}\n${consolidatedData.consigneeAddress}`;
      }
      console.log('Set shipToPartyInformation:', mappedShipTo);

      res.json({
        success: true,
        extractedData: consolidatedData,
        processedDocuments: uploadedDocuments,
        totalDocuments: files.length,
        consolidatedFields: Object.keys(consolidatedData).length,
        message: `Successfully processed ${files.length} documents using shipment creation system and consolidated ISF data. Review the extracted information and complete remaining fields before submitting.`
      });
      
    } catch (error) {
      console.error("Error processing ISF documents:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process ISF documents",
        message: "Document processing encountered an error. Please try again or contact support."
      });
    }
  });

  // Keep original single document route for backward compatibility
  app.post('/api/isf/scan-document', requireSubscription, upload.single('isfDocument'), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No document uploaded" });
      }

      const userId = getUserId(req);
      const file = req.file;
      const fileExtension = file.originalname.split('.').pop()?.toLowerCase();
      
      console.log(`Processing single ISF document: ${file.originalname}`);

      // Use the same processing logic as multi-document upload
      const fileName = file.originalname.toLowerCase();
      let documentCategory = 'isf_data_sheet';
      
      if (fileName.includes('isf') || fileName.includes('information_sheet') || fileName.includes('data_sheet')) {
        documentCategory = 'isf_information_sheet';
      } else if (fileName.includes('bl') || fileName.includes('bill_of_lading') || fileName.includes('lading')) {
        documentCategory = 'bill_of_lading';
      }

      const tempDocument = {
        id: Date.now(),
        userId,
        fileName: file.filename,
        originalName: file.originalname,
        fileType: file.mimetype,
        fileSize: file.size,
        category: documentCategory,
        subCategory: null,
        filePath: file.path,
      };

      const extractedData = await aiDocumentProcessor.processDocument(tempDocument);
      
      res.json({
        success: true,
        extractedData: extractedData || {},
        message: extractedData && Object.keys(extractedData).length > 0 ? 
          "Document processed successfully. Review the extracted information." :
          "Document processed but no data was extracted. Please check the document format."
      });

    } catch (error) {
      console.error("Error processing ISF document:", error);
      res.status(500).json({
        success: false,
        error: "Failed to process ISF document",
        message: "Document processing encountered an error. Please try again or contact support."
      });
    }
  });

  // ISF filing creation route with organized document folders
  app.post('/api/isf/create', requireSubscription, isfUpload.array('isfDocuments', 10), async (req: any, res) => {
    try {
      const userId = getUserId(req);
      console.log('Creating ISF filing for user:', userId);
      console.log('Request body:', req.body);
      
      // Use ISF number from multer configuration if available, otherwise generate one
      const isfNumber = req.isfNumber || `ISF-${Date.now().toString().slice(-6)}`;

      // Prepare ISF filing data with default values for required fields
      const isfData = {
        userId,
        isfNumber,
        status: 'draft',
        filingFee: 35.00,
        
        // Required fields with defaults
        importerOfRecord: req.body.importerOfRecord || 'TO BE PROVIDED',
        importerName: req.body.importerName || req.body.consigneeName || 'TO BE PROVIDED',
        importerAddress: req.body.importerAddress || req.body.consigneeAddress || 'TO BE PROVIDED',
        importerCity: req.body.importerCity || 'TO BE PROVIDED',
        importerState: req.body.importerState || 'N/A',
        importerZip: req.body.importerZip || '00000',
        importerCountry: req.body.importerCountry || 'US',
        
        consignee: req.body.consignee || 'TO BE PROVIDED',
        consigneeName: req.body.consigneeName || 'TO BE PROVIDED',
        consigneeAddress: req.body.consigneeAddress || 'TO BE PROVIDED',
        consigneeCity: req.body.consigneeCity || 'TO BE PROVIDED',
        consigneeState: req.body.consigneeState || 'N/A',
        consigneeZip: req.body.consigneeZip || '00000',
        consigneeCountry: req.body.consigneeCountry || 'US',
        
        manufacturerInformation: req.body.manufacturerInformation || 'TO BE PROVIDED',
        shipToPartyInformation: req.body.shipToPartyInformation || 'TO BE PROVIDED',
        countryOfOrigin: req.body.countryOfOrigin || 'TO BE PROVIDED',
        htsusNumber: req.body.htsusNumber || '0000000000',
        commodityDescription: req.body.commodityDescription || 'TO BE PROVIDED',
        containerStuffingLocation: req.body.containerStuffingLocation || 'TO BE PROVIDED',
        consolidatorStufferInfo: req.body.consolidatorStufferInfo || 'TO BE PROVIDED',
        
        bookingPartyName: req.body.bookingPartyName || req.body.importerName || 'TO BE PROVIDED',
        bookingPartyAddress: req.body.bookingPartyAddress || req.body.importerAddress || 'TO BE PROVIDED',
        bookingPartyCity: req.body.bookingPartyCity || req.body.importerCity || 'TO BE PROVIDED',
        bookingPartyCountry: req.body.bookingPartyCountry || req.body.importerCountry || 'US',
        
        // Optional fields
        buyerInformation: req.body.buyerInformation || null,
        sellerInformation: req.body.sellerInformation || null,
        billOfLading: req.body.billOfLading || null,
        vesselName: req.body.vesselName || null,
        voyageNumber: req.body.voyageNumber || null,
        containerNumbers: req.body.containerNumbers || null,
        portOfEntry: req.body.portOfEntry || null,
        foreignPortOfLading: req.body.foreignPortOfLading || null,
        estimatedArrivalDate: req.body.estimatedArrivalDate ? new Date(req.body.estimatedArrivalDate) : null,
        estimatedDepartureDate: req.body.estimatedDepartureDate ? new Date(req.body.estimatedDepartureDate) : null,
        mblScacCode: req.body.mblScacCode || null,
        hblScacCode: req.body.hblScacCode || null,
        amsNumber: req.body.amsNumber || null,
        foreignPortOfUnlading: req.body.foreignPortOfUnlading || null
      };

      console.log('Creating ISF filing with data:', isfData);

      // Create ISF filing record
      const isfFiling = await storage.createIsfFiling(isfData);

      console.log('ISF filing created successfully:', isfFiling);

      // Save uploaded documents to database with ISF filing ID in organized folder structure
      const files = req.files as Express.Multer.File[];
      let documentsUploaded = 0;
      
      if (files && files.length > 0) {
        console.log(`Saving ${files.length} documents to database with ISF filing ID: ${isfFiling.id}`);
        console.log(`Documents organized in folder: ${req.isfDirectory || 'standard uploads'}`);
        
        for (const file of files) {
          try {
            const documentData = {
              shipmentId: null, // ISF documents are not linked to shipments
              userId,
              fileName: file.filename,
              originalName: file.originalname,
              fileType: file.mimetype,
              fileSize: file.size,
              category: 'isf_document',
              status: 'processed',
              filePath: file.path, // This will be the organized path
              isfFilingId: isfFiling.id, // Link to ISF filing
              extractedData: {},
            };
            
            await storage.createDocument(documentData);
            documentsUploaded++;
            console.log(`Document ${file.originalname} saved to organized folder: ${file.path}`);
          } catch (docError) {
            console.error(`Error saving document ${file.originalname}:`, docError);
          }
        }
      }

      res.json({
        success: true,
        isfFiling,
        id: isfFiling.id,
        isfNumber: isfFiling.isfNumber,
        documentsUploaded,
        documentsFolder: req.isfDirectory ? path.basename(req.isfDirectory) : null,
        message: `ISF filing ${isfNumber} created successfully. ${documentsUploaded} document(s) organized in dedicated folder. Status: ${isfFiling.status}`,
      });

    } catch (error) {
      console.error("Error creating ISF filing:", error);
      res.status(500).json({ 
        message: "Failed to create ISF filing", 
        error: error.message 
      });
    }
  });

  // Enhanced ISF filing submission route
  app.post('/api/isf/submit', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      
      // Validate required ISF fields
      const requiredFields = [
        'importerName', 'importerAddress', 'consigneeName', 'consigneeAddress',
        'manufacturerCountry', 'countryOfOrigin', 'htsusNumber', 'commodityDescription',
        'portOfEntry', 'foreignPortOfLading', 'billOfLading', 'vesselName',
        'containerNumbers', 'estimatedArrivalDate'
      ];
      
      const missingFields = requiredFields.filter(field => !req.body[field]);
      if (missingFields.length > 0) {
        return res.status(400).json({
          error: "Missing required fields",
          missingFields,
          message: `Please complete the following required fields: ${missingFields.join(', ')}`
        });
      }

      // Generate ISF number
      const timestamp = Date.now().toString().slice(-6);
      const isfNumber = `ISF-${timestamp}`;

      // Create ISF filing record
      const isfFiling = await storage.createIsfFiling({
        userId,
        isfNumber,
        ...req.body,
        status: 'submitted',
        submittedAt: new Date(),
        filingFee: 35.00
      });

      // Send notification
      await NotificationService.notifyIsfSubmitted(userId, isfNumber);

      res.json({
        success: true,
        isfFiling,
        message: `ISF filing ${isfNumber} submitted successfully. Filing fee: $35.00`,
        amount: 35.00
      });

    } catch (error) {
      console.error("Error submitting ISF filing:", error);
      res.status(500).json({ message: "Failed to submit ISF filing" });
    }
  });

  // Convert ISF Filing to Shipment
  app.post('/api/isf/filings/:id/convert-to-shipment', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req);
      
      // Get the ISF filing
      const isfFiling = await storage.getIsfFilingById(parseInt(id));
      if (!isfFiling) {
        return res.status(404).json({ message: "ISF filing not found" });
      }

      // Check if user owns this filing or is admin/agent
      const user = await storage.getUser(userId);
      if (isfFiling.userId !== userId && !user?.isAdmin && !user?.isAgent) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Generate a unique shipment ID
      const timestamp = Date.now().toString().slice(-6);
      const shipmentId = `${isfFiling.portOfEntry || 'SEA'}-${timestamp}`;

      // Map ISF data to shipment structure
      const shipmentData: InsertShipment = {
        shipmentId,
        userId: isfFiling.userId,
        
        // Transport and status
        transportMode: 'ocean', // ISF is primarily for ocean shipments
        status: 'pending',
        
        // Location mapping
        portOfLoading: isfFiling.foreignPortOfUnlading, // Foreign port
        portOfDischarge: isfFiling.portOfEntry, // US port of entry
        destinationPort: isfFiling.portOfEntry,
        
        // Party information mapping  
        shipperName: isfFiling.manufacturerInformation?.split('\n')[0] || null,
        shipperAddress: isfFiling.manufacturerInformation || null,
        shipperCountry: isfFiling.countryOfOrigin,
        
        consigneeName: isfFiling.consignee || isfFiling.consigneeName,
        consigneeAddress: isfFiling.consigneeAddress ? 
          `${isfFiling.consigneeAddress}${isfFiling.consigneeCity ? '\n' + isfFiling.consigneeCity : ''}${isfFiling.consigneeState ? ', ' + isfFiling.consigneeState : ''}${isfFiling.consigneeZip ? ' ' + isfFiling.consigneeZip : ''}` 
          : null,
        consigneeCity: isfFiling.consigneeCity,
        consigneeState: isfFiling.consigneeState,
        consigneeZipCode: isfFiling.consigneeZip,
        consigneeCountry: isfFiling.consigneeCountry,
        
        // Booking and transport details
        bookingNumber: isfFiling.billOfLading,
        billOfLadingNumber: isfFiling.billOfLading,
        vesselAndVoyage: isfFiling.vesselName && isfFiling.voyageNumber ? 
          `${isfFiling.vesselName}/${isfFiling.voyageNumber}` : isfFiling.vesselName,
        containerNumber: Array.isArray(isfFiling.containerNumbers) ? 
          isfFiling.containerNumbers[0] : isfFiling.containerNumbers,
        containerNumbers: Array.isArray(isfFiling.containerNumbers) ? 
          isfFiling.containerNumbers : [isfFiling.containerNumbers].filter(Boolean),
        
        // Cargo information
        cargoDescription: isfFiling.commodityDescription,
        hsCode: isfFiling.htsusNumber,
        
        // Dates
        eta: isfFiling.estimatedArrivalDate,
        
        // Additional ISF-specific data in notes
        notes: `Converted from ISF Filing ${isfFiling.isfNumber}\n\n` +
               `Original ISF Data:\n` +
               `- Importer: ${isfFiling.importerName}\n` +
               `- Manufacturer: ${isfFiling.manufacturerInformation}\n` +
               `- Container Stuffing Location: ${isfFiling.containerStuffingLocation}\n` +
               `- Consolidator Info: ${isfFiling.consolidatorStufferInfo}\n` +
               (isfFiling.buyerInformation ? `- Buyer: ${isfFiling.buyerInformation}\n` : '') +
               (isfFiling.sellerInformation ? `- Seller: ${isfFiling.sellerInformation}\n` : ''),
        
        // Invoice information if available
        totalValue: isfFiling.invoiceValue ? parseFloat(isfFiling.invoiceValue.toString()) : null,
        currency: isfFiling.currency || 'USD',
        
        // Source tracking
        sourceSystem: 'isf_conversion',
        referenceNumber: isfFiling.isfNumber,
        
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Create the shipment
      const newShipment = await storage.createShipment(shipmentData);

      // Get ISF documents and link them to the new shipment
      const isfDocuments = await storage.getDocumentsByIsfId(parseInt(id));
      let documentsLinked = 0;

      for (const doc of isfDocuments) {
        try {
          await storage.updateDocument(doc.id, {
            shipmentId: newShipment.id,
            category: doc.category === 'isf_document' ? 'bill_of_lading' : doc.category
          });
          documentsLinked++;
        } catch (docError) {
          console.error(`Error linking document ${doc.id} to shipment:`, docError);
        }
      }

      // Update ISF filing to mark it as converted
      await storage.updateIsfFiling(parseInt(id), {
        notes: (isfFiling.notes || '') + `\n\nConverted to Shipment ${shipmentId} on ${new Date().toISOString()}`
      });

      console.log(`✅ ISF ${isfFiling.isfNumber} successfully converted to shipment ${shipmentId} (ID: ${newShipment.id})`);
      
      res.json({
        success: true,
        shipment: newShipment,
        shipmentId: newShipment.id,
        documentsLinked,
        message: `ISF filing ${isfFiling.isfNumber} successfully converted to shipment ${shipmentId}. ${documentsLinked} document(s) linked.`
      });

    } catch (error) {
      console.error("❌ Error converting ISF filing to shipment:", error);
      res.status(500).json({ 
        message: "Failed to convert ISF filing to shipment",
        error: error.message || error.toString(),
        details: error.stack
      });
    }
  });

  // All ISF routes now use the consolidated document processing system from shipment creation
  
  // Airline Tracking Routes
  app.get('/api/airlines', async (req, res) => {
    try {
      const airlines = airlineTracking.getSupportedAirlines();
      res.json(airlines);
    } catch (error) {
      console.error('Error fetching airlines:', error);
      res.status(500).json({ message: 'Failed to fetch airlines' });
    }
  });

  // Airline AWB Tracking Route
  app.get('/api/airline/:awbNumber', async (req, res) => {
    try {
      const { awbNumber } = req.params;
      const trackingUrl = airlineTracking.getTrackingUrl(awbNumber);
      res.json({ 
        awbNumber,
        trackingUrl,
        carrier: airlineTracking.detectCarrier(awbNumber)
      });
    } catch (error) {
      console.error('Error fetching airline tracking:', error);
      res.status(500).json({ message: 'Failed to fetch tracking information' });
    }
  });

  // Support Routes
  app.post('/api/support/tickets', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const { subject, priority, description } = req.body;
      
      const ticket = await supportService.createTicket(userId, {
        subject,
        priority: priority || 'medium',
        description
      });
      
      res.json({ success: true, ticket });
    } catch (error) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({ message: 'Failed to create support ticket' });
    }
  });

  app.get('/api/support/tickets', requireSubscription, async (req: any, res) => {
    try {
      const userId = getUserId(req);
      const tickets = await supportService.getUserTickets(userId);
      res.json(tickets);
    } catch (error) {
      console.error('Error fetching support tickets:', error);
      res.status(500).json({ message: 'Failed to fetch support tickets' });
    }
  });

  // XML Processing Routes
  app.post('/api/xml/upload', upload.single('xmlFile'), requireSubscription, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No XML file uploaded' });
      }

      const result = await xmlIntegrationService.processXmlFile(req.file.path);
      res.json(result);
    } catch (error) {
      console.error('XML upload error:', error);
      res.status(500).json({ message: 'Failed to process XML file' });
    }
  });

  // Continue with proper XML routes and complete application structure
  app.get('/api/xml/status', requireSubscription, async (req, res) => {
    try {
      const status = await xmlIntegrationService.getStatus();
      res.json(status);
    } catch (error) {
      console.error('XML status error:', error);
      res.status(500).json({ message: 'Failed to get XML status' });
    }
  });

  // ISF Form Pre-filling Route - uses the same consolidateMultiDocumentData system as shipment creation
  app.post('/api/isf/fill-form', upload.array('documents', 10), requireSubscription, async (req: any, res) => {
    console.log('🚨 ISF FILL-FORM ROUTE HIT! Starting ISF document processing...');
    try {
      const userId = getUserId(req);
      console.log(`🚨 ISF FILL-FORM: User ${userId} uploading ${req.files?.length || 0} documents`);

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No documents uploaded for ISF form filling' });
      }

      // Process each document through the extraction pipeline first
      const allExtractedData = [];
      
      for (const file of req.files) {
        try {
          console.log(`Processing ISF document: ${file.originalname}`);
          
          // Determine document type (prioritize ISF documents)
          let documentType = 'other';
          const fileName = file.originalname.toLowerCase();
          
          if (fileName.includes('isf') || fileName.includes('information sheet') || fileName.includes('isf_') || fileName.includes('data sheet')) {
            documentType = 'isf_information_sheet';
          } else if (fileName.includes('bill') && fileName.includes('lading')) {
            documentType = 'bill_of_lading';
          } else if (fileName.includes('invoice')) {
            documentType = 'commercial_invoice';
          } else if (fileName.includes('packing')) {
            documentType = 'packing_list';
          } else if (fileName.includes('arrival')) {
            documentType = 'arrival_notice';
          }
          
          console.log(`📄 Document ${file.originalname} classified as: ${documentType}`);
          console.log(`🎯 ISF FILL-FORM: CALLING extractShipmentData with documentType: "${documentType}"`);
          
          // Extract data using the same AI processor as shipment creation
          // This will automatically trigger ISF enhancement for ISF documents
          const extractedData = await aiDocProcessor.extractShipmentData(file.path, documentType);
          console.log(`🎯 ISF FILL-FORM: EXTRACTION COMPLETE for ${file.originalname}`);
          console.log(`🎯 ISF FILL-FORM: Extracted data keys:`, extractedData ? Object.keys(extractedData) : 'null');
          
          // FORCE ISF PATTERN EXTRACTION for every document in ISF form processing
          console.log('🔍 FORCING ISF PATTERN EXTRACTION for ISF form document...');
          try {
            const fs = require('fs');
            let documentText = '';
            
            // Try to read as text first, if it fails, extract text from PDF
            try {
              documentText = fs.readFileSync(file.path, 'utf8');
            } catch {
              // For PDF files, use PDF extraction
              if (file.mimetype === 'application/pdf') {
                const pdfParse = require('pdf-parse');
                const pdfBuffer = fs.readFileSync(file.path);
                const pdfData = await pdfParse(pdfBuffer);
                documentText = pdfData.text;
              }
            }
            
            if (documentText && documentText.length > 50) {
              console.log('📄 DOCUMENT TEXT SAMPLE for ISF pattern extraction:', documentText.substring(0, 500));
              
              // Use the aiDocumentProcessor's extractISFPatterns method directly
              const isfPatterns = aiDocumentProcessor.extractISFPatterns(documentText);
              console.log('🎯 FORCED ISF PATTERNS RESULT:', JSON.stringify(isfPatterns, null, 2));
              
              // Override extracted data with ISF patterns if found
              if (isfPatterns.seller) {
                console.log(`🎯 OVERRIDING SELLER with ISF pattern: ${isfPatterns.seller}`);
                extractedData.sellerInformation = isfPatterns.seller;
                extractedData.sellerName = isfPatterns.seller.split(/\n|,/)[0].trim();
              }
              if (isfPatterns.manufacturer) {
                console.log(`🎯 OVERRIDING MANUFACTURER with ISF pattern: ${isfPatterns.manufacturer}`);
                extractedData.manufacturerInformation = isfPatterns.manufacturer;
                extractedData.manufacturerName = isfPatterns.manufacturer.split(/\n|,/)[0].trim();
              }
              if (isfPatterns.consolidator) {
                console.log(`🎯 OVERRIDING CONSOLIDATOR with ISF pattern: ${isfPatterns.consolidator}`);
                extractedData.consolidatorStufferInfo = isfPatterns.consolidator;
              }
              if (isfPatterns.buyer) {
                console.log(`🎯 OVERRIDING BUYER with ISF pattern: ${isfPatterns.buyer}`);
                extractedData.buyerInformation = isfPatterns.buyer;
              }
              if (isfPatterns.shipToParty) {
                console.log(`🎯 OVERRIDING SHIP-TO with ISF pattern: ${isfPatterns.shipToParty}`);
                extractedData.shipToPartyInformation = isfPatterns.shipToParty;
              }
              if (isfPatterns.containerStuffingLocation) {
                console.log(`🎯 OVERRIDING STUFFING LOCATION with ISF pattern: ${isfPatterns.containerStuffingLocation}`);
                extractedData.containerStuffingLocation = isfPatterns.containerStuffingLocation;
              }
            } else {
              console.log('❌ Could not extract text from document for ISF pattern matching');
            }
          } catch (patternError) {
            console.error('Error in forced ISF pattern extraction:', patternError);
          }
          
          if (extractedData && Object.keys(extractedData).length > 0) {
            allExtractedData.push({
              documentType,
              fileName: file.originalname,
              data: extractedData
            });
            
            console.log(`✅ ISF FILL-FORM: Successfully extracted ${Object.keys(extractedData).length} fields from ${file.originalname}`);
          } else {
            console.log(`⚠️ ISF FILL-FORM: No meaningful data extracted from ${file.originalname}`);
          }
          
        } catch (error) {
          console.error(`Error processing ISF document ${file.originalname}:`, error);
          // Continue with other documents even if one fails
        }
      }
      
      // Debug what document types we actually have
      console.log('🔍 DOCUMENT TYPES DEBUG:');
      allExtractedData.forEach(doc => {
        console.log(`  File: ${doc.fileName} -> Type: "${doc.documentType}"`);
      });
      
      // Now use the consolidateMultiDocumentData system with properly extracted data
      const consolidatedData = consolidateMultiDocumentData(allExtractedData);
      
      // Prioritize ISF document data for critical fields like consolidator
      const isfDocuments = allExtractedData.filter(doc => doc.documentType === 'isf_information_sheet');
      console.log(`🔍 ISF FILTER DEBUG: Found ${isfDocuments.length} documents with type 'isf_information_sheet'`);
      
      if (isfDocuments.length > 0) {
        console.log('🔍 ISF DOCUMENT PRIORITIZATION - Found ISF documents, forcing ISF values for critical fields...');
        for (const isfDoc of isfDocuments) {
          // Critical fields that should ALWAYS use ISF values when available
          const criticalFields = ['consolidatorStufferInfo', 'containerStuffingLocation', 'sellerInformation', 'manufacturerInformation'];
          
          for (const field of criticalFields) {
            if (isfDoc.data[field]) {
              console.log(`🎯 FORCE ISF PRIORITY: Overriding ${field} with ISF value: ${isfDoc.data[field]}`);
              consolidatedData[field] = isfDoc.data[field];
            }
          }
          
          // Other consolidator fields use normal priority (only if missing)
          const otherConsolidatorFields = ['consolidatorName', 'consolidator', 'containerStuffer', 'stufferName', 'cfsOperator'];
          for (const field of otherConsolidatorFields) {
            if (isfDoc.data[field] && !consolidatedData[field]) {
              console.log(`🎯 NORMAL ISF PRIORITY: Using ${field} from ISF document: ${isfDoc.data[field]}`);
              consolidatedData[field] = isfDoc.data[field];
            }
          }
        }
      }
      
      console.log('Consolidated ISF form data:', consolidatedData);

      // Debug logging for ISF field mapping - ALL FIELDS
      console.log('🔍 ISF FIELD MAPPING DEBUG - ALL CONSOLIDATED FIELDS:');
      console.log('ALL FIELD NAMES:', Object.keys(consolidatedData));
      console.log('🔍 CONTAINER STUFFING DEBUG:');
      console.log('  containerStuffingLocation:', consolidatedData.containerStuffingLocation);
      console.log('  stuffing location:', consolidatedData['stuffing location']);
      console.log('  stuffingLocation:', consolidatedData.stuffingLocation);
      console.log('  container stuffing location:', consolidatedData['container stuffing location']);
      console.log('  portOfLoading:', consolidatedData.portOfLoading);
      console.log('  placeOfReceipt:', consolidatedData.placeOfReceipt);
      console.log('🔍 ALL EXTRACTED FIELDS WITH "STUFF" OR "LOCATION":');
      Object.keys(consolidatedData).filter(key => 
        key.toLowerCase().includes('stuff') || 
        key.toLowerCase().includes('location') || 
        key.toLowerCase().includes('place')
      ).forEach(key => {
        console.log(`  ${key}: ${consolidatedData[key]}`);
      });
      
      console.log('🔍 CURRENT CONTAINER STUFFING LOCATION VALUE:');
      console.log(`  Final containerStuffingLocation: "${consolidatedData.containerStuffingLocation}"`);
      console.log('🔍 USER EXPECTS: A different container stuffing location - need to check what the correct location should be from ISF sheet');
      console.log('🔍 MANUFACTURER DEBUG:');
      console.log('  manufacturerName:', consolidatedData.manufacturerName);
      console.log('  manufacturerAddress:', consolidatedData.manufacturerAddress);
      console.log('  manufacturerCountry:', consolidatedData.manufacturerCountry);
      console.log('  manufacture:', consolidatedData.manufacture);
      console.log('  countryOfOrigin:', consolidatedData.countryOfOrigin);
      
      console.log('🔍 AMS NUMBER DEBUG:');
      console.log('  amsNumber:', consolidatedData.amsNumber);
      console.log('  amsNo:', consolidatedData.amsNo);
      console.log('  ams number:', consolidatedData['ams number']);
      console.log('  ams no:', consolidatedData['ams no']);
      console.log('  amsReference:', consolidatedData.amsReference);
      console.log('  manifestNumber:', consolidatedData.manifestNumber);
      
      console.log('🔍 MANUFACTURER DEBUG:');
      console.log('  manufacturerName:', consolidatedData.manufacturerName);
      console.log('  manufacturerAddress:', consolidatedData.manufacturerAddress);
      console.log('  manufacturerCountry:', consolidatedData.manufacturerCountry);
      console.log('  manufacture:', consolidatedData.manufacture);
      console.log('  countryOfOrigin:', consolidatedData.countryOfOrigin);
      
      console.log('🔍 SELLER/BUYER/SHIP-TO DEBUG:');
      console.log('  sellerName:', consolidatedData.sellerName);
      console.log('  sellerAddress:', consolidatedData.sellerAddress);
      console.log('  sellerInformation:', consolidatedData.sellerInformation);
      console.log('  buyerName:', consolidatedData.buyerName);
      console.log('  buyerAddress:', consolidatedData.buyerAddress);
      console.log('  buyerInformation:', consolidatedData.buyerInformation);
      console.log('  shipToPartyName:', consolidatedData.shipToPartyName);
      console.log('  shipToPartyAddress:', consolidatedData.shipToPartyAddress);
      console.log('  shipToPartyInformation:', consolidatedData.shipToPartyInformation);
      
      console.log('🔍 CONSOLIDATOR DEBUG:');
      console.log('  consolidatorName (ISF specific):', consolidatedData.consolidatorName);
      console.log('  consolidatorStufferInfo:', consolidatedData.consolidatorStufferInfo);
      console.log('  consolidatorInformation:', consolidatedData.consolidatorInformation);
      console.log('  consolidator:', consolidatedData.consolidator);
      console.log('  containerStuffer:', consolidatedData.containerStuffer);
      console.log('  stufferName:', consolidatedData.stufferName);
      console.log('  cfsOperator:', consolidatedData.cfsOperator);
      console.log('  cfsFacility:', consolidatedData.cfsFacility);
      console.log('  containerStuffingLocation:', consolidatedData.containerStuffingLocation);
      console.log('  shipperName (for comparison):', consolidatedData.shipperName);
      
      console.log('🔍 DOCUMENT TYPE ANALYSIS:');
      allExtractedData.forEach((docData, index) => {
        console.log(`  Document ${index + 1}: ${docData.fileName} (${docData.documentType})`);
        console.log(`    ALL EXTRACTED FIELDS:`, Object.keys(docData.data).filter(key => docData.data[key] !== null && docData.data[key] !== undefined && docData.data[key] !== ''));
        
        // Show consolidator-related fields specifically
        const consolidatorFields = ['consolidatorName', 'consolidatorStufferInfo', 'consolidator', 'containerStuffer', 'stufferName', 'cfsOperator'];
        consolidatorFields.forEach(field => {
          if (docData.data[field]) {
            console.log(`    ✓ ${field}: ${docData.data[field]}`);
          }
        });
        
        // Show if this document has shipper info (to see if we're confusing it)
        if (docData.data.shipperName) {
          console.log(`    📦 shipperName: ${docData.data.shipperName}`);
        }
      });

      // Map consolidated data to ISF form fields using the exact same field mappings
      const isfFormData = {
        // Core importer information - Enhanced field mapping
        importerName: consolidatedData.importerName || consolidatedData.consigneeName || null,
        importerAddress: consolidatedData.importerAddress || consolidatedData.consigneeAddress || null,
        consigneeName: consolidatedData.consigneeName || null,
        consigneeAddress: consolidatedData.consigneeAddress || null,
        
        // Manufacturer and party information - Enhanced mappings with ISF-specific fields
        manufacturerCountry: consolidatedData.manufacturerCountry || consolidatedData.countryOfOrigin || null,
        countryOfOrigin: consolidatedData.countryOfOrigin || consolidatedData.manufacturerCountry || null,
        manufacturerInformation: (() => {
          console.log('🏭 BUILDING MANUFACTURER INFORMATION:');
          console.log('  manufacturerInformation:', consolidatedData.manufacturerInformation);
          console.log('  manufacturerName:', consolidatedData.manufacturerName);
          console.log('  manufacturerAddress:', consolidatedData.manufacturerAddress);
          console.log('  manufacturerCountry:', consolidatedData.manufacturerCountry);
          console.log('  cargoDescription:', consolidatedData.cargoDescription);
          
          // Priority-based manufacturer information building
          if (consolidatedData.manufacturerInformation) {
            console.log('✅ Using direct manufacturerInformation');
            return consolidatedData.manufacturerInformation;
          } else if (consolidatedData.manufacturerName && consolidatedData.manufacturerAddress) {
            const result = `${consolidatedData.manufacturerName}\n${consolidatedData.manufacturerAddress}`;
            console.log('✅ Using manufacturerName + manufacturerAddress:', result);
            return result;
          } else if (consolidatedData.manufacturerName && consolidatedData.manufacturerCountry) {
            const result = `${consolidatedData.manufacturerName}\nCountry: ${consolidatedData.manufacturerCountry}`;
            console.log('✅ Using manufacturerName + manufacturerCountry:', result);
            return result;
          } else if (consolidatedData.manufacturerName) {
            console.log('✅ Using manufacturerName only:', consolidatedData.manufacturerName);
            return consolidatedData.manufacturerName;
          } else if (consolidatedData.manufacture) {
            console.log('✅ Using manufacture field:', consolidatedData.manufacture);
            return consolidatedData.manufacture;
          } else {
            // Try to extract manufacturer from cargo description
            const cargoDesc = consolidatedData.cargoDescription || consolidatedData.commodity || '';
            if (cargoDesc) {
              console.log('🔍 Trying to extract manufacturer from cargo description:', cargoDesc);
              
              // Look for manufacturer names in cargo descriptions
              const manufacturerPatterns = [
                /(\b[A-Z][A-Za-z\s&]+(?:FUTURE|STEEL|METAL|MILL|WORKS)\b[A-Za-z\s]*(?:Co\.|Ltd|Inc|Corp|Company)?)/i,
                /^([A-Z][A-Za-z\s&]+(?:Co\.|Ltd|Inc|Corp|Company))/i
              ];
              
              for (const pattern of manufacturerPatterns) {
                const match = cargoDesc.match(pattern);
                if (match && match[1]) {
                  let manufacturer = match[1].trim();
                  manufacturer = manufacturer.replace(/\s+/g, ' ').trim();
                  
                  if (!manufacturer.toLowerCase().includes('logistics') &&
                      !manufacturer.toLowerCase().includes('freight') &&
                      !manufacturer.toLowerCase().includes('forwarding') &&
                      manufacturer.length > 3) {
                    const result = consolidatedData.countryOfOrigin ? 
                      `${manufacturer}\nCountry: ${consolidatedData.countryOfOrigin}` : manufacturer;
                    console.log('🎯 MANUFACTURER EXTRACTED FROM CARGO:', result);
                    return result;
                  }
                }
              }
            }
            
            // Fallback to shipper if it's not a logistics company
            if (consolidatedData.shipperName && consolidatedData.countryOfOrigin && 
                consolidatedData.shipperName !== consolidatedData.consolidatorName &&
                !consolidatedData.shipperName.toLowerCase().includes('logistics') &&
                !consolidatedData.shipperName.toLowerCase().includes('freight')) {
              const result = `${consolidatedData.shipperName}\n${consolidatedData.shipperAddress || ''}\nCountry: ${consolidatedData.countryOfOrigin}`.replace(/\n+/g, '\n').trim();
              console.log('✅ Using shipper as manufacturer (non-logistics):', result);
              return result;
            } else if (consolidatedData.manufacturerCountry) {
              const result = `Manufactured in: ${consolidatedData.manufacturerCountry}`;
              console.log('✅ Using manufacturerCountry only:', result);
              return result;
            }
          }
          
          console.log('❌ No manufacturer information found');
          return null;
        })(),
        sellerInformation: (() => {
          console.log('🏪 BUILDING SELLER INFORMATION:');
          console.log('  sellerInformation:', consolidatedData.sellerInformation);
          console.log('  sellerName:', consolidatedData.sellerName);
          console.log('  sellerAddress:', consolidatedData.sellerAddress);
          console.log('  manufacturerName:', consolidatedData.manufacturerName);
          console.log('  manufacturerAddress:', consolidatedData.manufacturerAddress);
          console.log('  shipperName:', consolidatedData.shipperName);
          console.log('  consolidatorName:', consolidatedData.consolidatorName);
          
          // CRITICAL FIX FOR ISF: Prioritize original seller data exactly as extracted - do NOT filter logistics companies
          if (consolidatedData.sellerInformation) {
            console.log('✅ Using direct sellerInformation as extracted from ISF document:', consolidatedData.sellerInformation);
            return consolidatedData.sellerInformation;
          } else if (consolidatedData.sellerName && consolidatedData.sellerAddress) {
            const result = `${consolidatedData.sellerName}\n${consolidatedData.sellerAddress}`;
            console.log('✅ Using sellerName + sellerAddress as extracted:', result);
            return result;
          } else if (consolidatedData.sellerName) {
            console.log('✅ Using sellerName as extracted:', consolidatedData.sellerName);
            return consolidatedData.sellerName;
          } else if (consolidatedData.manufacturerName && consolidatedData.manufacturerAddress) {
            // Only fallback to manufacturer if no seller data was found at all
            const result = `${consolidatedData.manufacturerName}\n${consolidatedData.manufacturerAddress}`;
            console.log('✅ Fallback: Using manufacturerName + manufacturerAddress as seller:', result);
            return result;
          } else if (consolidatedData.manufacturerName) {
            console.log('✅ Fallback: Using manufacturerName only as seller:', consolidatedData.manufacturerName);
            return consolidatedData.manufacturerName;
          }
          
          console.log('❌ No seller or manufacturer information found');
          return null;
        })(),
        buyerInformation: (() => {
          if (consolidatedData.buyerInformation) {
            return consolidatedData.buyerInformation;
          } else if (consolidatedData.buyerName && consolidatedData.buyerAddress) {
            return `${consolidatedData.buyerName}\n${consolidatedData.buyerAddress}`;
          } else if (consolidatedData.buyerName) {
            return consolidatedData.buyerName;
          } else if (consolidatedData.consigneeName && consolidatedData.consigneeAddress) {
            // Use consignee as buyer if no explicit buyer
            return `${consolidatedData.consigneeName}\n${consolidatedData.consigneeAddress}`;
          }
          return null;
        })(),
        shipToPartyInformation: (() => {
          // First priority: Check for extracted ship-to party information that's not placeholder text
          if (consolidatedData.shipToPartyInformation && 
              !/(same\s*as\s*consignee|see\s*above|as\s*above|ditto|to\s*be\s*provided)/i.test(consolidatedData.shipToPartyInformation)) {
            console.log('🎯 Using extracted shipToPartyInformation:', consolidatedData.shipToPartyInformation);
            return consolidatedData.shipToPartyInformation;
          } 
          
          // Second priority: Combine ship-to party name and address if available
          if (consolidatedData.shipToPartyName && consolidatedData.shipToPartyAddress && 
              !/(same\s*as\s*consignee|see\s*above|as\s*above|ditto)/i.test(consolidatedData.shipToPartyName)) {
            const combined = `${consolidatedData.shipToPartyName}\n${consolidatedData.shipToPartyAddress}`;
            console.log('🎯 Using combined shipToPartyName + Address:', combined);
            return combined;
          } 
          
          // Third priority: Just ship-to party name if it's not placeholder text
          if (consolidatedData.shipToPartyName && 
              !/(same\s*as\s*consignee|see\s*above|as\s*above|ditto|to\s*be\s*provided)/i.test(consolidatedData.shipToPartyName)) {
            console.log('🎯 Using shipToPartyName only:', consolidatedData.shipToPartyName);
            return consolidatedData.shipToPartyName;
          }
          
          // Fallback: Use consignee information only if no ship-to party data was found
          if (consolidatedData.consigneeName && consolidatedData.consigneeAddress) {
            console.log('🔄 Fallback to consignee as ship-to party');
            return `${consolidatedData.consigneeName}\n${consolidatedData.consigneeAddress}`;
          }
          
          return null;
        })(),
        
        // Shipping and logistics information - Key ISF fields
        billOfLading: consolidatedData.billOfLading || null,
        vesselName: consolidatedData.vesselName || null,
        voyageNumber: consolidatedData.voyageNumber || null,
        containerNumbers: consolidatedData.containerNumbers || null,
        portOfEntry: consolidatedData.portOfEntry || null,
        foreignPortOfLading: consolidatedData.foreignPortOfLading || null,
        estimatedArrivalDate: consolidatedData.estimatedArrivalDate || null,
        estimatedDepartureDate: consolidatedData.estimatedDepartureDate || null,
        
        // Commodity and customs information
        commodityDescription: consolidatedData.commodityDescription || null,
        htsusNumber: consolidatedData.htsusNumber || null,
        numberOfPackages: consolidatedData.numberOfPackages || null,
        grossWeight: consolidatedData.grossWeight || null,
        volume: consolidatedData.volume || null,
        
        // SCAC and AMS information - Critical for ISF filing with enhanced field mapping
        scacCode: consolidatedData.scacCode || 
                 (consolidatedData.billOfLadingNumber && consolidatedData.billOfLadingNumber.length >= 4 ? 
                   consolidatedData.billOfLadingNumber.substring(0, 4).toUpperCase() : null) || 
                 null,
        mblScacCode: consolidatedData.mblScacCode || 
                    (consolidatedData.billOfLadingNumber && consolidatedData.billOfLadingNumber.length >= 4 ? 
                      consolidatedData.billOfLadingNumber.substring(0, 4).toUpperCase() : null) || 
                    null,
        hblScacCode: consolidatedData.hblScacCode || 
                    (consolidatedData.billOfLadingNumber && consolidatedData.billOfLadingNumber.length >= 4 ? 
                      consolidatedData.billOfLadingNumber.substring(0, 4).toUpperCase() : null) || 
                    null,
        amsNumber: consolidatedData.amsNumber || 
                  consolidatedData.amsNo ||
                  consolidatedData['ams number'] ||
                  consolidatedData['ams no'] ||
                  consolidatedData.amsReference ||
                  consolidatedData.manifestNumber ||
                  consolidatedData['ams b/l#'] || 
                  consolidatedData.amsBl || 
                  consolidatedData['ams bl'] ||
                  null,
        
        // Container stuffing location - Key ISF requirement with enhanced field mapping
        // Priority order: specific ISF field first, then generic variations, avoid using ports as fallback
        containerStuffingLocation: consolidatedData.containerStuffingLocation || 
                                  consolidatedData['container stuffing location'] ||
                                  consolidatedData['stuffing location'] || 
                                  consolidatedData.stuffingLocation ||
                                  consolidatedData.placeOfStuffing ||
                                  consolidatedData['place of stuffing'] ||
                                  consolidatedData.cfsLocation ||
                                  consolidatedData['cfs location'] ||
                                  null, // Remove port fallbacks as they're different from stuffing location
        
        // Consolidator information - ISF requirement (Field #8)
        consolidatorStufferInfo: consolidatedData.consolidatorName ||
                                consolidatedData.consolidatorStufferName ||
                                consolidatedData.consolidatorStufferInfo || 
                                consolidatedData.consolidatorInformation || 
                                consolidatedData.consolidator ||
                                consolidatedData.containerStuffer ||
                                consolidatedData.stufferName ||
                                consolidatedData.cfsOperator ||
                                // DO NOT use container stuffing location - that's a separate ISF field
                                null,
        consolidatorInformation: consolidatedData.consolidatorInformation || null,
        consolidator: consolidatedData.consolidator || null
      };

      console.log('ISF form data mapped from consolidated extraction:', isfFormData);
      
      // CRITICAL FIX: Apply ISF prioritization AFTER form mapping to prevent overwrites
      if (isfDocuments.length > 0) {
        console.log('🎯 FINAL ISF OVERRIDE: Applying ISF document values to final form data...');
        for (const isfDoc of isfDocuments) {
          // Force override critical fields from ISF documents
          if (isfDoc.data.consolidatorStufferInfo) {
            console.log(`🎯 FINAL ISF OVERRIDE: consolidatorStufferInfo: "${isfDoc.data.consolidatorStufferInfo}"`);
            isfFormData.consolidatorStufferInfo = isfDoc.data.consolidatorStufferInfo;
          }
          if (isfDoc.data.containerStuffingLocation) {
            console.log(`🎯 FINAL ISF OVERRIDE: containerStuffingLocation: "${isfDoc.data.containerStuffingLocation}"`);
            isfFormData.containerStuffingLocation = isfDoc.data.containerStuffingLocation;
          }
          
          // Apply seller information directly from ISF document as submitted
          if (isfDoc.data.sellerInformation) {
            console.log(`🎯 FINAL ISF OVERRIDE: sellerInformation: "${isfDoc.data.sellerInformation}"`);
            isfFormData.sellerInformation = isfDoc.data.sellerInformation;
          }
          
          if (isfDoc.data.manufacturerInformation) {
            console.log(`🎯 FINAL ISF OVERRIDE: manufacturerInformation: "${isfDoc.data.manufacturerInformation}"`);
            isfFormData.manufacturerInformation = isfDoc.data.manufacturerInformation;
          }
        }
      }
      
      // Debug the specific problematic fields
      console.log('🎯 FINAL MAPPED ISF FIELD VALUES:');
      console.log('  Final importerName:', isfFormData.importerName);
      console.log('  Final importerAddress:', isfFormData.importerAddress);
      console.log('  Final consigneeName:', isfFormData.consigneeName);
      console.log('  Final consigneeAddress:', isfFormData.consigneeAddress);
      console.log('  Final manufacturerInformation:', isfFormData.manufacturerInformation);
      console.log('  Final sellerInformation:', isfFormData.sellerInformation);
      console.log('  Final buyerInformation:', isfFormData.buyerInformation);
      console.log('  Final shipToPartyInformation:', isfFormData.shipToPartyInformation);
      console.log('  Final containerStuffingLocation:', isfFormData.containerStuffingLocation);
      console.log('  Final consolidatorStufferInfo:', isfFormData.consolidatorStufferInfo);
      console.log('  Final countryOfOrigin:', isfFormData.countryOfOrigin);
      console.log('  Final manufacturerCountry:', isfFormData.manufacturerCountry);

      res.json({
        success: true,
        isfFormData,
        consolidatedData, // Include raw consolidated data for frontend field mapping
        extractionSummary: {
          documentsProcessed: req.files.length,
          fieldsExtracted: Object.keys(isfFormData).filter(key => isfFormData[key]).length,
          message: 'ISF form successfully pre-filled using consolidated document data'
        }
      });

    } catch (error) {
      console.error('Error filling ISF form:', error);
      res.status(500).json({ 
        message: 'Failed to fill ISF form', 
        error: error.message 
      });
    }
  });

  // End of routes - close the function properly
  const httpServer = createServer(app);
  return httpServer;
}
