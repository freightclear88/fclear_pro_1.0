import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ship, Plane, Truck, FileText, CheckCircle, Clock } from "lucide-react";

export default function TestDataInfo() {
  return (
    <Card className="mb-6 border-freight-blue/20 bg-freight-blue/5">
      <CardHeader>
        <CardTitle className="text-freight-blue flex items-center">
          <CheckCircle className="w-5 h-5 mr-2" />
          Test Environment Ready
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Sample data has been created to demonstrate the freight management workflow:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
              <Plane className="w-6 h-6 text-freight-orange" />
              <div>
                <div className="font-medium text-sm">Air Freight</div>
                <div className="text-xs text-gray-500">AIR-2025-001</div>
                <Badge variant="secondary" className="text-xs mt-1">In Transit</Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
              <Ship className="w-6 h-6 text-freight-blue" />
              <div>
                <div className="font-medium text-sm">Ocean Freight</div>
                <div className="text-xs text-gray-500">SEA-2025-002</div>
                <Badge variant="default" className="bg-freight-green text-white text-xs mt-1">Arrived</Badge>
              </div>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border">
              <Truck className="w-6 h-6 text-freight-green" />
              <div>
                <div className="font-medium text-sm">Trucking</div>
                <div className="text-xs text-gray-500">TRK-2025-003</div>
                <Badge variant="default" className="bg-freight-green text-white text-xs mt-1">Delivered</Badge>
              </div>
            </div>
          </div>
          
          <div className="pt-3 border-t border-gray-200">
            <h4 className="font-medium text-sm mb-2 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Document Types Tested
            </h4>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">Airway Bill</Badge>
              <Badge variant="outline" className="text-xs">Bill of Lading</Badge>
              <Badge variant="outline" className="text-xs">Commercial Invoice</Badge>
              <Badge variant="outline" className="text-xs">ISF Data Sheet</Badge>
            </div>
          </div>
          
          <div className="text-xs text-gray-500 mt-3">
            💡 Try uploading your own documents or create new shipments to test the workflow!
          </div>
        </div>
      </CardContent>
    </Card>
  );
}