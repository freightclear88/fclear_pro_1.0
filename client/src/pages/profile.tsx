import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { User, Mail, Building, LogOut, Ship, FileText } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();

  const { data: shipments = [] } = useQuery({
    queryKey: ["/api/shipments"],
  });

  const { data: stats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
  });

  const handleLogout = () => {
    window.location.href = "/api/logout";
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-freight-dark flex items-center">
            <User className="w-6 h-6 mr-2 text-freight-blue" />
            Profile
          </h2>
          <p className="text-gray-600">Manage your account and view activity</p>
        </div>
        <Button 
          onClick={handleLogout}
          variant="outline"
          className="text-freight-dark hover:text-freight-orange"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Information */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center space-x-4">
                <Avatar className="w-16 h-16">
                  <AvatarImage 
                    src={user?.profileImageUrl} 
                    alt={`${user?.firstName} ${user?.lastName}`}
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-freight-blue text-white text-lg">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="text-lg font-semibold text-freight-dark">
                    {user?.firstName} {user?.lastName}
                  </h3>
                  <p className="text-gray-600">{user?.company || "Freight Professional"}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span className="text-sm">{user?.email}</span>
                </div>
                {user?.company && (
                  <div className="flex items-center space-x-3">
                    <Building className="w-4 h-4 text-gray-400" />
                    <span className="text-sm">{user.company}</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs text-gray-500">
                  Member since {new Date(user?.createdAt || "").toLocaleDateString()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Quick Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <Ship className="w-4 h-4 text-freight-blue" />
                  <span className="text-sm">Total Shipments</span>
                </div>
                <Badge variant="secondary">{shipments.length}</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-freight-green" />
                  <span className="text-sm">Active Shipments</span>
                </div>
                <Badge variant="secondary">{stats?.activeShipments || 0}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Shipments */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Shipments</CardTitle>
            </CardHeader>
            <CardContent>
              {shipments.length > 0 ? (
                <div className="space-y-4">
                  {shipments.slice(0, 5).map((shipment: any) => (
                    <div 
                      key={shipment.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <h4 className="font-medium text-freight-dark">
                          {shipment.shipmentId}
                        </h4>
                        <p className="text-sm text-gray-600">
                          {shipment.origin} → {shipment.destination}
                        </p>
                        <p className="text-xs text-gray-500">
                          Created: {new Date(shipment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge 
                        variant="default"
                        className={
                          shipment.status === "delivered" 
                            ? "bg-freight-green text-white"
                            : shipment.status === "in_transit"
                            ? "bg-freight-blue text-white"
                            : "bg-freight-orange text-white"
                        }
                      >
                        {shipment.status.replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Ship className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No shipments yet</p>
                  <p className="text-sm text-gray-400">Create your first shipment to get started</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
