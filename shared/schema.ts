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
  profileImageUrl: varchar("profile_image_url"),
  companyName: varchar("company_name"),
  address: text("address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  country: varchar("country").default("United States"),
  taxId: varchar("tax_id"), // EIN or SSN
  taxIdType: varchar("tax_id_type"), // "EIN" or "SSN"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const shipments = pgTable("shipments", {
  id: serial("id").primaryKey(),
  shipmentId: varchar("shipment_id").notNull().unique(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Core shipment identification
  billOfLading: varchar("bill_of_lading"),
  masterBillOfLading: varchar("master_bill_of_lading"),
  
  // Transport details
  transportMode: varchar("transport_mode").notNull().default("ocean"), // air, ocean, trucking
  vessel: varchar("vessel"),
  voyage: varchar("voyage"),
  containerNumber: varchar("container_number"),
  sealNumber: varchar("seal_number"),
  
  // Locations and ports
  origin: varchar("origin").notNull(),
  originPort: varchar("origin_port"),
  destination: varchar("destination").notNull(),
  destinationPort: varchar("destination_port"),
  placeOfDelivery: varchar("place_of_delivery"),
  
  // Dates and timing
  eta: timestamp("eta"),
  ata: timestamp("ata"),
  etd: timestamp("etd"),
  atd: timestamp("atd"),
  
  // Cargo information
  cargoDescription: text("cargo_description"),
  packageType: varchar("package_type"),
  numberOfPackages: integer("number_of_packages"),
  grossWeight: varchar("gross_weight"),
  netWeight: varchar("net_weight"),
  measurements: varchar("measurements"),
  marksAndNumbers: text("marks_and_numbers"),
  
  // Party information
  shipperName: varchar("shipper_name"),
  shipperAddress: text("shipper_address"),
  consigneeName: varchar("consignee_name"),
  consigneeAddress: text("consignee_address"),
  notifyParty: varchar("notify_party"),
  notifyPartyAddress: text("notify_party_address"),
  destinationAgent: varchar("destination_agent"),
  destinationAgentContact: text("destination_agent_contact"),
  
  // Financial information
  freightCharges: decimal("freight_charges", { precision: 12, scale: 2 }),
  freightTerms: varchar("freight_terms"), // prepaid, collect
  destinationCharges: decimal("destination_charges", { precision: 12, scale: 2 }),
  storageCharges: decimal("storage_charges", { precision: 12, scale: 2 }),
  totalValue: decimal("total_value", { precision: 12, scale: 2 }),
  
  // Customs and compliance
  customsBroker: varchar("customs_broker"),
  customsBrokerContact: text("customs_broker_contact"),
  requiredDocuments: text("required_documents"),
  specialInstructions: text("special_instructions"),
  
  // System fields
  status: varchar("status").notNull().default("pending"),
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
  category: varchar("category").notNull(),
  status: varchar("status").notNull().default("pending"),
  extractedData: jsonb("extracted_data"),
  filePath: varchar("file_path").notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
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

// Schema types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertShipment = typeof shipments.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;

export type InsertDocument = typeof documents.$inferInsert;
export type Document = typeof documents.$inferSelect;

export type InsertOcrProcessingJob = typeof ocrProcessingJobs.$inferInsert;
export type OcrProcessingJob = typeof ocrProcessingJobs.$inferSelect;

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
