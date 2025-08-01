import React, { useState, useMemo } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import GoogleMapsRoute from '@/components/GoogleMapsRoute';
import { Route, Ship, MapPin, TrendingUp, Globe } from 'lucide-react';
import type { Shipment } from '@shared/schema';

export default function RouteVisualization() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading } = useAuth();
  const [selectedShipmentId, setSelectedShipmentId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'single' | 'overview'>('single');

  const { data: shipments = [], isLoading: shipmentsLoading } = useQuery({
    queryKey: ["/api/shipments"],
  });

  // Filter shipments with route data
  const shipmentsWithRoutes = useMemo(() => {
    return shipments.filter((shipment: Shipment) => 
      shipment.portOfLoading && shipment.portOfDischarge
    );
  }, [shipments]);

  const selectedShipment = useMemo(() => {
    return shipmentsWithRoutes.find((s: Shipment) => s.id === selectedShipmentId) || shipmentsWithRoutes[0];
  }, [shipmentsWithRoutes, selectedShipmentId]);

  // Calculate route statistics
  const routeStats = useMemo(() => {
    const totalShipments = shipmentsWithRoutes.length;
    const activeRoutes = shipmentsWithRoutes.filter((s: Shipment) => s.status !== 'delivered').length;
    const uniqueOrigins = new Set(shipmentsWithRoutes.map((s: Shipment) => s.portOfLoading)).size;
    const uniqueDestinations = new Set(shipmentsWithRoutes.map((s: Shipment) => s.portOfDischarge)).size;
    
    return {
      totalShipments,
      activeRoutes,
      uniqueOrigins,
      uniqueDestinations
    };
  }, [shipmentsWithRoutes]);

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">Please log in to view route visualizations</p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (shipmentsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-freight-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading route data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Route className="w-8 h-8 mr-3 text-freight-blue" />
            Route Visualization
          </h1>
          <p className="text-gray-600 mt-1">Interactive shipping route tracking and analysis</p>
        </div>
        <div className="flex space-x-2">
          <Button
            variant={viewMode === 'single' ? 'default' : 'outline'}
            onClick={() => setViewMode('single')}
          >
            Single Route
          </Button>
          <Button
            variant={viewMode === 'overview' ? 'default' : 'outline'}
            onClick={() => setViewMode('overview')}
          >
            Route Overview
          </Button>
        </div>
      </div>

      {/* Route Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-freight-blue/20">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Ship className="w-8 h-8 text-freight-blue" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{routeStats.totalShipments}</p>
                <p className="text-xs text-gray-600">Total Shipments</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-freight-orange/20">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-freight-orange" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{routeStats.activeRoutes}</p>
                <p className="text-xs text-gray-600">Active Routes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-freight-green/20">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <MapPin className="w-8 h-8 text-freight-green" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{routeStats.uniqueOrigins}</p>
                <p className="text-xs text-gray-600">Origin Ports</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-freight-purple/20">
          <CardContent className="pt-6">
            <div className="flex items-center">
              <Globe className="w-8 h-8 text-freight-purple" />
              <div className="ml-4">
                <p className="text-2xl font-bold">{routeStats.uniqueDestinations}</p>
                <p className="text-xs text-gray-600">Destination Ports</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {viewMode === 'single' && selectedShipment && (
        <div className="space-y-6">
          {/* Shipment Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Shipment</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedShipment.id?.toString() || ''} onValueChange={(value) => setSelectedShipmentId(parseInt(value))}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a shipment to visualize" />
                </SelectTrigger>
                <SelectContent>
                  {shipmentsWithRoutes.map((shipment: Shipment) => (
                    <SelectItem key={shipment.id} value={shipment.id!.toString()}>
                      <div className="flex items-center justify-between w-full">
                        <span className="font-medium">{shipment.shipmentId}</span>
                        <div className="flex items-center space-x-2 ml-4">
                          <span className="text-sm text-gray-500">
                            {shipment.portOfLoading} → {shipment.portOfDischarge}
                          </span>
                          <Badge variant={shipment.status === 'delivered' ? 'default' : 'secondary'}>
                            {shipment.status}
                          </Badge>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Route Visualization */}
          <GoogleMapsRoute shipment={selectedShipment} />
        </div>
      )}

      {viewMode === 'overview' && (
        <div className="space-y-6">
          {/* Route Overview */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">All Active Routes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {shipmentsWithRoutes.slice(0, 6).map((shipment: Shipment) => (
                  <Card key={shipment.id} className="border-freight-blue/10 hover:border-freight-blue/30 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-center">
                        <CardTitle className="text-sm">{shipment.shipmentId}</CardTitle>
                        <Badge variant={shipment.status === 'delivered' ? 'default' : 'secondary'}>
                          {shipment.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center space-x-2 text-sm">
                        <MapPin className="w-4 h-4 text-freight-blue" />
                        <span className="font-medium">{shipment.portOfLoading}</span>
                        <span className="text-gray-400">→</span>
                        <span className="font-medium">{shipment.portOfDischarge}</span>
                      </div>
                      
                      {shipment.vesselAndVoyage && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Ship className="w-4 h-4" />
                          <span>{shipment.vesselAndVoyage}</span>
                        </div>
                      )}
                      
                      {shipment.eta && (
                        <div className="text-sm text-gray-600">
                          ETA: {new Date(shipment.eta).toLocaleDateString()}
                        </div>
                      )}
                      
                      <Button 
                        size="sm" 
                        className="w-full"
                        onClick={() => {
                          setSelectedShipmentId(shipment.id!);
                          setViewMode('single');
                        }}
                      >
                        View Route Details
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
              
              {shipmentsWithRoutes.length > 6 && (
                <div className="text-center mt-6">
                  <p className="text-gray-500">
                    Showing 6 of {shipmentsWithRoutes.length} routes
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* No Data State */}
      {shipmentsWithRoutes.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center">
            <Route className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Routes Available</h3>
            <p className="text-gray-600 mb-4">
              Upload shipment documents with port information to see route visualizations
            </p>
            <Button onClick={() => window.location.href = '/documents'}>
              Upload Documents
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}