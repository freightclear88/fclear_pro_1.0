import { pgTable, text, serial, integer, boolean, timestamp, real, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  phone: text("phone"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const paymentTransactions = pgTable("payment_transactions", {
  id: serial("id").primaryKey(),
  
  userId: integer("user_id").references(() => users.id),
  
  transactionId: text("transaction_id").notNull(),
  authCode: text("auth_code"),
  responseCode: text("response_code"),
  
  invoiceNumber: text("invoice_number"),
  description: text("description"),
  
  amount: real("amount").notNull(),
  serviceFee: real("service_fee").default(0),
  totalAmount: real("total_amount").notNull(),
  serviceFeeRate: real("service_fee_rate").default(0.035),
  
  cardType: text("card_type"),
  cardLastFour: text("card_last_four"),
  cardholderName: text("cardholder_name"),
  
  billingFirstName: text("billing_first_name"),
  billingLastName: text("billing_last_name"),
  billingCompany: text("billing_company"),
  billingAddress: text("billing_address"),
  billingCity: text("billing_city"),
  billingState: text("billing_state"),
  billingZip: text("billing_zip"),
  billingCountry: text("billing_country"),
  billingPhone: text("billing_phone"),
  billingEmail: text("billing_email"),
  
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  
  environment: text("environment").default("production"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentConfig = pgTable("payment_config", {
  id: serial("id").primaryKey(),
  serviceFeeRate: real("service_fee_rate").default(0.035),
  environment: text("environment").default("production"),
  companyName: text("company_name").default("FreightClear Payments"),
  accountingEmail: text("accounting_email"),
  accountingPhone: text("accounting_phone"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true, updatedAt: true });

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
