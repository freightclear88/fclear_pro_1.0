import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, Trash2, Ship, FileText, CreditCard, AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Notification } from "@shared/schema";

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'shipment_update':
      return <Ship className="w-4 h-4 text-freight-blue" />;
    case 'document_processed':
      return <FileText className="w-4 h-4 text-freight-green" />;
    case 'payment_due':
    case 'subscription_expired':
      return <CreditCard className="w-4 h-4 text-freight-orange" />;
    case 'system_alert':
      return <AlertTriangle className="w-4 h-4 text-freight-red" />;
    default:
      return <Bell className="w-4 h-4 text-gray-500" />;
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent':
      return 'bg-red-100 border-red-200';
    case 'high':
      return 'bg-orange-100 border-orange-200';
    case 'normal':
      return 'bg-blue-50 border-blue-100';
    case 'low':
      return 'bg-gray-50 border-gray-100';
    default:
      return 'bg-gray-50 border-gray-100';
  }
};

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get notification count
  const { data: notificationCount } = useQuery<{ total: number; unread: number }>({
    queryKey: ["/api/notifications/count"],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Get notifications when dropdown is opened
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    enabled: isOpen,
  });

  // Mark notification as read
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("POST", `/api/notifications/${notificationId}/mark-read`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark notification as read",
        variant: "destructive",
      });
    },
  });

  // Mark all as read
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/notifications/mark-all-read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
      toast({
        title: "Success",
        description: "All notifications marked as read",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to mark all notifications as read",
        variant: "destructive",
      });
    },
  });

  // Delete notification
  const deleteNotificationMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      const response = await apiRequest("DELETE", `/api/notifications/${notificationId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/count"] });
      toast({
        title: "Success",
        description: "Notification deleted",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete notification",
        variant: "destructive",
      });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    
    // Navigate to action URL if provided
    if (notification.actionUrl) {
      window.location.href = notification.actionUrl;
    }
  };

  const formatTimeAgo = (date: string | null | undefined) => {
    if (!date) return 'Unknown';
    const now = new Date();
    const createdAt = new Date(date);
    const diffInMinutes = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative">
          <Bell className="w-5 h-5" />
          {notificationCount && notificationCount.unread > 0 && (
            <Badge className="absolute -top-1 -right-1 bg-freight-red text-white text-xs w-5 h-5 flex items-center justify-center p-0">
              {notificationCount.unread > 99 ? '99+' : notificationCount.unread}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 max-h-96" align="end">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {notificationCount && notificationCount.unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => markAllAsReadMutation.mutate()}
              disabled={markAllAsReadMutation.isPending}
              className="text-xs"
            >
              <CheckCheck className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-gray-500">
            <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className={`p-0 cursor-pointer ${
                  notification.isRead ? 'opacity-70' : ''
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className={`w-full p-3 rounded-md border ${getPriorityColor(notification.priority)} ${
                  !notification.isRead ? 'bg-blue-50/50' : ''
                }`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-sm text-gray-900 truncate">
                          {notification.title}
                        </h4>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {formatTimeAgo(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <div className="w-2 h-2 bg-freight-blue rounded-full flex-shrink-0"></div>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {notification.message}
                      </p>
                      {notification.actionText && (
                        <div className="mt-2">
                          <span className="text-xs text-freight-blue font-medium">
                            {notification.actionText} →
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotificationMutation.mutate(notification.id);
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}