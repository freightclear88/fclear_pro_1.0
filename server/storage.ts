import {
  users,
  shipments,
  documents,
  ocrProcessingJobs,
  subscriptionPlans,
  paymentTransactions,
  type User,
  type UpsertUser,
  type Shipment,
  type InsertShipment,
  type Document,
  type InsertDocument,
  type OcrProcessingJob,
  type InsertOcrProcessingJob,
  type SubscriptionPlan,
  type InsertSubscriptionPlan,
  type PaymentTransaction,
  type InsertPaymentTransaction,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<UpsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // Shipment operations
  getShipmentsByUserId(userId: string): Promise<Shipment[]>;
  getShipmentById(id: number): Promise<Shipment | undefined>;
  getAllShipments(): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, shipment: Partial<InsertShipment>): Promise<Shipment>;
  
  // Document operations
  getDocumentsByShipmentId(shipmentId: number): Promise<Document[]>;
  getDocumentsByUserId(userId: string): Promise<Document[]>;
  getDocumentById(id: number): Promise<Document | undefined>;
  getAllDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document>;
  
  // OCR processing operations
  createOcrJob(job: InsertOcrProcessingJob): Promise<OcrProcessingJob>;
  updateOcrJob(id: number, job: Partial<InsertOcrProcessingJob>): Promise<OcrProcessingJob>;
  getPendingOcrJobs(): Promise<OcrProcessingJob[]>;
  
  // Subscription and payment operations
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  getSubscriptionPlan(planName: string): Promise<SubscriptionPlan | undefined>;
  createPaymentTransaction(transaction: InsertPaymentTransaction): Promise<PaymentTransaction>;
  getPaymentTransactionsByUserId(userId: string): Promise<PaymentTransaction[]>;
  getPaymentTransactionById(transactionId: string): Promise<PaymentTransaction | undefined>;
  updateUserSubscription(userId: string, subscriptionData: Partial<UpsertUser>): Promise<User>;
  checkUserAccess(userId: string): Promise<{
    hasAccess: boolean;
    isTrialActive: boolean;
    subscriptionStatus: string;
    daysUntilExpiry: number;
    usageLimits: {
      shipments: { current: number; max: number; };
      documents: { current: number; max: number; };
    };
  }>;
  resetUserUsageCounts(userId: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt));
  }

  // Shipment operations
  async getShipmentsByUserId(userId: string): Promise<Shipment[]> {
    return await db
      .select()
      .from(shipments)
      .where(eq(shipments.userId, userId))
      .orderBy(desc(shipments.createdAt));
  }

  async getShipmentById(id: number): Promise<Shipment | undefined> {
    const [shipment] = await db.select().from(shipments).where(eq(shipments.id, id));
    return shipment;
  }

  async createShipment(shipmentData: InsertShipment): Promise<Shipment> {
    const [shipment] = await db
      .insert(shipments)
      .values(shipmentData)
      .returning();
    return shipment;
  }

  async updateShipment(id: number, shipmentData: Partial<InsertShipment>): Promise<Shipment> {
    const [shipment] = await db
      .update(shipments)
      .set({ ...shipmentData, updatedAt: new Date() })
      .where(eq(shipments.id, id))
      .returning();
    return shipment;
  }

  async getAllShipments(): Promise<Shipment[]> {
    return await db
      .select()
      .from(shipments)
      .orderBy(desc(shipments.createdAt));
  }

  // Document operations
  async getDocumentsByShipmentId(shipmentId: number): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.shipmentId, shipmentId))
      .orderBy(desc(documents.uploadedAt));
  }

  async getDocumentsByUserId(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.uploadedAt));
  }

  async getDocumentById(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(documentData)
      .returning();
    return document;
  }

  async updateDocument(id: number, documentData: Partial<InsertDocument>): Promise<Document> {
    const [document] = await db
      .update(documents)
      .set(documentData)
      .where(eq(documents.id, id))
      .returning();
    return document;
  }

  async getAllDocuments(): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .orderBy(desc(documents.uploadedAt));
  }

  // OCR processing operations
  async createOcrJob(jobData: InsertOcrProcessingJob): Promise<OcrProcessingJob> {
    const [job] = await db
      .insert(ocrProcessingJobs)
      .values(jobData)
      .returning();
    return job;
  }

  async updateOcrJob(id: number, jobData: Partial<InsertOcrProcessingJob>): Promise<OcrProcessingJob> {
    const [job] = await db
      .update(ocrProcessingJobs)
      .set({ ...jobData, processedAt: new Date() })
      .where(eq(ocrProcessingJobs.id, id))
      .returning();
    return job;
  }

  async getPendingOcrJobs(): Promise<OcrProcessingJob[]> {
    return await db
      .select()
      .from(ocrProcessingJobs)
      .where(eq(ocrProcessingJobs.status, "pending"))
      .orderBy(desc(ocrProcessingJobs.createdAt));
  }

  // Subscription and payment operations
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    return await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.isActive, true));
  }

  async getSubscriptionPlan(planName: string): Promise<SubscriptionPlan | undefined> {
    const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.planName, planName));
    return plan || undefined;
  }

  async createPaymentTransaction(transactionData: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const [transaction] = await db
      .insert(paymentTransactions)
      .values(transactionData)
      .returning();
    return transaction;
  }

  async getPaymentTransactionsByUserId(userId: string): Promise<PaymentTransaction[]> {
    return await db.select().from(paymentTransactions).where(eq(paymentTransactions.userId, userId));
  }

  async getPaymentTransactionById(transactionId: string): Promise<PaymentTransaction | undefined> {
    const [transaction] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.transactionId, transactionId));
    return transaction || undefined;
  }

  async updateUserSubscription(userId: string, subscriptionData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...subscriptionData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async checkUserAccess(userId: string): Promise<{
    hasAccess: boolean;
    isTrialActive: boolean;
    subscriptionStatus: string;
    daysUntilExpiry: number;
    usageLimits: {
      shipments: { current: number; max: number; };
      documents: { current: number; max: number; };
    };
  }> {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    if (!user) {
      return {
        hasAccess: false,
        isTrialActive: false,
        subscriptionStatus: 'not_found',
        daysUntilExpiry: 0,
        usageLimits: {
          shipments: { current: 0, max: 0 },
          documents: { current: 0, max: 0 }
        }
      };
    }

    const now = new Date();
    const trialEndDate = user.trialEndDate ? new Date(user.trialEndDate) : null;
    const subscriptionEndDate = user.subscriptionEndDate ? new Date(user.subscriptionEndDate) : null;
    
    // Check trial status
    const isTrialActive = user.isTrialActive && trialEndDate && trialEndDate > now;
    
    // Check subscription status
    const hasActiveSubscription = user.subscriptionStatus === 'active' && 
                                 subscriptionEndDate && subscriptionEndDate > now;
    
    // Calculate days until expiry
    let daysUntilExpiry = 0;
    if (isTrialActive && trialEndDate) {
      daysUntilExpiry = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    } else if (hasActiveSubscription && subscriptionEndDate) {
      daysUntilExpiry = Math.ceil((subscriptionEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    }

    // Reset usage counts if needed (monthly reset)
    const resetDate = user.usageResetDate ? new Date(user.usageResetDate) : null;
    if (resetDate && now.getMonth() !== resetDate.getMonth()) {
      await this.resetUserUsageCounts(userId);
      user.currentShipmentCount = 0;
      user.currentDocumentCount = 0;
    }

    return {
      hasAccess: isTrialActive || hasActiveSubscription,
      isTrialActive: isTrialActive || false,
      subscriptionStatus: user.subscriptionStatus || 'inactive',
      daysUntilExpiry,
      usageLimits: {
        shipments: { 
          current: user.currentShipmentCount || 0, 
          max: user.maxShipments || 0 
        },
        documents: { 
          current: user.currentDocumentCount || 0, 
          max: user.maxDocuments || 0 
        }
      }
    };
  }

  async resetUserUsageCounts(userId: string): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        currentShipmentCount: 0,
        currentDocumentCount: 0,
        usageResetDate: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
