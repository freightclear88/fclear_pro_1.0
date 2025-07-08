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
  powerOfAttorneyStatus: varchar("power_of_attorney_status").default("pending"), // pending, uploaded, validated
  powerOfAttorneyDocumentPath: varchar("power_of_attorney_document_path"),
  powerOfAttorneyUploadedAt: timestamp("power_of_attorney_uploaded_at"),
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
  transportMode: varchar("transport_mode").notNull().default("ocean"), // air, ocean, trucking
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
