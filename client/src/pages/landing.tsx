import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, FileText, BarChart3, Upload, Eye, Truck, Plane } from "lucide-react";
import freightclearLogo from "@assets/cropped-freigthclear_alt_logo2_1751903859339.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-freight-gray">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <img src={freightclearLogo} alt="Freightclear Logo" className="h-10" />
              <div>
                <h1 className="text-xl font-bold text-freight-dark">Freight Flow</h1>
                <p className="text-sm text-gray-500">by Freightclear</p>
              </div>
            </div>
            <Button 
              onClick={() => window.location.href = "/api/login"}
              className="bg-freight-orange hover:bg-freight-orange/90 text-white"
            >
              Sign In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-freight-dark mb-6">
            Freight Flow
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto">
            Intelligent document processing and shipment management platform. 
            Upload documents, create shipments, and track your freight operations efficiently.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-freight-orange hover:bg-freight-orange/90 text-white px-12 py-4 text-lg font-semibold"
          >
            Get Started
          </Button>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="text-center">
            <CardContent className="p-8">
              <div className="bg-freight-blue/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-freight-blue" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-3 text-lg">Document Processing</h3>
              <p className="text-gray-600">Upload and process freight documents with intelligent OCR extraction</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-8">
              <div className="bg-freight-green/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Ship className="w-8 h-8 text-freight-green" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-3 text-lg">Shipment Management</h3>
              <p className="text-gray-600">Track and manage air, ocean, and trucking shipments in one platform</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-8">
              <div className="bg-freight-orange/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-freight-orange" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-3 text-lg">Analytics Dashboard</h3>
              <p className="text-gray-600">Monitor performance with comprehensive reports and insights</p>
            </CardContent>
          </Card>
        </div>

        {/* Application Features */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-12">
          <h2 className="text-3xl font-bold text-freight-dark mb-8 text-center">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-freight-orange/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Upload className="w-8 h-8 text-freight-orange" />
              </div>
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Document Upload</h3>
              <p className="text-gray-600 text-sm">
                Drag and drop Bills of Lading, Commercial Invoices, and other shipping documents for instant processing.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-freight-blue/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-freight-blue" />
              </div>
              <h3 className="text-lg font-semibold text-freight-dark mb-2">OCR Data Extraction</h3>
              <p className="text-gray-600 text-sm">
                Automatically extract shipping data from documents using advanced OCR technology.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-freight-green/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Eye className="w-8 h-8 text-freight-green" />
              </div>
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Real-time Tracking</h3>
              <p className="text-gray-600 text-sm">
                Monitor shipment status and get updates on your freight movements across all transport modes.
              </p>
            </div>

          </div>
        </div>

        {/* Transport Modes */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <Ship className="w-12 h-12 text-freight-blue mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Ocean Shipments</h3>
              <p className="text-gray-600 text-sm">
                Full container and LCL shipments with container tracking and vessel schedules.
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <Plane className="w-12 h-12 text-freight-green mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Air Cargo</h3>
              <p className="text-gray-600 text-sm">
                Express and standard air freight with flight tracking and delivery confirmation.
              </p>
            </CardContent>
          </Card>
          
          <Card className="text-center hover:shadow-lg transition-shadow">
            <CardContent className="p-6">
              <Truck className="w-12 h-12 text-freight-orange mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Ground Transport</h3>
              <p className="text-gray-600 text-sm">
                Trucking and intermodal services with GPS tracking and delivery updates.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Call to Action */}
        <div className="text-center bg-gradient-to-r from-freight-blue to-freight-dark rounded-xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to streamline your freight operations?
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Join freight professionals who trust Freight Flow for their shipping needs.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-freight-orange hover:bg-freight-orange/90 text-white px-12 py-4 text-lg font-semibold"
          >
            Start Managing Your Freight
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-freight-dark text-white py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <img src={freightclearLogo} alt="Freightclear Logo" className="h-8 filter brightness-0 invert" />
            <span className="text-lg font-semibold">Freight Flow</span>
          </div>
          <p className="text-gray-400">
            Professional freight management platform by Freightclear
          </p>
        </div>
      </footer>
    </div>
  );
}