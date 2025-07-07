import {
  users,
  shipments,
  documents,
  ocrProcessingJobs,
  type User,
  type UpsertUser,
  type Shipment,
  type InsertShipment,
  type Document,
  type InsertDocument,
  type OcrProcessingJob,
  type InsertOcrProcessingJob,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
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
  getAllDocuments(): Promise<Document[]>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: number, document: Partial<InsertDocument>): Promise<Document>;
  
  // OCR processing operations
  createOcrJob(job: InsertOcrProcessingJob): Promise<OcrProcessingJob>;
  updateOcrJob(id: number, job: Partial<InsertOcrProcessingJob>): Promise<OcrProcessingJob>;
  getPendingOcrJobs(): Promise<OcrProcessingJob[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
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
}

export const storage = new DatabaseStorage();
