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
  maxShipments: integer("max_shipments").default(5), // free: 5, pro: unlimited
  maxDocuments: integer("max_documents").default(20), // free: 20, pro: unlimited  
  maxUsers: integer("max_users").default(1), // free: 1, pro: unlimited
  currentShipmentCount: integer("current_shipment_count").default(0),
  currentDocumentCount: integer("current_document_count").default(0),
  usageResetDate: timestamp("usage_reset_date").defaultNow(), // when monthly counters reset
  
  // Access control flags
  isAdmin: boolean("is_admin").default(false),
  isAgent: boolean("is_agent").default(false),
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
  
  // Location data
  origin: varchar("origin").notNull(),
  originPort: varchar("origin_port"),
  destination: varchar("destination").notNull(),
  destinationPort: varchar("destination_port"),
  
  // Transport information
  transportMode: varchar("transport_mode").notNull().default("ocean"), // air, ocean, trucking, last_mile
  status: varchar("status").notNull().default("pending"),
  vessel: varchar("vessel"),
  voyage: varchar("voyage"),
  
  // Container and documentation
  containerNumber: varchar("container_number"),
  containerNumbers: text("container_numbers").array(), // Multiple containers from XML
  billOfLading: varchar("bill_of_lading"),
  
  // Enhanced timing for XML compatibility
  eta: timestamp("eta"),
  ata: timestamp("ata"),
  etd: timestamp("etd"), // Estimated Time of Departure
  atd: timestamp("atd"), // Actual Time of Departure
  
  // Enhanced party information for XML compatibility
  shipperName: varchar("shipper_name"),
  shipperAddress: text("shipper_address"),
  consigneeName: varchar("consignee_name"),
  consigneeAddress: text("consignee_address"),
  notifyParty: varchar("notify_party"),
  
  // Financial
  freightCharges: decimal("freight_charges", { precision: 12, scale: 2 }),
  destinationCharges: decimal("destination_charges", { precision: 12, scale: 2 }),
  customsBroker: varchar("customs_broker"),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
  currency: varchar("currency").default("USD"),
  
  // Cargo details for XML compatibility
  cargoDescription: text("cargo_description"),
  weight: decimal("weight", { precision: 10, scale: 2 }),
  weightUnit: varchar("weight_unit").default("KG"),
  volume: decimal("volume", { precision: 10, scale: 2 }),
  volumeUnit: varchar("volume_unit").default("CBM"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  shipmentId: integer("shipment_id").references(() => shipments.id, { onDelete: "cascade" }),
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
  
  // 2. Consignee Number(s)
  consigneeNumber: varchar("consignee_number").notNull(),
  consigneeName: varchar("consignee_name").notNull(),
  consigneeAddress: text("consignee_address").notNull(),
  consigneeCity: varchar("consignee_city").notNull(),
  consigneeState: varchar("consignee_state").notNull(),
  consigneeZip: varchar("consignee_zip").notNull(),
  consigneeCountry: varchar("consignee_country").notNull().default("US"),
  
  // 3. Manufacturer (or Supplier) Name and Address
  manufacturerName: varchar("manufacturer_name").notNull(),
  manufacturerAddress: text("manufacturer_address").notNull(),
  manufacturerCity: varchar("manufacturer_city").notNull(),
  manufacturerState: varchar("manufacturer_state"),
  manufacturerCountry: varchar("manufacturer_country").notNull(),
  
  // 4. Ship to Party Name and Address
  shipToPartyName: varchar("ship_to_party_name").notNull(),
  shipToPartyAddress: text("ship_to_party_address").notNull(),
  shipToPartyCity: varchar("ship_to_party_city").notNull(),
  shipToPartyState: varchar("ship_to_party_state").notNull(),
  shipToPartyZip: varchar("ship_to_party_zip").notNull(),
  shipToPartyCountry: varchar("ship_to_party_country").notNull().default("US"),
  
  // 5. Country of Origin
  countryOfOrigin: varchar("country_of_origin").notNull(),
  
  // 6. Commodity HTSUS Number
  htsusNumber: varchar("htsus_number").notNull(), // 6-digit minimum, 10-digit preferred
  commodityDescription: text("commodity_description").notNull(),
  
  // 7. Container Stuffing Location
  containerStuffingLocation: text("container_stuffing_location").notNull(),
  containerStuffingCity: varchar("container_stuffing_city").notNull(),
  containerStuffingCountry: varchar("container_stuffing_country").notNull(),
  
  // 8. Consolidator (Stuffer) Name and Address
  consolidatorName: varchar("consolidator_name"),
  consolidatorAddress: text("consolidator_address"),
  consolidatorCity: varchar("consolidator_city"),
  consolidatorCountry: varchar("consolidator_country"),
  
  // 9. Buyer Name and Address (if other than consignee)
  buyerName: varchar("buyer_name"),
  buyerAddress: text("buyer_address"),
  buyerCity: varchar("buyer_city"),
  buyerState: varchar("buyer_state"),
  buyerZip: varchar("buyer_zip"),
  buyerCountry: varchar("buyer_country"),
  
  // 10. Seller Name and Address (if other than manufacturer)
  sellerName: varchar("seller_name"),
  sellerAddress: text("seller_address"),
  sellerCity: varchar("seller_city"),
  sellerState: varchar("seller_state"),
  sellerCountry: varchar("seller_country"),
  
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
