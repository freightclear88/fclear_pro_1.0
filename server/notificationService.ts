import { storage } from "./storage";
import type { InsertNotification } from "@shared/schema";

export class NotificationService {
  static async createNotification(notification: InsertNotification) {
    try {
      return await storage.createNotification(notification);
    } catch (error) {
      console.error("Error creating notification:", error);
    }
  }

  // Shipment-related notifications
  static async notifyShipmentCreated(userId: string, shipmentId: string) {
    return this.createNotification({
      userId,
      title: "New Shipment Created",
      message: `Shipment ${shipmentId} has been successfully created and is now being processed.`,
      type: "shipment_update",
      category: "shipment",
      priority: "normal",
      relatedEntityType: "shipment",
      relatedEntityId: shipmentId,
      actionUrl: `/shipments`,
      actionText: "View Shipment"
    });
  }

  static async notifyShipmentStatusUpdate(userId: string, shipmentId: string, status: string) {
    const statusMessages = {
      'arrived': 'has arrived at the destination',
      'in_transit': 'is now in transit',
      'delayed': 'has been delayed',
      'delivered': 'has been delivered',
      'customs_hold': 'is being held at customs',
      'ready_pickup': 'is ready for pickup'
    };

    const message = statusMessages[status as keyof typeof statusMessages] || 'status has been updated';

    return this.createNotification({
      userId,
      title: "Shipment Status Update",
      message: `Your shipment ${shipmentId} ${message}.`,
      type: "shipment_update",
      category: "shipment",
      priority: status === 'delayed' || status === 'customs_hold' ? "high" : "normal",
      relatedEntityType: "shipment",
      relatedEntityId: shipmentId,
      actionUrl: `/shipments`,
      actionText: "View Shipment"
    });
  }

  // Document-related notifications
  static async notifyDocumentProcessed(userId: string, documentName: string, success: boolean) {
    return this.createNotification({
      userId,
      title: success ? "Document Processed Successfully" : "Document Processing Failed",
      message: success 
        ? `Your document "${documentName}" has been processed and data extracted successfully.`
        : `Failed to process document "${documentName}". Please check the file format and try again.`,
      type: "document_processed",
      category: "document",
      priority: success ? "normal" : "high",
      relatedEntityType: "document",
      actionUrl: `/documents`,
      actionText: "View Documents"
    });
  }

  static async notifyMultiDocumentProcessed(userId: string, documentCount: number, shipmentId: string) {
    return this.createNotification({
      userId,
      title: "Multi-Document Processing Complete",
      message: `Successfully processed ${documentCount} documents and created shipment ${shipmentId} with consolidated data.`,
      type: "document_processed",
      category: "document",
      priority: "normal",
      relatedEntityType: "shipment",
      relatedEntityId: shipmentId,
      actionUrl: `/shipments`,
      actionText: "View Shipment"
    });
  }

  // Subscription-related notifications
  static async notifySubscriptionLimitWarning(userId: string, limitType: 'shipments' | 'documents', current: number, max: number) {
    const percentage = (current / max) * 100;
    let priority: 'normal' | 'high' | 'urgent' = 'normal';
    
    if (percentage >= 90) priority = 'urgent';
    else if (percentage >= 75) priority = 'high';

    return this.createNotification({
      userId,
      title: `${limitType === 'shipments' ? 'Shipment' : 'Document'} Limit Warning`,
      message: `You have used ${current} out of ${max} ${limitType} on your Free plan. Consider upgrading to Starter Plan for 20 shipments and 300 documents.`,
      type: "subscription_limit",
      category: "subscription",
      priority,
      actionUrl: `/subscription`,
      actionText: "Upgrade Plan"
    });
  }

  static async notifySubscriptionExpired(userId: string) {
    return this.createNotification({
      userId,
      title: "Subscription Expired",
      message: "Your subscription has expired. Please renew to continue using premium features.",
      type: "subscription_expired",
      category: "subscription",
      priority: "urgent",
      actionUrl: `/subscription`,
      actionText: "Renew Subscription"
    });
  }

  // Payment-related notifications
  static async notifyPaymentDue(userId: string, amount: number, dueDate: string) {
    return this.createNotification({
      userId,
      title: "Payment Due",
      message: `Your payment of $${amount.toFixed(2)} is due on ${new Date(dueDate).toLocaleDateString()}.`,
      type: "payment_due",
      category: "payment",
      priority: "high",
      actionUrl: `/subscription`,
      actionText: "Make Payment"
    });
  }

  static async notifyPaymentProcessed(userId: string, amount: number, service: string) {
    return this.createNotification({
      userId,
      title: "Payment Processed",
      message: `Your payment of $${amount.toFixed(2)} for ${service} has been processed successfully.`,
      type: "payment_success",
      category: "payment",
      priority: "normal"
    });
  }

  // System alerts
  static async notifySystemMaintenance(userId: string, startTime: string, duration: string) {
    return this.createNotification({
      userId,
      title: "Scheduled Maintenance",
      message: `System maintenance is scheduled for ${new Date(startTime).toLocaleString()} for approximately ${duration}. Service may be temporarily unavailable.`,
      type: "system_alert",
      category: "system",
      priority: "normal",
      expiresAt: new Date(startTime)
    });
  }

  static async notifyTrackingAvailable(userId: string, shipmentId: string, trackingType: 'ocean' | 'air') {
    return this.createNotification({
      userId,
      title: `${trackingType === 'air' ? 'Air' : 'Ocean'} Tracking Available`,
      message: `${trackingType === 'air' ? 'AWB' : 'Container'} tracking is now available for your shipment ${shipmentId}.`,
      type: "shipment_update",
      category: "shipment",
      priority: "normal",
      relatedEntityType: "shipment",
      relatedEntityId: shipmentId,
      actionUrl: `/shipments`,
      actionText: "Track Shipment"
    });
  }

  // Bulk notification for admins
  static async notifyAllUsers(notification: Omit<InsertNotification, 'userId'>) {
    try {
      const users = await storage.getAllUsers();
      const notifications = users.map(user => ({
        ...notification,
        userId: user.id
      }));

      for (const notif of notifications) {
        await this.createNotification(notif);
      }

      console.log(`Sent notification to ${users.length} users: ${notification.title}`);
    } catch (error) {
      console.error("Error sending bulk notifications:", error);
    }
  }
}