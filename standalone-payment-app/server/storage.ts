import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc } from "drizzle-orm";
import * as schema from "../shared/schema";
import bcrypt from "bcrypt";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

export interface IStorage {
  getUser(id: number): Promise<schema.User | undefined>;
  getUserByEmail(email: string): Promise<schema.User | undefined>;
  createUser(user: schema.InsertUser): Promise<schema.User>;
  updateUser(id: number, updates: Partial<schema.User>): Promise<schema.User | undefined>;
  
  createTransaction(transaction: schema.InsertTransaction): Promise<schema.PaymentTransaction>;
  getTransactionById(id: number): Promise<schema.PaymentTransaction | undefined>;
  getTransactionByTransactionId(transactionId: string): Promise<schema.PaymentTransaction | undefined>;
  getTransactionsByUserId(userId: number, limit?: number, offset?: number): Promise<schema.PaymentTransaction[]>;
  getAllTransactions(limit?: number, offset?: number): Promise<schema.PaymentTransaction[]>;
  updateTransaction(id: number, updates: Partial<schema.PaymentTransaction>): Promise<schema.PaymentTransaction | undefined>;
}

class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase()));
    return user;
  }

  async createUser(user: schema.InsertUser): Promise<schema.User> {
    const hashedPassword = await bcrypt.hash(user.password, 10);
    const [newUser] = await db.insert(schema.users).values({
      ...user,
      email: user.email.toLowerCase(),
      password: hashedPassword,
    }).returning();
    return newUser;
  }

  async updateUser(id: number, updates: Partial<schema.User>): Promise<schema.User | undefined> {
    const [updated] = await db.update(schema.users).set(updates).where(eq(schema.users.id, id)).returning();
    return updated;
  }

  async createTransaction(transaction: schema.InsertTransaction): Promise<schema.PaymentTransaction> {
    const [newTransaction] = await db.insert(schema.paymentTransactions).values(transaction).returning();
    return newTransaction;
  }

  async getTransactionById(id: number): Promise<schema.PaymentTransaction | undefined> {
    const [transaction] = await db.select().from(schema.paymentTransactions).where(eq(schema.paymentTransactions.id, id));
    return transaction;
  }

  async getTransactionByTransactionId(transactionId: string): Promise<schema.PaymentTransaction | undefined> {
    const [transaction] = await db.select().from(schema.paymentTransactions).where(eq(schema.paymentTransactions.transactionId, transactionId));
    return transaction;
  }

  async getTransactionsByUserId(userId: number, limit = 50, offset = 0): Promise<schema.PaymentTransaction[]> {
    return db.select().from(schema.paymentTransactions)
      .where(eq(schema.paymentTransactions.userId, userId))
      .orderBy(desc(schema.paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getAllTransactions(limit = 50, offset = 0): Promise<schema.PaymentTransaction[]> {
    return db.select().from(schema.paymentTransactions)
      .orderBy(desc(schema.paymentTransactions.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async updateTransaction(id: number, updates: Partial<schema.PaymentTransaction>): Promise<schema.PaymentTransaction | undefined> {
    const [updated] = await db.update(schema.paymentTransactions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(schema.paymentTransactions.id, id))
      .returning();
    return updated;
  }
}

export const storage = new DatabaseStorage();
