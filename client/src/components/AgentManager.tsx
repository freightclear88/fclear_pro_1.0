import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCheck, UserX, Search, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";

export default function AgentManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["/api/admin/users"],
    retry: false,
  });

  const agentMutation = useMutation({
    mutationFn: async ({ userId, isAgent }: { userId: string; isAgent: boolean }) => {
      return await apiRequest(`/api/admin/users/${userId}/agent`, {
        method: "POST",
        body: JSON.stringify({ isAgent }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({
        title: "Success",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const filteredUsers = users.filter((user: User) => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      user.email?.toLowerCase().includes(searchLower) ||
      user.firstName?.toLowerCase().includes(searchLower) ||
      user.lastName?.toLowerCase().includes(searchLower) ||
      user.companyName?.toLowerCase().includes(searchLower)
    );
  });

  const handleToggleAgent = (userId: string, currentIsAgent: boolean) => {
    agentMutation.mutate({
      userId,
      isAgent: !currentIsAgent,
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Agent Management
        </CardTitle>
        <CardDescription>
          Manage agent access for users. Agents can view and edit all shipments and documents.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search by name, email, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Users List */}
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading users...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchTerm ? "No users found matching your search." : "No users found."}
            </div>
          ) : (
            filteredUsers.map((user: User) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    {user.firstName ? user.firstName[0] : user.email?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium">
                      {user.firstName || user.lastName 
                        ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                        : user.email
                      }
                    </div>
                    <div className="text-sm text-gray-500">
                      {user.email}
                      {user.companyName && ` • ${user.companyName}`}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Badges */}
                  <div className="flex gap-2">
                    {user.isAdmin && (
                      <Badge variant="destructive" className="text-xs">
                        <Shield className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    )}
                    {user.isAgent && (
                      <Badge variant="default" className="text-xs bg-teal-600">
                        <Shield className="h-3 w-3 mr-1" />
                        Agent
                      </Badge>
                    )}
                    {!user.isAdmin && !user.isAgent && (
                      <Badge variant="outline" className="text-xs">
                        User
                      </Badge>
                    )}
                  </div>

                  {/* Agent Toggle Button */}
                  {!user.isAdmin && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant={user.isAgent ? "outline" : "default"}
                          size="sm"
                          className={user.isAgent ? "text-red-600 border-red-300 hover:bg-red-50" : "bg-teal-600 hover:bg-teal-700"}
                        >
                          {user.isAgent ? (
                            <>
                              <UserX className="h-4 w-4 mr-1" />
                              Remove Agent
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-4 w-4 mr-1" />
                              Make Agent
                            </>
                          )}
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>
                            {user.isAgent ? "Remove Agent Access" : "Grant Agent Access"}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <p className="text-sm text-gray-600">
                            {user.isAgent
                              ? `Remove agent permissions from ${user.firstName || user.email}? They will only be able to manage their own shipments and documents.`
                              : `Grant agent permissions to ${user.firstName || user.email}? They will be able to view and edit ALL shipments and documents across all users.`
                            }
                          </p>
                          <div className="flex justify-end gap-2">
                            <DialogTrigger asChild>
                              <Button variant="outline">Cancel</Button>
                            </DialogTrigger>
                            <Button
                              onClick={() => handleToggleAgent(user.id, user.isAgent || false)}
                              disabled={agentMutation.isPending}
                              variant={user.isAgent ? "destructive" : "default"}
                              className={!user.isAgent ? "bg-teal-600 hover:bg-teal-700" : ""}
                            >
                              {agentMutation.isPending ? "Processing..." : user.isAgent ? "Remove Agent" : "Grant Agent Access"}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}