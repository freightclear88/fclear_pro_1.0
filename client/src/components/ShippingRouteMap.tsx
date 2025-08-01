import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Ship, MapPin, Clock, Route, Anchor, Navigation } from 'lucide-react';
import type { Shipment } from '@shared/schema';

interface ShippingRouteMapProps {
  shipment: Shipment;
  className?: string;
}

interface Port {
  name: string;
  code: string;
  coordinates: [number, number]; // [longitude, latitude]
  type: 'loading' | 'discharge' | 'transit';
}

interface RoutePoint {
  coordinates: [number, number];
  timestamp?: string;
  status: 'completed' | 'current' | 'upcoming';
}

// Major shipping ports with coordinates
const MAJOR_PORTS: Record<string, [number, number]> = {
  // Asia-Pacific
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
  
  // North America West Coast
  'LOS ANGELES': [-118.2437, 34.0522],
  'LONG BEACH': [-118.1937, 33.7701],
  'OAKLAND': [-122.2711, 37.8044],
  'SEATTLE': [-122.3328, 47.6061],
  'TACOMA': [-122.4598, 47.2529],
  'VANCOUVER': [-123.1207, 49.2827],
  
  // North America East Coast
  'NEW YORK': [-74.0060, 40.7128],
  'NEWARK': [-74.1724, 40.7357],
  'SAVANNAH': [-81.0912, 32.0835],
  'CHARLESTON': [-79.9311, 32.7765],
  'NORFOLK': [-76.2859, 36.8508],
  'BALTIMORE': [-76.6122, 39.2904],
  'MIAMI': [-80.1918, 25.7617],
  
  // Europe
  'ROTTERDAM': [4.4777, 51.9244],
  'HAMBURG': [9.9937, 53.5511],
  'ANTWERP': [4.4024, 51.2194],
  'FELIXSTOWE': [1.3540, 51.9540],
  'VALENCIA': [-0.3763, 39.4699],
  'BARCELONA': [2.1734, 41.3851],
  
  // Middle East
  'DUBAI': [55.2708, 25.2048],
  'JEBEL ALI': [55.0670, 25.0657],
  
  // Default coordinates for unknown ports
  'UNKNOWN': [0, 0]
};

const ShippingRouteMap: React.FC<ShippingRouteMapProps> = ({ shipment, className = '' }) => {
  const [selectedRoute, setSelectedRoute] = useState<'current' | 'historical'>('current');

  // Parse port information from shipment data
  const ports = useMemo((): Port[] => {
    const portList: Port[] = [];
    
    // Add port of loading
    if (shipment.portOfLoading) {
      const portName = shipment.portOfLoading.toUpperCase();
      const coordinates = findPortCoordinates(portName);
      portList.push({
        name: shipment.portOfLoading,
        code: extractPortCode(portName),
        coordinates,
        type: 'loading'
      });
    }
    
    // Add port of discharge
    if (shipment.portOfDischarge) {
      const portName = shipment.portOfDischarge.toUpperCase();
      const coordinates = findPortCoordinates(portName);
      portList.push({
        name: shipment.portOfDischarge,
        code: extractPortCode(portName),
        coordinates,
        type: 'discharge'
      });
    }
    
    return portList;
  }, [shipment]);

  // Generate route points for visualization
  const routePoints = useMemo((): RoutePoint[] => {
    if (ports.length < 2) return [];
    
    const points: RoutePoint[] = [];
    const origin = ports[0];
    const destination = ports[ports.length - 1];
    
    // Add origin point
    points.push({
      coordinates: origin.coordinates,
      status: 'completed'
    });
    
    // Generate intermediate points (simplified great circle route)
    const intermediatePoints = generateIntermediatePoints(
      origin.coordinates,
      destination.coordinates,
      5 // Number of intermediate points
    );
    
    intermediatePoints.forEach((coord, index) => {
      points.push({
        coordinates: coord,
        status: index < 2 ? 'completed' : index === 2 ? 'current' : 'upcoming'
      });
    });
    
    // Add destination point
    points.push({
      coordinates: destination.coordinates,
      status: 'upcoming'
    });
    
    return points;
  }, [ports]);

  // Calculate estimated position based on ETA/ETD
  const estimatedProgress = useMemo(() => {
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

  return (
    <Card className={`${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Route className="w-5 h-5 mr-2 text-freight-blue" />
            Shipping Route Visualization
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

          {/* Visual Route Map */}
          <div className="relative bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 min-h-[400px]">
            <SVGRouteVisualization 
              ports={ports}
              routePoints={routePoints}
              progress={estimatedProgress}
              vesselInfo={{
                name: shipment.vesselAndVoyage || '',
                containerNumber: shipment.containerNumber || '',
                status: shipment.status || 'in_transit'
              }}
            />
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

// SVG Route Visualization Component
interface SVGRouteVisualizationProps {
  ports: Port[];
  routePoints: RoutePoint[];
  progress: number;
  vesselInfo: {
    name: string;
    containerNumber: string;
    status: string;
  };
}

const SVGRouteVisualization: React.FC<SVGRouteVisualizationProps> = ({
  ports,
  routePoints,
  progress,
  vesselInfo
}) => {
  const width = 800;
  const height = 400;
  const padding = 60;

  // Calculate bounds for all points
  const allCoords = [...ports.map(p => p.coordinates), ...routePoints.map(r => r.coordinates)];
  const lngValues = allCoords.map(coord => coord[0]).filter(lng => lng !== 0);
  const latValues = allCoords.map(coord => coord[1]).filter(lat => lat !== 0);
  
  if (lngValues.length === 0 || latValues.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Route visualization not available</p>
          <p className="text-sm">Port coordinates needed</p>
        </div>
      </div>
    );
  }

  const minLng = Math.min(...lngValues);
  const maxLng = Math.max(...lngValues);
  const minLat = Math.min(...latValues);
  const maxLat = Math.max(...latValues);

  // Add padding to bounds
  const lngRange = maxLng - minLng || 10;
  const latRange = maxLat - minLat || 10;
  const boundsPadding = 0.1;

  const bounds = {
    minLng: minLng - lngRange * boundsPadding,
    maxLng: maxLng + lngRange * boundsPadding,
    minLat: minLat - latRange * boundsPadding,
    maxLat: maxLat + latRange * boundsPadding
  };

  // Convert coordinates to SVG coordinates
  const projectToSVG = (coordinates: [number, number]): [number, number] => {
    const [lng, lat] = coordinates;
    if (lng === 0 && lat === 0) return [width / 2, height / 2];
    
    const x = padding + ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * (width - 2 * padding);
    const y = height - padding - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * (height - 2 * padding);
    return [x, y];
  };

  // Convert ports to SVG coordinates
  const svgPorts = ports.map(port => ({
    ...port,
    svgCoordinates: projectToSVG(port.coordinates)
  }));

  // Convert route points to SVG coordinates
  const svgRoutePoints = routePoints.map(point => ({
    ...point,
    svgCoordinates: projectToSVG(point.coordinates)
  }));

  // Calculate vessel position based on progress
  const vesselPosition = useMemo(() => {
    if (svgRoutePoints.length < 2) return svgRoutePoints[0]?.svgCoordinates || [width / 2, height / 2];
    
    const progressIndex = (progress / 100) * (svgRoutePoints.length - 1);
    const lowerIndex = Math.floor(progressIndex);
    const upperIndex = Math.ceil(progressIndex);
    const t = progressIndex - lowerIndex;
    
    if (lowerIndex >= svgRoutePoints.length - 1) {
      return svgRoutePoints[svgRoutePoints.length - 1].svgCoordinates;
    }
    
    const point1 = svgRoutePoints[lowerIndex].svgCoordinates;
    const point2 = svgRoutePoints[upperIndex].svgCoordinates;
    
    return [
      point1[0] + (point2[0] - point1[0]) * t,
      point1[1] + (point2[1] - point1[1]) * t
    ];
  }, [svgRoutePoints, progress]);

  return (
    <svg width={width} height={height} className="w-full h-full">
      {/* Background grid */}
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e5e7eb" strokeWidth="1" opacity="0.3"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      
      {/* Route line */}
      {svgRoutePoints.length > 1 && (
        <g>
          {/* Full route path (light) */}
          <polyline
            points={svgRoutePoints.map(p => `${p.svgCoordinates[0]},${p.svgCoordinates[1]}`).join(' ')}
            fill="none"
            stroke="#cbd5e1"
            strokeWidth="3"
            strokeDasharray="5,5"
          />
          
          {/* Completed route path (highlighted) */}
          {progress > 0 && (
            <polyline
              points={svgRoutePoints
                .slice(0, Math.floor((progress / 100) * (svgRoutePoints.length - 1)) + 2)
                .map(p => `${p.svgCoordinates[0]},${p.svgCoordinates[1]}`).join(' ')}
              fill="none"
              stroke="#2563eb"
              strokeWidth="4"
            />
          )}
        </g>
      )}
      
      {/* Ports */}
      {svgPorts.map((port, index) => (
        <g key={index}>
          <circle
            cx={port.svgCoordinates[0]}
            cy={port.svgCoordinates[1]}
            r="8"
            fill={port.type === 'loading' ? '#2563eb' : '#dc2626'}
            stroke="white"
            strokeWidth="2"
          />
          <text
            x={port.svgCoordinates[0]}
            y={port.svgCoordinates[1] - 15}
            textAnchor="middle"
            className="text-xs font-medium fill-gray-700"
          >
            {port.name}
          </text>
        </g>
      ))}
      
      {/* Vessel position */}
      {progress > 0 && progress < 100 && (
        <g>
          <circle
            cx={vesselPosition[0]}
            cy={vesselPosition[1]}
            r="6"
            fill="#f97316"
            stroke="white"
            strokeWidth="2"
          >
            <animate attributeName="r" values="6;8;6" dur="2s" repeatCount="indefinite" />
          </circle>
          <text
            x={vesselPosition[0]}
            y={vesselPosition[1] - 15}
            textAnchor="middle"
            className="text-xs font-medium fill-orange-600"
          >
            🚢 Vessel
          </text>
        </g>
      )}
      
      {/* Legend */}
      <g transform={`translate(${padding}, ${height - 60})`}>
        <rect x="-10" y="-10" width="160" height="50" fill="white" fillOpacity="0.9" rx="5" />
        <circle cx="0" cy="0" r="4" fill="#2563eb" />
        <text x="10" y="4" className="text-xs fill-gray-700">Loading Port</text>
        <circle cx="0" cy="15" r="4" fill="#dc2626" />
        <text x="10" y="19" className="text-xs fill-gray-700">Discharge Port</text>
        <circle cx="0" cy="30" r="4" fill="#f97316" />
        <text x="10" y="34" className="text-xs fill-gray-700">Vessel Position</text>
      </g>
    </svg>
  );
};

// Helper functions
function findPortCoordinates(portName: string): [number, number] {
  const cleanPortName = portName.toUpperCase().trim();
  
  // Try exact match first
  if (MAJOR_PORTS[cleanPortName]) {
    return MAJOR_PORTS[cleanPortName];
  }
  
  // Try partial matches
  for (const [knownPort, coordinates] of Object.entries(MAJOR_PORTS)) {
    if (cleanPortName.includes(knownPort) || knownPort.includes(cleanPortName)) {
      return coordinates;
    }
  }
  
  // Return default coordinates
  return MAJOR_PORTS.UNKNOWN;
}

function extractPortCode(portName: string): string {
  // Extract port code from port name
  const match = portName.match(/\b([A-Z]{3,5})\b/);
  return match ? match[1] : portName.substring(0, 3).toUpperCase();
}

function generateIntermediatePoints(
  start: [number, number],
  end: [number, number],
  numPoints: number
): [number, number][] {
  const points: [number, number][] = [];
  
  for (let i = 1; i <= numPoints; i++) {
    const t = i / (numPoints + 1);
    const lng = start[0] + (end[0] - start[0]) * t;
    const lat = start[1] + (end[1] - start[1]) * t;
    points.push([lng, lat]);
  }
  
  return points;
}

export default ShippingRouteMap;