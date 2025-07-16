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
  origin: varchar("origin").notNull(),
  originPort: varchar("origin_port"),
  destination: varchar("destination").notNull(),
  destinationPort: varchar("destination_port"),
  transportMode: varchar("transport_mode").notNull().default("ocean"), // air, ocean, trucking, last_mile
  status: varchar("status").notNull().default("pending"),
  vessel: varchar("vessel"),
  voyage: varchar("voyage"),
  containerNumber: varchar("container_number"),
  billOfLading: varchar("bill_of_lading"),
  eta: timestamp("eta"),
  ata: timestamp("ata"),
  shipperName: varchar("shipper_name"),
  consigneeName: varchar("consignee_name"),
  freightCharges: decimal("freight_charges", { precision: 12, scale: 2 }),
  destinationCharges: decimal("destination_charges", { precision: 12, scale: 2 }),
  customsBroker: varchar("customs_broker"),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
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
