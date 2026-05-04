import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  password: varchar("password"), // For native authentication
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  phone: varchar("phone"),
  profileImageUrl: varchar("profile_image_url"),
  companyName: varchar("company_name"),
  companyAddress: text("company_address"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  country: varchar("country").default("United States"),
  taxId: varchar("tax_id"), // EIN or SSN
  taxIdType: varchar("tax_id_type"), // "EIN" or "SSN"
  
  // Subscription and billing fields
  subscriptionStatus: varchar("subscription_status").default("trial"), // trial, active, inactive, cancelled, past_due, suspended
  subscriptionId: varchar("subscription_id"), // Authorize.Net subscription ID
  subscriptionStartDate: timestamp("subscription_start_date"),
  subscriptionEndDate: timestamp("subscription_end_date"),
  billingCycle: varchar("billing_cycle").default("monthly"), // monthly, yearly
  subscriptionAmount: decimal("subscription_amount", { precision: 10, scale: 2 }).default("0.00"),
  subscriptionPlan: varchar("subscription_plan").default("free"), // free, pro
  
  // Payment profile for recurring billing
  customerProfileId: varchar("customer_profile_id"), // Authorize.Net customer profile ID
  paymentProfileId: varchar("payment_profile_id"), // Authorize.Net payment profile ID
  
  // Trial and access control
  trialStartDate: timestamp("trial_start_date").defaultNow(),
  trialEndDate: timestamp("trial_end_date").default(sql`CURRENT_TIMESTAMP + INTERVAL '7 days'`), // 7-day trial
  isTrialActive: boolean("is_trial_active").default(true),
  trialExtended: boolean("trial_extended").default(false), // prevent multiple extensions
  lastPaymentDate: timestamp("last_payment_date"),
  nextBillingDate: timestamp("next_billing_date"),
  paymentFailureCount: integer("payment_failure_count").default(0),
  
  // Account limits based on subscription tier
  maxShipments: integer("max_shipments").default(3), // free: 3, pro: unlimited
  maxDocuments: integer("max_documents").default(9), // free: 9, pro: unlimited  
  maxUsers: integer("max_users").default(1), // free: 1, pro: unlimited
  currentShipmentCount: integer("current_shipment_count").default(0),
  currentDocumentCount: integer("current_document_count").default(0),
  usageResetDate: timestamp("usage_reset_date").defaultNow(), // when monthly counters reset
  
  // Access control flags
  isAdmin: boolean("is_admin").default(false),
  isAgent: boolean("is_agent").default(false),
  assignedAgentId: varchar("assigned_agent_id"),
  canAccessAdvancedReports: boolean("can_access_advanced_reports").default(false),
  canAccessAPIIntegration: boolean("can_access_api_integration").default(false),
  canAccessPremiumSupport: boolean("can_access_premium_support").default(false),
  canAccessBulkOperations: boolean("can_access_bulk_operations").default(false),
  
  powerOfAttorneyStatus: varchar("power_of_attorney_status").default("pending"), // pending, uploaded, validated
  powerOfAttorneyDocumentPath: varchar("power_of_attorney_document_path"),
  powerOfAttorneyUploadedAt: timestamp("power_of_attorney_uploaded_at"),
  irsProofStatus: varchar("irs_proof_status").default("pending"), // pending, uploaded, validated
  irsProofDocumentPath: varchar("irs_proof_document_path"),
  irsProofUploadedAt: timestamp("irs_proof_uploaded_at"),
  
  // Account suspension and notifications
  accountSuspended: boolean("account_suspended").default(false),
  suspensionReason: varchar("suspension_reason"),
  lastLoginDate: timestamp("last_login_date"),
  emailNotificationsEnabled: boolean("email_notifications_enabled").default(true),
  smsNotificationsEnabled: boolean("sms_notifications_enabled").default(false),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  shipmentId: varchar("shipment_id").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // XML Integration fields for cross-compatibility
  externalId: varchar("external_id"), // Original XML system ID
  sourceSystem: varchar("source_system"), // maersk, msc, hapag-lloyd, manual, etc.
  referenceNumber: varchar("reference_number"), // External reference from XML
  bookingNumber: varchar("booking_number"), // Common in XML feeds
  xmlData: jsonb("xml_data"), // Store original XML for reference
  xmlHash: varchar("xml_hash"), // Prevent duplicate processing
  lastXmlUpdate: timestamp("last_xml_update"), // Track XML sync status
  xmlVersion: varchar("xml_version"), // Track format version
  
  // Location data - Port and Place Details
  portOfLoading: varchar("port_of_loading"), // Renamed from "origin"
  originPort: varchar("origin_port"),
  placeOfReceipt: varchar("place_of_receipt"),
  
  portOfDischarge: varchar("port_of_discharge"), // Renamed from "destination"
  placeOfDelivery: varchar("place_of_delivery"), // Additional field for final destination
  destinationPort: varchar("destination_port"),
  
  // Transport information
  transportMode: varchar("transport_mode").notNull().default("ocean"), // air, ocean, trucking, last_mile
  status: varchar("status").notNull().default("pending"),
  vesselAndVoyage: varchar("vessel_and_voyage"), // Combined vessel and voyage
  
  // Container and documentation
  containerNumber: varchar("container_number"),
  containerNumbers: text("container_numbers").array(), // Multiple containers from XML
  sealNumbers: text("seal_numbers").array(), // Container seal numbers
  billOfLadingNumber: varchar("bill_of_lading_number"), // Renamed from "bill_of_lading"
  airWaybillNumber: varchar("air_waybill_number"), // AWB number for air shipments
  
  // Additional commercial identifiers
  bookingConfirmationNumber: varchar("booking_confirmation_number"),
  containerType: varchar("container_type"), // 20GP, 40GP, 40HC, etc.
  marksAndNumbers: text("marks_and_numbers"), // Package markings
  
  // Enhanced timing for XML compatibility  
  eta: timestamp("eta"),
  ata: timestamp("ata"),
  etd: timestamp("etd"), // Estimated Time of Departure
  atd: timestamp("atd"), // Actual Time of Departure
  dateOfShipment: timestamp("date_of_shipment"), // Date goods shipped
  onBoardDate: timestamp("on_board_date"), // Date cargo loaded on vessel
  issueDate: timestamp("issue_date"), // Bill of lading issue date
  
  // Enhanced party information - Shipper and Consignee Details
  shipperName: varchar("shipper_name"),
  shipperAddress: text("shipper_address"),
  shipperCity: varchar("shipper_city"),
  shipperState: varchar("shipper_state"),
  shipperZipCode: varchar("shipper_zip_code"),
  shipperCountry: varchar("shipper_country"),
  shipperContactPerson: varchar("shipper_contact_person"),
  shipperPhone: varchar("shipper_phone"),
  shipperEmail: varchar("shipper_email"),
  
  consigneeName: varchar("consignee_name"),
  consigneeAddress: text("consignee_address"),
  consigneeCity: varchar("consignee_city"),
  consigneeState: varchar("consignee_state"),
  consigneeZipCode: varchar("consignee_zip_code"),
  consigneeCountry: varchar("consignee_country"),
  consigneeContactPerson: varchar("consignee_contact_person"),
  consigneePhone: varchar("consignee_phone"),
  consigneeEmail: varchar("consignee_email"),
  
  notifyPartyName: varchar("notify_party_name"), // Renamed from "customs_broker"
  notifyPartyAddress: text("notify_party_address"),
  notifyPartyCity: varchar("notify_party_city"),
  notifyPartyState: varchar("notify_party_state"),
  notifyPartyZipCode: varchar("notify_party_zip_code"),
  notifyPartyCountry: varchar("notify_party_country"),
  notifyPartyContactPerson: varchar("notify_party_contact_person"),
  notifyPartyPhone: varchar("notify_party_phone"),
  notifyPartyEmail: varchar("notify_party_email"),
  
  forwardingAgentName: varchar("forwarding_agent_name"),
  forwardingAgentAddress: text("forwarding_agent_address"),
  forwardingAgentPhone: varchar("forwarding_agent_phone"),
  forwardingAgentEmail: varchar("forwarding_agent_email"),
  
  // Comprehensive commercial and financial details
  freightCharges: decimal("freight_charges", { precision: 12, scale: 2 }),
  freightPaymentTerms: varchar("freight_payment_terms"), // Prepaid, Collect, Third Party
  freightPayableAt: varchar("freight_payable_at"), // Location where freight is payable
  prepaidCollectDesignation: varchar("prepaid_collect_designation"), // PREPAID or COLLECT
  destinationCharges: decimal("destination_charges", { precision: 12, scale: 2 }),
  
  customsBroker: varchar("customs_broker"), // Keep separate from notify party
  customsBrokerLicense: varchar("customs_broker_license"),
  
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
  declaredValue: decimal("declared_value", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("USD"),
  freightCurrency: varchar("freight_currency").default("USD"),
  
  // Trade and regulatory information
  countryOfOrigin: varchar("country_of_origin"),
  countryOfManufacture: varchar("country_of_manufacture"),
  exportLicense: varchar("export_license"),
  importLicense: varchar("import_license"),
  htsCode: varchar("hts_code"), // Harmonized Tariff Schedule code
  scheduleBCode: varchar("schedule_b_code"), // Export commodity classification
  
  // Comprehensive cargo information
  cargoDescription: text("cargo_description"),
  commodity: varchar("commodity"), // General commodity type
  numberOfPackages: integer("number_of_packages"),
  kindOfPackages: varchar("kind_of_packages"), // CTN, PLT, PKG, etc.
  
  // Weight and measurement details
  grossWeight: decimal("gross_weight", { precision: 10, scale: 2 }),
  netWeight: decimal("net_weight", { precision: 10, scale: 2 }),
  weight: decimal("weight", { precision: 10, scale: 2 }), // Backward compatibility
  weightUnit: varchar("weight_unit").default("KG"),
  
  volume: decimal("volume", { precision: 10, scale: 2 }),
  volumeUnit: varchar("volume_unit").default("CBM"),
  measurement: varchar("measurement"), // Dimensions if needed
  
  // Hazardous material information
  isHazardous: boolean("is_hazardous").default(false),
  hazardClass: varchar("hazard_class"), // UN hazard class
  unNumber: varchar("un_number"), // UN identification number
  properShippingName: varchar("proper_shipping_name"),
  packingGroup: varchar("packing_group"),
  emergencyContact: varchar("emergency_contact"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").references(() => shipments.id, { onDelete: "cascade" }),
  isfFilingId: integer("isf_filing_id").references(() => isfFilings.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  fileName: varchar("file_name").notNull(),
  originalName: varchar("original_name").notNull(),
  fileType: varchar("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  category: varchar("category").notNull(), // bill_of_lading, commercial_invoice, packing_list, certificate_of_origin, delivery_order, etc.
  subCategory: varchar("sub_category"), // last_mile, customs_clearance, port_delivery, etc.
  status: varchar("status").notNull().default("pending"),
  extractedData: jsonb("extracted_data"),
  filePath: varchar("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  
  // Invoice-specific fields
  invoiceNumber: varchar("invoice_number"),
  invoiceAmount: decimal("invoice_amount", { precision: 12, scale: 2 }),
  dueDate: timestamp("due_date"),
  invoiceStatus: varchar("invoice_status").default("sent"), // sent, viewed, paid, overdue
  sentToUserId: varchar("sent_to_user_id").references(() => users.id), // for admin-generated invoices
  sentByUserId: varchar("sent_by_user_id").references(() => users.id), // admin who sent the invoice
  emailSentAt: timestamp("email_sent_at"),
  viewedAt: timestamp("viewed_at"),
  paidAt: timestamp("paid_at"),
  paymentTransactionId: varchar("payment_transaction_id").references(() => paymentTransactions.transactionId),

  // Standalone document fields (documents not tied to a shipment)
  isStandalone: boolean("is_standalone").default(false),
  documentLabel: varchar("document_label"), // user-provided label/description
  documentCategory: varchar("document_category"), // customs_compliance, templates, regulatory, company_docs, isf_related, other
});

// Subscription plans table
export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  planName: varchar("plan_name").notNull().unique(), // trial, basic, professional, enterprise
  displayName: varchar("display_name").notNull(),
  description: text("description"),
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull(),
  yearlyPrice: decimal("yearly_price", { precision: 10, scale: 2 }),
  maxShipments: integer("max_shipments").notNull(),
  maxDocuments: integer("max_documents").notNull(),
  maxUsers: integer("max_users").notNull(),
  features: jsonb("features").notNull(), // array of feature flags
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment transactions table
export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  transactionId: varchar("transaction_id").notNull().unique(), // Authorize.Net transaction ID
  subscriptionId: varchar("subscription_id"), // Authorize.Net subscription ID
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull(), // success, failed, pending, refunded
  paymentMethod: varchar("payment_method").notNull(), // credit_card, bank_account
  authCode: varchar("auth_code"),
  responseCode: varchar("response_code"),
  description: text("description"),
  billingCycle: varchar("billing_cycle"), // monthly, yearly, one_time
  errorMessage: text("error_message"),
  rawResponse: jsonb("raw_response"), // store full Authorize.Net response
  createdAt: timestamp("created_at").defaultNow(),
});

export const ocrProcessingJobs = pgTable("ocr_processing_jobs", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id, { onDelete: "cascade" }),
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  extractedText: text("extracted_text"),
  extractedData: jsonb("extracted_data"),
  errorMessage: text("error_message"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat conversations table
export const chatConversations = pgTable("chat_conversations", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull().default("New Conversation"),
  status: varchar("status").notNull().default("active"), // active, archived, closed
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  assignedAdminId: varchar("assigned_admin_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat messages table
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderType: varchar("sender_type").notNull(), // user, admin, ai
  content: text("content").notNull(),
  messageType: varchar("message_type").notNull().default("text"), // text, system, file_attachment
  metadata: jsonb("metadata"), // for AI responses, file attachments, etc.
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Training Data for Chat Agent
export const aiTrainingData = pgTable("ai_training_data", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  keywords: text("keywords").array(), // Keywords to match against user messages
  category: varchar("category", { length: 100 }), // e.g., "shipping", "customs", "payments"
  priority: integer("priority").default(1), // Higher numbers = higher priority
  isActive: boolean("is_active").default(true),
  createdBy: varchar("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User invitations table
export const userInvitations = pgTable("user_invitations", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  firstName: varchar("first_name").notNull(),
  lastName: varchar("last_name").notNull(),
  invitedBy: varchar("invited_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  inviteToken: varchar("invite_token").notNull().unique(),
  status: varchar("status").default("pending"), // pending, accepted, expired
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

// Notifications table for in-app alerts and updates
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title").notNull(),
  message: text("message").notNull(),
  type: varchar("type").notNull(), // shipment_update, document_processed, payment_due, subscription_expired, system_alert
  category: varchar("category").notNull().default("general"), // shipment, document, payment, subscription, system
  priority: varchar("priority").notNull().default("normal"), // low, normal, high, urgent
  relatedEntityType: varchar("related_entity_type"), // shipment, document, payment, subscription
  relatedEntityId: varchar("related_entity_id"), // ID of related entity
  actionUrl: varchar("action_url"), // Optional URL for action button
  actionText: varchar("action_text"), // Text for action button
  isRead: boolean("is_read").default(false),
  isArchived: boolean("is_archived").default(false),
  expiresAt: timestamp("expires_at"), // Optional expiration for time-sensitive notifications
  metadata: jsonb("metadata"), // Additional data for complex notifications
  createdAt: timestamp("created_at").defaultNow(),
  readAt: timestamp("read_at"),
});

// ISF 10+2 Filing table - all mandatory fields for customs import filing
export const isfFilings = pgTable("isf_filings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // ISF Filing Basic Information
  isfNumber: varchar("isf_number").notNull().unique(), // Auto-generated ISF reference number
  status: varchar("status").notNull().default("draft"), // draft, submitted, paid, processed, completed, rejected
  filingDate: timestamp("filing_date"),
  
  // 10+2 Required Data Elements
  
  // 1. Importer of Record Number/FTZ Applicant Identification Number
  importerOfRecord: varchar("importer_of_record").notNull(),
  importerName: varchar("importer_name").notNull(),
  importerAddress: text("importer_address").notNull(),
  importerCity: varchar("importer_city").notNull(),
  importerState: varchar("importer_state").notNull(),
  importerZip: varchar("importer_zip").notNull(),
  importerCountry: varchar("importer_country").notNull().default("US"),
  
  // 2. Consignee Information
  consignee: text("consignee").notNull(),
  consigneeName: varchar("consignee_name").notNull(),
  consigneeAddress: text("consignee_address").notNull(),
  consigneeCity: varchar("consignee_city").notNull(),
  consigneeState: varchar("consignee_state").notNull(),
  consigneeZip: varchar("consignee_zip").notNull(),
  consigneeCountry: varchar("consignee_country").notNull().default("US"),
  
  // 3. Manufacturer (or Supplier) Information
  manufacturerInformation: text("manufacturer_information").notNull(),
  
  // 4. Ship to Party Information
  shipToPartyInformation: text("ship_to_party_information").notNull(),
  
  // 5. Country of Origin
  countryOfOrigin: varchar("country_of_origin").notNull(),
  
  // 6. Commodity HTSUS Number
  htsusNumber: varchar("htsus_number").notNull(), // 6-digit minimum, 10-digit preferred
  commodityDescription: text("commodity_description").notNull(),
  
  // 7. Container Stuffing Location
  containerStuffingLocation: text("container_stuffing_location").notNull(), // Multi-line text field for container stuffing location information
  
  // 8. Consolidator
  consolidatorStufferInfo: text("consolidator_stuffer_info").notNull(), // Multi-line text field for consolidator information
  
  // 9. Buyer Information (if other than consignee)
  buyerInformation: text("buyer_information"),
  
  // 10. Seller Information (if other than manufacturer)
  sellerInformation: text("seller_information"),
  
  // +2 Additional Data Elements
  
  // +1. Booking Party Name and Address
  bookingPartyName: varchar("booking_party_name").notNull(),
  bookingPartyAddress: text("booking_party_address").notNull(),
  bookingPartyCity: varchar("booking_party_city").notNull(),
  bookingPartyCountry: varchar("booking_party_country").notNull(),
  
  // +2. Foreign Port of Unlading (same as foreign port of lading for most cases)
  foreignPortOfUnlading: varchar("foreign_port_of_unlading"),
  
  // Shipment Details
  billOfLading: varchar("bill_of_lading"),
  mblScacCode: varchar("mbl_scac_code"), // MBL SCAC Code
  hblScacCode: varchar("hbl_scac_code"), // HBL SCAC Code
  amsNumber: varchar("ams_number"), // Automated Manifest System number
  containerNumbers: text("container_numbers"), // JSON array of container numbers
  vesselName: varchar("vessel_name"),
  voyageNumber: varchar("voyage_number"),
  estimatedArrivalDate: timestamp("estimated_arrival_date"),
  portOfEntry: varchar("port_of_entry").notNull(),
  
  // Commercial Information
  invoiceNumber: varchar("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  invoiceValue: decimal("invoice_value", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("USD"),
  terms: varchar("terms"), // FOB, CIF, etc.
  
  // Document Management
  uploadedDocumentId: integer("uploaded_document_id").references(() => documents.id),
  extractedData: jsonb("extracted_data"), // Data extracted from PDF scanning
  xmlData: text("xml_data"), // ISF data stored as XML
  
  // Payment Information
  paymentRequired: boolean("payment_required").default(true),
  paymentAmount: decimal("payment_amount", { precision: 10, scale: 2 }).default("35.00"),
  paymentStatus: varchar("payment_status").default("pending"), // pending, processing, completed, failed
  paymentTransactionId: varchar("payment_transaction_id"),
  paidAt: timestamp("paid_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  submittedAt: timestamp("submitted_at"),
});

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertShipment = typeof shipments.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;

export type InsertDocument = typeof documents.$inferInsert;
export type Document = typeof documents.$inferSelect;

export type InsertOcrProcessingJob = typeof ocrProcessingJobs.$inferInsert;
export type OcrProcessingJob = typeof ocrProcessingJobs.$inferSelect;

export type InsertChatConversation = typeof chatConversations.$inferInsert;
export type ChatConversation = typeof chatConversations.$inferSelect;

export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;

export type InsertSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;

export type InsertPaymentTransaction = typeof paymentTransactions.$inferInsert;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;

export type InsertAiTrainingData = typeof aiTrainingData.$inferInsert;
export type AiTrainingData = typeof aiTrainingData.$inferSelect;

export type InsertUserInvitation = typeof userInvitations.$inferInsert;
export type UserInvitation = typeof userInvitations.$inferSelect;

export type InsertIsfFiling = typeof isfFilings.$inferInsert;
export type IsfFiling = typeof isfFilings.$inferSelect;

// Agent assignments table for tracking agent-user relationships
export const agentAssignments = pgTable("agent_assignments", {
  id: serial("id").primaryKey(),
  agentId: varchar("agent_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  assignedAt: timestamp("assigned_at").defaultNow(),
  assignedBy: varchar("assigned_by").notNull(), // admin who made the assignment
  isActive: boolean("is_active").default(true),
  notes: text("notes"), // optional notes about the assignment
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type InsertAgentAssignment = typeof agentAssignments.$inferInsert;
export type AgentAssignment = typeof agentAssignments.$inferSelect;

// Insert schemas
export const insertShipmentSchema = createInsertSchema(shipments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
});

export const insertOcrProcessingJobSchema = createInsertSchema(ocrProcessingJobs).omit({
  id: true,
  createdAt: true,
  processedAt: true,
});

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertAiTrainingDataSchema = createInsertSchema(aiTrainingData).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserInvitationSchema = createInsertSchema(userInvitations).omit({
  id: true,
  createdAt: true,
  acceptedAt: true,
});

export const insertIsfFilingSchema = createInsertSchema(isfFilings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
  filingDate: true,
  paidAt: true,
});

export const insertAgentAssignmentSchema = createInsertSchema(agentAssignments).omit({
  id: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
});

// Enhanced XML-based shipment tables for comprehensive data structure
// Based on the IES-Shipment XML schema provided

// Enhanced shipments table for XML compatibility
export const xmlShipments = pgTable("xml_shipments", {
  id: serial("id").primaryKey(),
  shipmentId: varchar("shipment_id").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // XML Transaction details
  transactionId: varchar("transaction_id").notNull().unique(),
  transactionDateTime: timestamp("transaction_date_time").notNull(),
  transactionSetPurpose: varchar("transaction_set_purpose").default("Add"), // Add, Update, Delete
  shipmentType: varchar("shipment_type").default("Master"), // Master, House
  documentDate: timestamp("document_date"),
  fileNumber: varchar("file_number"),
  
  // Bill of Lading information
  masterBillNumber: varchar("master_bill_number"),
  houseBillNumber: varchar("house_bill_number"),
  subHouseBillNumber: varchar("sub_house_bill_number"),
  itNumber: varchar("it_number"), // Internal Transfer number
  bookingNumber: varchar("booking_number"),
  originReference: varchar("origin_reference"),
  
  // Operational details
  division: varchar("division"),
  paymentMethod: varchar("payment_method"), // Collect, Prepaid
  transportationMethod: varchar("transportation_method"), // Air, Ocean, Ground
  typeOfMove: varchar("type_of_move"),
  
  // Vessel and timing information
  vesselName: varchar("vessel_name"),
  voyageFlightNumber: varchar("voyage_flight_number"),
  departureDateTime: timestamp("departure_date_time"),
  arrivalDateTime: timestamp("arrival_date_time"),
  importDate: timestamp("import_date"),
  firmsCode: varchar("firms_code"), // FIRMS code for port authority
  
  // General cargo information
  marksNumbers: text("marks_numbers"), // Package markings and numbers
  
  // Status and processing
  status: varchar("status").notNull().default("pending"),
  processingStatus: varchar("processing_status").default("received"), // received, processed, completed, error
  
  // Raw XML storage
  xmlData: jsonb("xml_data"), // Store complete original XML
  xmlVersion: varchar("xml_version").default("1.0"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shipment parties table for multiple party types
export const shipmentParties = pgTable("shipment_parties", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => xmlShipments.id, { onDelete: "cascade" }),
  
  // Party identification
  partyType: varchar("party_type").notNull(), // Account, Shipper, Consignee, NotifyParty, Broker, etc.
  partyCode: varchar("party_code"),
  
  // Party details
  name: varchar("name").notNull(),
  address1: varchar("address1"),
  address2: varchar("address2"),
  cityName: varchar("city_name"),
  stateOrProvinceCode: varchar("state_or_province_code"),
  postalCode: varchar("postal_code"),
  countryCode: varchar("country_code"),
  
  // Identification information
  idCode: varchar("id_code"), // Tax ID, DUNS number, etc.
  idCodeQualifier: varchar("id_code_qualifier"), // EIN, DUNS, etc.
  
  // Contact information
  contactPerson: varchar("contact_person"),
  phone: varchar("phone"),
  email: varchar("email"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Shipment locations table for various location types
export const shipmentLocations = pgTable("shipment_locations", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => xmlShipments.id, { onDelete: "cascade" }),
  
  // Location identification
  locationType: varchar("location_type").notNull(), // PlaceOfReceipt, PortOfLoading, PortOfDischarge, PlaceOfDelivery, etc.
  locationIdQualifier: varchar("location_id_qualifier"), // UN/LOCODE, Port Code, etc.
  locationId: varchar("location_id"),
  locationName: varchar("location_name"),
  
  // Geographic details
  stateOrProvinceCode: varchar("state_or_province_code"),
  countryCode: varchar("country_code"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Container information table
export const shipmentContainers = pgTable("shipment_containers", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => xmlShipments.id, { onDelete: "cascade" }),
  
  // Container identification
  equipmentInitial: varchar("equipment_initial"), // Container prefix (4 letters)
  equipmentNumber: varchar("equipment_number"), // Container number
  fullContainerNumber: varchar("full_container_number"), // Combined container number
  
  // Seal information
  sealNumber1: varchar("seal_number1"),
  sealNumber2: varchar("seal_number2"),
  sealNumber3: varchar("seal_number3"),
  
  // Container specifications
  equipmentTypeCode: varchar("equipment_type_code"), // ISO container type code (e.g., 22B0)
  containerSize: varchar("container_size"), // 20', 40', 45'
  containerType: varchar("container_type"), // GP, HC, RF, etc.
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Container contents table for cargo details
export const containerContents = pgTable("container_contents", {
  id: serial("id").primaryKey(),
  containerId: integer("container_id").references(() => shipmentContainers.id, { onDelete: "cascade" }),
  shipmentId: integer("shipment_id").notNull().references(() => xmlShipments.id, { onDelete: "cascade" }),
  
  // Quantity and packaging
  quantityShipped: decimal("quantity_shipped", { precision: 15, scale: 6 }),
  unitOfMeasure: varchar("unit_of_measure"), // PCS, CTN, PLT, etc.
  description: text("description"), // Cargo description
  
  // Weight information
  grossWeight: decimal("gross_weight", { precision: 12, scale: 3 }),
  netWeight: decimal("net_weight", { precision: 12, scale: 3 }),
  weightUnit: varchar("weight_unit").default("KG"),
  volumeWeight: decimal("volume_weight", { precision: 15, scale: 6 }),
  
  // Volume information
  volume: decimal("volume", { precision: 12, scale: 3 }),
  volumeUnit: varchar("volume_unit").default("CBM"),
  
  // Trade classification
  scheduleBNumber: varchar("schedule_b_number"), // Export classification
  htsNumber: varchar("hts_number"), // Import classification
  
  // Commercial value
  value: decimal("value", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("USD"),
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Shipment charges table for freight and other charges
export const shipmentCharges = pgTable("shipment_charges", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").notNull().references(() => xmlShipments.id, { onDelete: "cascade" }),
  
  // Charge identification
  chargeType: varchar("charge_type").notNull(), // Expense, Revenue, Freight, etc.
  chargeStatus: varchar("charge_status"), // Estimated, Actual, etc.
  chargeCode: varchar("charge_code"), // Internal charge code
  description: varchar("description"), // Charge description
  
  // Charge calculation
  basis: varchar("basis"), // Per container, per shipment, per weight, etc.
  quantityInvoiced: decimal("quantity_invoiced", { precision: 15, scale: 6 }),
  chargeUnit: varchar("charge_unit"), // Container, KG, CBM, etc.
  rate: decimal("rate", { precision: 15, scale: 6 }),
  
  // Charge amount
  chargeAmount: decimal("charge_amount", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("USD"),
  paymentMethod: varchar("payment_method"), // Collect, Prepaid
  
  createdAt: timestamp("created_at").defaultNow(),
});

// Type definitions for XML tables
export type InsertXmlShipment = typeof xmlShipments.$inferInsert;
export type XmlShipment = typeof xmlShipments.$inferSelect;

export type InsertShipmentParty = typeof shipmentParties.$inferInsert;
export type ShipmentParty = typeof shipmentParties.$inferSelect;

export type InsertShipmentLocation = typeof shipmentLocations.$inferInsert;
export type ShipmentLocation = typeof shipmentLocations.$inferSelect;

export type InsertShipmentContainer = typeof shipmentContainers.$inferInsert;
export type ShipmentContainer = typeof shipmentContainers.$inferSelect;

export type InsertContainerContent = typeof containerContents.$inferInsert;
export type ContainerContent = typeof containerContents.$inferSelect;

export type InsertShipmentCharge = typeof shipmentCharges.$inferInsert;
export type ShipmentCharge = typeof shipmentCharges.$inferSelect;

// Insert schemas for XML tables
export const insertXmlShipmentSchema = createInsertSchema(xmlShipments).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShipmentPartySchema = createInsertSchema(shipmentParties).omit({
  id: true,
  createdAt: true,
});

export const insertShipmentLocationSchema = createInsertSchema(shipmentLocations).omit({
  id: true,
  createdAt: true,
});

export const insertShipmentContainerSchema = createInsertSchema(shipmentContainers).omit({
  id: true,
  createdAt: true,
});

export const insertContainerContentSchema = createInsertSchema(containerContents).omit({
  id: true,
  createdAt: true,
});

export const insertShipmentChargeSchema = createInsertSchema(shipmentCharges).omit({
  id: true,
  createdAt: true,
});

// Relations for XML tables to enable proper querying
import { relations } from "drizzle-orm";

export const xmlShipmentsRelations = relations(xmlShipments, ({ one, many }) => ({
  user: one(users, {
    fields: [xmlShipments.userId],
    references: [users.id],
  }),
  parties: many(shipmentParties),
  locations: many(shipmentLocations),
  containers: many(shipmentContainers),
  contents: many(containerContents),
  charges: many(shipmentCharges),
}));

export const shipmentPartiesRelations = relations(shipmentParties, ({ one }) => ({
  shipment: one(xmlShipments, {
    fields: [shipmentParties.shipmentId],
    references: [xmlShipments.id],
  }),
}));

export const shipmentLocationsRelations = relations(shipmentLocations, ({ one }) => ({
  shipment: one(xmlShipments, {
    fields: [shipmentLocations.shipmentId],
    references: [xmlShipments.id],
  }),
}));

export const shipmentContainersRelations = relations(shipmentContainers, ({ one, many }) => ({
  shipment: one(xmlShipments, {
    fields: [shipmentContainers.shipmentId],
    references: [xmlShipments.id],
  }),
  contents: many(containerContents),
}));

export const containerContentsRelations = relations(containerContents, ({ one }) => ({
  container: one(shipmentContainers, {
    fields: [containerContents.containerId],
    references: [shipmentContainers.id],
  }),
  shipment: one(xmlShipments, {
    fields: [containerContents.shipmentId],
    references: [xmlShipments.id],
  }),
}));

export const shipmentChargesRelations = relations(shipmentCharges, ({ one }) => ({
  shipment: one(xmlShipments, {
    fields: [shipmentCharges.shipmentId],
    references: [xmlShipments.id],
  }),
}));

// XML Sources for scheduled retrieval
export const xmlSources = pgTable('xml_sources', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  url: text('url').notNull(),
  authType: varchar('auth_type', { length: 20 }).notNull().default('none'), // none, basic, bearer, apikey
  authConfig: jsonb('auth_config'), // Store authentication details
  schedule: varchar('schedule', { length: 100 }).notNull(), // Cron expression
  isActive: boolean('is_active').default(true),
  lastRetrieved: timestamp('last_retrieved'),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// XML Scheduled Job Logs
export const xmlScheduledJobs = pgTable('xml_scheduled_jobs', {
  id: serial('id').primaryKey(),
  sourceId: integer('source_id').notNull().references(() => xmlSources.id, { onDelete: 'cascade' }),
  executedAt: timestamp('executed_at').notNull(),
  success: boolean('success').notNull(),
  message: text('message'),
  details: jsonb('details'), // Store processing details
  createdAt: timestamp('created_at').defaultNow(),
});

// Types for XML Sources
export type XmlSource = typeof xmlSources.$inferSelect;
export type InsertXmlSource = typeof xmlSources.$inferInsert;
export type XmlScheduledJob = typeof xmlScheduledJobs.$inferSelect;
export type InsertXmlScheduledJob = typeof xmlScheduledJobs.$inferInsert;

// Relations for XML Sources
export const xmlSourcesRelations = relations(xmlSources, ({ one, many }) => ({
  user: one(users, {
    fields: [xmlSources.userId],
    references: [users.id],
  }),
  jobs: many(xmlScheduledJobs),
}));

export const xmlScheduledJobsRelations = relations(xmlScheduledJobs, ({ one }) => ({
  source: one(xmlSources, {
    fields: [xmlScheduledJobs.sourceId],
    references: [xmlSources.id],
  }),
}));

// Types for Notifications
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

// Relations for notifications
export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));


// ─── AI Support Knowledge Base ────────────────────────────────────────────────
export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  category: varchar("category", { length: 64 }).notNull().default("general"),
  content: text("content").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type KnowledgeBaseEntry = typeof knowledgeBase.$inferSelect;
export type InsertKnowledgeBaseEntry = typeof knowledgeBase.$inferInsert;
