/// <reference types="google.maps" />
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ship, MapPin, Clock, Route, Anchor, Navigation, AlertCircle } from 'lucide-react';
import type { Shipment } from '@shared/schema';

interface GoogleMapsRouteProps {
  shipment: Shipment;
  className?: string;
}

interface Port {
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  type: 'loading' | 'discharge';
}

// Major shipping ports with coordinates (same as before for fallback)
const MAJOR_PORTS: Record<string, [number, number]> = {
  'SHANGHAI': [121.4737, 31.2304],
  'SHENZHEN': [114.0579, 22.5431],
  'NINGBO': [121.5440, 29.8683],
  'QINGDAO': [120.3826, 36.0671],
  'GUANGZHOU': [113.2644, 23.1291],
  'HONG KONG': [114.1694, 22.3193],
  'SINGAPORE': [103.8198, 1.3521],
  'BUSAN': [129.0756, 35.1796],
  'TOKYO': [139.6917, 35.6895],
  'YOKOHAMA': [139.6380, 35.4437],
  'LOS ANGELES': [-118.2437, 34.0522],
  'LONG BEACH': [-118.1937, 33.7701],
  'OAKLAND': [-122.2711, 37.8044],
  'SEATTLE': [-122.3328, 47.6061],
  'TACOMA': [-122.4598, 47.2529],
  'VANCOUVER': [-123.1207, 49.2827],
  'NEW YORK': [-74.0060, 40.7128],
  'NEWARK': [-74.1724, 40.7357],
  'SAVANNAH': [-81.0912, 32.0835],
  'CHARLESTON': [-79.9311, 32.7765],
  'NORFOLK': [-76.2859, 36.8508],
  'BALTIMORE': [-76.6122, 39.2904],
  'MIAMI': [-80.1918, 25.7617],
  'ROTTERDAM': [4.4777, 51.9244],
  'HAMBURG': [9.9937, 53.5511],
  'ANTWERP': [4.4024, 51.2194],
  'FELIXSTOWE': [1.3540, 51.9540],
  'VALENCIA': [-0.3763, 39.4699],
  'BARCELONA': [2.1734, 41.3851],
  'DUBAI': [55.2708, 25.2048],
  'JEBEL ALI': [55.0670, 25.0657],
  'UNKNOWN': [0, 0]
};

function findPortCoordinates(portName: string): [number, number] {
  const cleanPortName = portName.toUpperCase().trim();
  
  if (MAJOR_PORTS[cleanPortName]) {
    return MAJOR_PORTS[cleanPortName];
  }
  
  for (const [knownPort, coordinates] of Object.entries(MAJOR_PORTS)) {
    if (cleanPortName.includes(knownPort) || knownPort.includes(cleanPortName)) {
      return coordinates;
    }
  }
  
  return MAJOR_PORTS.UNKNOWN;
}

// Google Maps integration component
const GoogleMapsRoute: React.FC<GoogleMapsRouteProps> = ({ shipment, className = '' }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<'current' | 'historical'>('current');

  // Parse ports from shipment
  const ports: Port[] = React.useMemo(() => {
    const portList: Port[] = [];
    
    if (shipment.portOfLoading) {
      const coordinates = findPortCoordinates(shipment.portOfLoading);
      portList.push({
        name: shipment.portOfLoading,
        coordinates,
        type: 'loading'
      });
    }
    
    if (shipment.portOfDischarge) {
      const coordinates = findPortCoordinates(shipment.portOfDischarge);
      portList.push({
        name: shipment.portOfDischarge,
        coordinates,
        type: 'discharge'
      });
    }
    
    return portList;
  }, [shipment]);

  // Calculate estimated progress
  const estimatedProgress = React.useMemo(() => {
    if (!shipment.etd || !shipment.eta) return 0;
    
    const now = new Date();
    const departure = new Date(shipment.etd);
    const arrival = new Date(shipment.eta);
    
    if (now < departure) return 0;
    if (now > arrival) return 100;
    
    const totalTime = arrival.getTime() - departure.getTime();
    const elapsedTime = now.getTime() - departure.getTime();
    
    return Math.min(Math.max((elapsedTime / totalTime) * 100, 0), 100);
  }, [shipment.etd, shipment.eta]);

  // Load Google Maps script
  useEffect(() => {
    const loadGoogleMaps = () => {
      if ((window as any).google && (window as any).google.maps) {
        setMapLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}&libraries=geometry`;
      script.async = true;
      script.defer = true;
      script.onload = () => setMapLoaded(true);
      script.onerror = () => {
        console.error('Failed to load Google Maps');
      };
      document.head.appendChild(script);
    };

    loadGoogleMaps();
  }, []);

  // Initialize map when loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || ports.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    
    // Create map
    const map = new google.maps.Map(mapRef.current, {
      zoom: 2,
      center: { lat: 20, lng: 0 },
      mapTypeId: google.maps.MapTypeId.ROADMAP,
      styles: [
        {
          featureType: "water",
          elementType: "geometry",
          stylers: [{ color: "#a2d2ff" }]
        },
        {
          featureType: "landscape",
          elementType: "geometry",
          stylers: [{ color: "#f5f5f5" }]
        }
      ]
    });

    mapInstanceRef.current = map;

    // Add port markers
    ports.forEach((port, index) => {
      const position = { 
        lat: port.coordinates[1], 
        lng: port.coordinates[0] 
      };

      bounds.extend(position);

      const marker = new google.maps.Marker({
        position,
        map,
        title: port.name,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: port.type === 'loading' ? '#2563eb' : '#dc2626',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div class="p-2">
            <h3 class="font-medium">${port.name}</h3>
            <p class="text-sm text-gray-600">${port.type === 'loading' ? 'Port of Loading' : 'Port of Discharge'}</p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    });

    // Draw route line if we have multiple ports
    if (ports.length >= 2) {
      const routePath = ports.map(port => ({
        lat: port.coordinates[1],
        lng: port.coordinates[0]
      }));

      // Full route (dashed)
      const routeLine = new google.maps.Polyline({
        path: routePath,
        geodesic: true,
        strokeColor: '#cbd5e1',
        strokeOpacity: 0.8,
        strokeWeight: 3,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 1,
            scale: 2
          },
          offset: '0',
          repeat: '10px'
        }]
      });

      routeLine.setMap(map);

      // Progress line (solid)
      if (estimatedProgress > 0) {
        const progressPath = routePath.slice(0, Math.max(1, Math.floor((estimatedProgress / 100) * routePath.length)));
        
        const progressLine = new google.maps.Polyline({
          path: progressPath,
          geodesic: true,
          strokeColor: '#2563eb',
          strokeOpacity: 1,
          strokeWeight: 4
        });

        progressLine.setMap(map);

        // Add vessel marker at current position
        if (estimatedProgress > 0 && estimatedProgress < 100) {
          const vesselIndex = (estimatedProgress / 100) * (routePath.length - 1);
          const lowerIndex = Math.floor(vesselIndex);
          const upperIndex = Math.ceil(vesselIndex);
          const t = vesselIndex - lowerIndex;

          let vesselPosition;
          if (lowerIndex >= routePath.length - 1) {
            vesselPosition = routePath[routePath.length - 1];
          } else {
            const point1 = routePath[lowerIndex];
            const point2 = routePath[upperIndex];
            vesselPosition = {
              lat: point1.lat + (point2.lat - point1.lat) * t,
              lng: point1.lng + (point2.lng - point1.lng) * t
            };
          }

          const vesselMarker = new google.maps.Marker({
            position: vesselPosition,
            map,
            title: `${shipment.vesselAndVoyage || 'Vessel'} - ${Math.round(estimatedProgress)}% Complete`,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#f97316',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2
            },
            animation: google.maps.Animation.BOUNCE
          });

          const vesselInfo = new google.maps.InfoWindow({
            content: `
              <div class="p-2">
                <h3 class="font-medium">🚢 ${shipment.vesselAndVoyage || 'Vessel'}</h3>
                <p class="text-sm text-gray-600">Progress: ${Math.round(estimatedProgress)}%</p>
                <p class="text-sm text-gray-600">Container: ${shipment.containerNumber || 'N/A'}</p>
              </div>
            `
          });

          vesselMarker.addListener('click', () => {
            vesselInfo.open(map, vesselMarker);
          });
        }
      }
    }

    // Fit map to show all markers
    if (ports.length > 0) {
      map.fitBounds(bounds);
      
      // Ensure minimum zoom level
      const listener = google.maps.event.addListener(map, "idle", () => {
        if (map.getZoom() > 10) map.setZoom(10);
        google.maps.event.removeListener(listener);
      });
    }

  }, [mapLoaded, ports, estimatedProgress, shipment]);

  // Show error if no Google Maps API key
  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-64 text-center">
            <div>
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-500" />
              <h3 className="text-lg font-medium mb-2">Google Maps API Key Required</h3>
              <p className="text-sm text-gray-600 mb-4">
                To display interactive route maps, please add your Google Maps API key to the environment variables.
              </p>
              <p className="text-xs text-gray-500">
                Set VITE_GOOGLE_MAPS_API_KEY in your environment
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Route className="w-5 h-5 mr-2 text-freight-blue" />
            Interactive Route Map
          </CardTitle>
          <div className="flex space-x-2">
            <Button
              variant={selectedRoute === 'current' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRoute('current')}
            >
              Current Route
            </Button>
            <Button
              variant={selectedRoute === 'historical' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRoute('historical')}
            >
              Historical
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Route Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg">
              <MapPin className="w-5 h-5 text-freight-blue" />
              <div>
                <div className="text-sm font-medium">Origin</div>
                <div className="text-xs text-gray-600">{shipment.portOfLoading || 'Unknown'}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-orange-50 rounded-lg">
              <Ship className="w-5 h-5 text-freight-orange" />
              <div>
                <div className="text-sm font-medium">Vessel</div>
                <div className="text-xs text-gray-600">{shipment.vesselAndVoyage || 'Unknown'}</div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2 p-3 bg-green-50 rounded-lg">
              <Anchor className="w-5 h-5 text-freight-green" />
              <div>
                <div className="text-sm font-medium">Destination</div>
                <div className="text-xs text-gray-600">{shipment.portOfDischarge || 'Unknown'}</div>
              </div>
            </div>
          </div>

          {/* Google Maps Container */}
          <div className="relative rounded-lg border border-slate-200 overflow-hidden">
            <div className="absolute top-2 right-2 z-10">
              <Badge variant="outline" className="bg-white/90 backdrop-blur-sm">
                Google Maps
              </Badge>
            </div>
            <div 
              ref={mapRef} 
              className="w-full h-96"
              style={{ minHeight: '400px' }}
            />
            {!mapLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-50">
                <div className="text-center">
                  <div className="animate-spin w-8 h-8 border-4 border-freight-blue border-t-transparent rounded-full mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Loading Google Maps...</p>
                </div>
              </div>
            )}
          </div>

          {/* Route Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Timeline */}
            <Card className="border-freight-blue/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Clock className="w-4 h-4 mr-2" />
                  Route Timeline
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shipment.etd && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Departure</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {new Date(shipment.etd).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(shipment.etd).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Progress</span>
                  <div className="text-right">
                    <div className="text-sm font-medium">{Math.round(estimatedProgress)}%</div>
                    <div className="w-20 h-2 bg-gray-200 rounded-full">
                      <div 
                        className="h-2 bg-freight-blue rounded-full transition-all duration-500"
                        style={{ width: `${estimatedProgress}%` }}
                      />
                    </div>
                  </div>
                </div>
                
                {shipment.eta && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Est. Arrival</span>
                    <div className="text-right">
                      <div className="text-sm font-medium">
                        {new Date(shipment.eta).toLocaleDateString()}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(shipment.eta).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Vessel Information */}
            <Card className="border-freight-orange/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Navigation className="w-4 h-4 mr-2" />
                  Vessel Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {shipment.vesselAndVoyage && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Vessel/Voyage</span>
                    <span className="text-sm font-medium">{shipment.vesselAndVoyage}</span>
                  </div>
                )}
                
                {shipment.containerNumber && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Container</span>
                    <span className="text-sm font-medium">{shipment.containerNumber}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Status</span>
                  <Badge variant={shipment.status === 'delivered' ? 'default' : 'secondary'}>
                    {shipment.status || 'In Transit'}
                  </Badge>
                </div>
                
                {shipment.transportMode && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Mode</span>
                    <span className="text-sm font-medium capitalize">{shipment.transportMode}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleMapsRoute;