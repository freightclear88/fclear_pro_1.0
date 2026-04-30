import {
  users,
  shipments,
  documents,
  ocrProcessingJobs,
  subscriptionPlans,
  paymentTransactions,
  chatConversations,
  chatMessages,
  aiTrainingData,
  userInvitations,
  isfFilings,
  agentAssignments,
  notifications,
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
  type ChatConversation,
  type InsertChatConversation,
  type ChatMessage,
  type InsertChatMessage,
  type AiTrainingData,
  type InsertAiTrainingData,
  type UserInvitation,
  type InsertUserInvitation,
  type IsfFiling,
  type InsertIsfFiling,
  type AgentAssignment,
  type InsertAgentAssignment,
  type Notification,
  type InsertNotification,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, userData: Partial<UpsertUser>): Promise<User>;
  getAllUsers(): Promise<User[]>;
  setUserAgent(userId: string, isAgent: boolean): Promise<User>;
  
  // Shipment operations
  getShipmentsByUserId(userId: string): Promise<Shipment[]>;
  getShipmentById(id: number): Promise<Shipment | undefined>;
  getAllShipments(): Promise<Shipment[]>;
  createShipment(shipment: InsertShipment): Promise<Shipment>;
  updateShipment(id: number, shipment: Partial<InsertShipment>): Promise<Shipment>;
  
  // Document operations
  getDocumentsByShipmentId(shipmentId: number): Promise<Document[]>;
  getDocumentsByUserId(userId: string): Promise<Document[]>;
  getDocumentsByCategory(userId: string, category: string): Promise<Document[]>;
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
  getPaymentTransactionsByUserId(userId: string, limit?: number, offset?: number): Promise<PaymentTransaction[]>;
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
  
  // Chat operations
  getChatConversationsByUserId(userId: string): Promise<ChatConversation[]>;
  getChatConversationById(id: number): Promise<ChatConversation | undefined>;
  createChatConversation(conversation: InsertChatConversation): Promise<ChatConversation>;
  updateChatConversation(id: number, conversation: Partial<InsertChatConversation>): Promise<ChatConversation>;
  getChatMessagesByConversationId(conversationId: number): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
  markMessagesAsRead(conversationId: number, userId: string): Promise<void>;
  getAllChatConversations(): Promise<ChatConversation[]>;
  
  // AI Training operations
  getAllAiTrainingData(): Promise<AiTrainingData[]>;
  getActiveAiTrainingData(): Promise<AiTrainingData[]>;
  getAiTrainingDataByCategory(category: string): Promise<AiTrainingData[]>;
  createAiTrainingData(data: InsertAiTrainingData): Promise<AiTrainingData>;
  updateAiTrainingData(id: number, data: Partial<InsertAiTrainingData>): Promise<AiTrainingData>;
  deleteAiTrainingData(id: number): Promise<void>;
  searchAiTrainingData(keywords: string[]): Promise<AiTrainingData[]>;
  
  // User invitation operations
  createUserInvitation(invitation: InsertUserInvitation): Promise<UserInvitation>;
  getUserInvitationByToken(token: string): Promise<UserInvitation | undefined>;
  getUserInvitationsByUserId(userId: string): Promise<UserInvitation[]>;
  getAllUserInvitations(): Promise<UserInvitation[]>;
  updateUserInvitation(id: number, data: Partial<InsertUserInvitation>): Promise<UserInvitation>;

  // ISF Filing operations
  getIsfFilingsByUserId(userId: string): Promise<IsfFiling[]>;
  getIsfFilingById(id: number): Promise<IsfFiling | undefined>;
  getIsfFilingByNumber(isfNumber: string): Promise<IsfFiling | undefined>;
  getAllIsfFilings(): Promise<IsfFiling[]>;
  createIsfFiling(filing: InsertIsfFiling): Promise<IsfFiling>;
  updateIsfFiling(id: number, filing: Partial<InsertIsfFiling>): Promise<IsfFiling>;
  generateIsfNumber(): Promise<string>;
  getDocumentsByIsfId(isfId: number): Promise<Document[]>;

  // Agent assignment operations
  assignAgentToUser(assignment: InsertAgentAssignment): Promise<AgentAssignment>;
  removeAgentFromUser(agentId: string, userId: string): Promise<void>;
  getAgentAssignments(agentId: string): Promise<AgentAssignment[]>;
  getUsersByAgent(agentId: string): Promise<User[]>;
  getAgentForUser(userId: string): Promise<User | undefined>;
  getAllAgentAssignments(): Promise<AgentAssignment[]>;
  updateAssignedAgent(userId: string, newAgentId: string | null, assignedBy: string): Promise<User>;

  // Notification operations
  getNotificationsByUserId(userId: string): Promise<Notification[]>;
  getUnreadNotificationsByUserId(userId: string): Promise<Notification[]>;
  getNotificationById(id: number): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: number): Promise<Notification>;
  markAllNotificationsAsRead(userId: string): Promise<void>;
  deleteNotification(id: number): Promise<void>;
  getNotificationCount(userId: string): Promise<{ total: number; unread: number; }>;
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

  async createUser(userData: UpsertUser): Promise<User> {
    // Generate a UUID for the user ID
    const userId = crypto.randomUUID();
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        id: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
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

  // ISF Filing operations
  async getIsfFilingsByUserId(userId: string): Promise<IsfFiling[]> {
    const filings = await db.select().from(isfFilings).where(eq(isfFilings.userId, userId));
    return filings;
  }

  async getIsfFilingById(id: number): Promise<IsfFiling | undefined> {
    const [filing] = await db.select().from(isfFilings).where(eq(isfFilings.id, id));
    return filing;
  }

  async createIsfFiling(filingData: InsertIsfFiling): Promise<IsfFiling> {
    const [filing] = await db
      .insert(isfFilings)
      .values(filingData)
      .returning();
    return filing;
  }

  async updateIsfFiling(id: number, updates: Partial<InsertIsfFiling>): Promise<IsfFiling> {
    const [filing] = await db
      .update(isfFilings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(isfFilings.id, id))
      .returning();
    return filing;
  }

  async generateIsfNumber(): Promise<string> {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `ISF${timestamp}${random}`;
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

  async setUserAgent(userId: string, isAgent: boolean): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ isAgent, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
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

  async getShipmentByShipmentId(shipmentId: string): Promise<Shipment | undefined> {
    const [shipment] = await db.select().from(shipments).where(eq(shipments.shipmentId, shipmentId));
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

  async getDocumentsByCategory(userId: string, category: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(and(eq(documents.userId, userId), eq(documents.category, category)))
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

  async getPaymentTransactionsByUserId(userId: string, limit?: number, offset?: number): Promise<PaymentTransaction[]> {
    let query = db.select().from(paymentTransactions)
      .where(eq(paymentTransactions.userId, userId))
      .orderBy(desc(paymentTransactions.createdAt));
    
    if (limit !== undefined) {
      query = query.limit(limit);
    }
    
    if (offset !== undefined) {
      query = query.offset(offset);
    }
    
    return await query;
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
      isTrialActive: !!isTrialActive,
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

  // Chat operations
  async getChatConversationsByUserId(userId: string): Promise<ChatConversation[]> {
    return await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.userId, userId))
      .orderBy(desc(chatConversations.lastMessageAt));
  }

  async getChatConversationById(id: number): Promise<ChatConversation | undefined> {
    const [conversation] = await db
      .select()
      .from(chatConversations)
      .where(eq(chatConversations.id, id));
    return conversation;
  }

  async createChatConversation(conversationData: InsertChatConversation): Promise<ChatConversation> {
    const [conversation] = await db
      .insert(chatConversations)
      .values(conversationData)
      .returning();
    return conversation;
  }

  async updateChatConversation(id: number, conversationData: Partial<InsertChatConversation>): Promise<ChatConversation> {
    const [conversation] = await db
      .update(chatConversations)
      .set({ ...conversationData, updatedAt: new Date() })
      .where(eq(chatConversations.id, id))
      .returning();
    return conversation;
  }

  async getChatMessagesByConversationId(conversationId: number): Promise<ChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, conversationId))
      .orderBy(chatMessages.createdAt);
  }

  async createChatMessage(messageData: InsertChatMessage): Promise<ChatMessage> {
    const [message] = await db
      .insert(chatMessages)
      .values(messageData)
      .returning();
    
    // Update conversation's last message time
    await db
      .update(chatConversations)
      .set({ lastMessageAt: new Date(), updatedAt: new Date() })
      .where(eq(chatConversations.id, messageData.conversationId));
    
    return message;
  }

  async markMessagesAsRead(conversationId: number, userId: string): Promise<void> {
    await db
      .update(chatMessages)
      .set({ isRead: true })
      .where(
        and(
          eq(chatMessages.conversationId, conversationId),
          eq(chatMessages.senderId, userId)
        )
      );
  }

  async getAllChatConversations(): Promise<ChatConversation[]> {
    return await db
      .select()
      .from(chatConversations)
      .orderBy(desc(chatConversations.lastMessageAt));
  }

  // AI Training operations
  async getAllAiTrainingData(): Promise<AiTrainingData[]> {
    return await db.select().from(aiTrainingData).orderBy(desc(aiTrainingData.priority), desc(aiTrainingData.createdAt));
  }

  async getActiveAiTrainingData(): Promise<AiTrainingData[]> {
    return await db.select().from(aiTrainingData)
      .where(eq(aiTrainingData.isActive, true))
      .orderBy(desc(aiTrainingData.priority), desc(aiTrainingData.createdAt));
  }

  async getAiTrainingDataByCategory(category: string): Promise<AiTrainingData[]> {
    return await db.select().from(aiTrainingData)
      .where(and(eq(aiTrainingData.category, category), eq(aiTrainingData.isActive, true)))
      .orderBy(desc(aiTrainingData.priority), desc(aiTrainingData.createdAt));
  }

  async createAiTrainingData(data: InsertAiTrainingData): Promise<AiTrainingData> {
    const [result] = await db.insert(aiTrainingData).values(data).returning();
    return result;
  }

  async updateAiTrainingData(id: number, data: Partial<InsertAiTrainingData>): Promise<AiTrainingData> {
    const [result] = await db.update(aiTrainingData)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(aiTrainingData.id, id))
      .returning();
    return result;
  }

  async deleteAiTrainingData(id: number): Promise<void> {
    await db.delete(aiTrainingData).where(eq(aiTrainingData.id, id));
  }

  async searchAiTrainingData(keywords: string[]): Promise<AiTrainingData[]> {
    const lowerKeywords = keywords.map(k => k.toLowerCase());
    const results = await this.getActiveAiTrainingData();
    
    return results.filter(item => {
      if (!item.keywords) return false;
      const itemKeywords = item.keywords.map(k => k.toLowerCase());
      return lowerKeywords.some(keyword => 
        itemKeywords.some(itemKeyword => 
          itemKeyword.includes(keyword) || keyword.includes(itemKeyword)
        )
      );
    }).sort((a, b) => (b.priority || 1) - (a.priority || 1));
  }

  // User invitation operations
  async createUserInvitation(invitationData: InsertUserInvitation): Promise<UserInvitation> {
    const [invitation] = await db.insert(userInvitations).values(invitationData).returning();
    return invitation;
  }

  async getUserInvitationByToken(token: string): Promise<UserInvitation | undefined> {
    const [invitation] = await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.inviteToken, token));
    return invitation;
  }

  async getUserInvitationsByUserId(userId: string): Promise<UserInvitation[]> {
    return await db
      .select()
      .from(userInvitations)
      .where(eq(userInvitations.invitedBy, userId))
      .orderBy(desc(userInvitations.createdAt));
  }

  async getAllUserInvitations(): Promise<UserInvitation[]> {
    return await db
      .select()
      .from(userInvitations)
      .orderBy(desc(userInvitations.createdAt));
  }

  async updateUserInvitation(id: number, data: Partial<InsertUserInvitation>): Promise<UserInvitation> {
    const [invitation] = await db
      .update(userInvitations)
      .set(data)
      .where(eq(userInvitations.id, id))
      .returning();
    return invitation;
  }
  async getIsfFilingByNumber(isfNumber: string): Promise<IsfFiling | undefined> {
    const [filing] = await db.select().from(isfFilings).where(eq(isfFilings.isfNumber, isfNumber));
    return filing;
  }

  async getAllIsfFilings(): Promise<IsfFiling[]> {
    return await db
      .select()
      .from(isfFilings)
      .orderBy(desc(isfFilings.createdAt));
  }

  async getDocumentsByIsfId(isfId: number): Promise<Document[]> {
    return await db.select().from(documents).where(eq(documents.isfFilingId, isfId));
  }

  // Agent assignment operations
  async assignAgentToUser(assignment: InsertAgentAssignment): Promise<AgentAssignment> {
    // First deactivate any existing assignments for this user
    await db
      .update(agentAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(agentAssignments.userId, assignment.userId),
        eq(agentAssignments.isActive, true)
      ));

    // Create the new assignment
    const [newAssignment] = await db
      .insert(agentAssignments)
      .values(assignment)
      .returning();

    // Update the user's assignedAgentId field
    await db
      .update(users)
      .set({ 
        assignedAgentId: assignment.agentId,
        updatedAt: new Date()
      })
      .where(eq(users.id, assignment.userId));

    return newAssignment;
  }

  async removeAgentFromUser(agentId: string, userId: string): Promise<void> {
    // Deactivate the assignment
    await db
      .update(agentAssignments)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(
        eq(agentAssignments.agentId, agentId),
        eq(agentAssignments.userId, userId),
        eq(agentAssignments.isActive, true)
      ));

    // Clear the user's assignedAgentId
    await db
      .update(users)
      .set({ 
        assignedAgentId: null,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  async getAgentAssignments(agentId: string): Promise<AgentAssignment[]> {
    return await db
      .select()
      .from(agentAssignments)
      .where(and(
        eq(agentAssignments.agentId, agentId),
        eq(agentAssignments.isActive, true)
      ))
      .orderBy(desc(agentAssignments.assignedAt));
  }

  async getUsersByAgent(agentId: string): Promise<User[]> {
    return await db
      .select()
      .from(users)
      .where(eq(users.assignedAgentId, agentId))
      .orderBy(desc(users.createdAt));
  }

  async getAgentForUser(userId: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId));

    if (!user?.assignedAgentId) {
      return undefined;
    }

    const [agent] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.assignedAgentId));

    return agent;
  }

  async getAllAgentAssignments(): Promise<AgentAssignment[]> {
    return await db
      .select()
      .from(agentAssignments)
      .where(eq(agentAssignments.isActive, true))
      .orderBy(desc(agentAssignments.assignedAt));
  }

  async updateAssignedAgent(userId: string, newAgentId: string | null, assignedBy: string): Promise<User> {
    if (newAgentId) {
      // Create new assignment
      await this.assignAgentToUser({
        agentId: newAgentId,
        userId,
        assignedBy,
        isActive: true,
        notes: `Assigned by ${assignedBy}`
      });
    } else {
      // Remove existing assignment
      const user = await this.getUser(userId);
      if (user?.assignedAgentId) {
        await this.removeAgentFromUser(user.assignedAgentId, userId);
      }
    }

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error('User not found');
    }
    return updatedUser;
  }

  // Notification operations
  async getNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isArchived, false)
      ))
      .orderBy(desc(notifications.createdAt));
  }

  async getUnreadNotificationsByUserId(userId: string): Promise<Notification[]> {
    return await db
      .select()
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        eq(notifications.isArchived, false)
      ))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotificationById(id: number): Promise<Notification | undefined> {
    const [notification] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id));
    return notification;
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const [newNotification] = await db
      .insert(notifications)
      .values(notification)
      .returning();
    return newNotification;
  }

  async markNotificationAsRead(id: number): Promise<Notification> {
    const [notification] = await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async markAllNotificationsAsRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true, readAt: new Date() })
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false)
      ));
  }

  async deleteNotification(id: number): Promise<void> {
    await db
      .delete(notifications)
      .where(eq(notifications.id, id));
  }

  async getNotificationCount(userId: string): Promise<{ total: number; unread: number; }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isArchived, false)
      ));

    const [unreadResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(
        eq(notifications.userId, userId),
        eq(notifications.isRead, false),
        eq(notifications.isArchived, false)
      ));

    return {
      total: totalResult?.count || 0,
      unread: unreadResult?.count || 0
    };
  }
}

export const storage = new DatabaseStorage();
