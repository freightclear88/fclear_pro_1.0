import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, FileText, BarChart3 } from "lucide-react";
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
          <h1 className="text-4xl font-bold text-freight-dark mb-4">
            Make Imports to the USA Fast and Easy
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Freight Flow by Freightclear is your productivity app for streamlined freight management 
            with OCR document intelligence and automatic data extraction.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-freight-orange hover:bg-freight-orange/90 text-white px-8 py-3 text-lg"
          >
            Get Started
          </Button>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Ship className="w-6 h-6 text-freight-blue" />
                <span>Shipment Management</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Track and manage all your shipments in one place with real-time status updates 
                and comprehensive documentation.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-6 h-6 text-freight-green" />
                <span>OCR Document Intelligence</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Automatically extract data from Bills of Lading, Commercial Invoices, and other 
                freight documents using advanced OCR technology.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="w-6 h-6 text-freight-orange" />
                <span>Analytics & Reporting</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">
                Get insights into your freight operations with detailed analytics and 
                customizable reports for better decision making.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
          <h2 className="text-2xl font-bold text-freight-dark mb-4">
            Ready to Streamline Your Freight Operations?
          </h2>
          <p className="text-gray-600 mb-6">
            Join freight professionals who trust Freightclear for their import operations.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-freight-blue hover:bg-freight-blue/90 text-white px-8 py-3"
          >
            Start Your Free Trial
          </Button>
        </div>
      </main>
    </div>
  );
}
