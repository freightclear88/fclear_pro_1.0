import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Eye, Copy, Edit, FileText } from "lucide-react";
import type { Shipment } from "@shared/schema";
import ShipmentHtmlPage from "./ShipmentHtmlPage";

interface ShipmentTableProps {
  shipments: Shipment[];
  onViewShipment: (shipment: Shipment) => void;
}

export default function ShipmentTable({ shipments, onViewShipment }: ShipmentTableProps) {
  const { toast } = useToast();
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [isHtmlPageOpen, setIsHtmlPageOpen] = useState(false);

  const handleViewHtmlPage = (shipment: Shipment) => {
    setSelectedShipment(shipment);
    setIsHtmlPageOpen(true);
  };

  const handleCopyShipment = async (shipment: Shipment) => {
    try {
      const shipmentData = `
Shipment ID: ${shipment.shipmentId}
Container: ${shipment.containerNumber || "N/A"}
Bill of Lading: ${shipment.billOfLading || "N/A"}
Vessel: ${shipment.vessel || "N/A"}
Origin: ${shipment.origin}
Destination: ${shipment.destination}
Status: ${shipment.status}
      `.trim();

      await navigator.clipboard.writeText(shipmentData);
      toast({
        title: "Copied",
        description: "Shipment data copied to clipboard",
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy shipment data",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "Pending" },
      in_transit: { variant: "default" as const, label: "In Transit" },
      arrived: { variant: "default" as const, label: "Arrived", className: "bg-freight-green text-white" },
      delivered: { variant: "default" as const, label: "Delivered", className: "bg-freight-green text-white" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    
    return (
      <Badge variant={config.variant} className={config.className}>
        {config.label}
      </Badge>
    );
  };

  if (shipments.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No shipments found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Shipment ID</TableHead>
            <TableHead>Origin</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Container</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {shipments.map((shipment) => (
            <TableRow key={shipment.id} className="hover:bg-gray-50">
              <TableCell>
                <div className="font-medium text-freight-dark">{shipment.shipmentId}</div>
                <div className="text-sm text-gray-500">
                  Created: {new Date(shipment.createdAt!).toLocaleDateString()}
                </div>
              </TableCell>
              <TableCell>
                <div className="font-medium text-freight-dark">{shipment.origin}</div>
                {shipment.originPort && (
                  <div className="text-sm text-gray-500">Port: {shipment.originPort}</div>
                )}
              </TableCell>
              <TableCell>
                <div className="font-medium text-freight-dark">{shipment.destination}</div>
                {shipment.destinationPort && (
                  <div className="text-sm text-gray-500">Port: {shipment.destinationPort}</div>
                )}
              </TableCell>
              <TableCell>
                {getStatusBadge(shipment.status)}
              </TableCell>
              <TableCell>
                <span className="font-medium">
                  {shipment.containerNumber || "N/A"}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onViewShipment(shipment)}
                    className="text-freight-blue hover:text-freight-dark"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewHtmlPage(shipment)}
                    className="text-freight-green hover:text-freight-dark"
                    title="View HTML Page"
                  >
                    <FileText className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyShipment(shipment)}
                    className="text-freight-orange hover:text-freight-dark"
                    title="Copy Data"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {/* HTML Page Dialog */}
      {selectedShipment && (
        <ShipmentHtmlPage
          shipment={selectedShipment}
          isOpen={isHtmlPageOpen}
          onClose={() => setIsHtmlPageOpen(false)}
        />
      )}
    </div>
  );
}
