import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Ship, FileText, BarChart3, FileUp, Eye, Truck, Plane } from "lucide-react";
import freightclearLogo from "@assets/cropped-freigthclear_alt_logo2_1751903859339.png";

export default function Landing() {
  return (
    <div className="min-h-screen gradient-secondary">
      {/* Flowing Wave Background */}
      <div className="wave-background"></div>
      
      {/* Header */}
      <header className="glass-effect shadow-lg border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <img src={freightclearLogo} alt="Freightclear Logo" className="h-10" />
              <div>
                <h1 className="text-xl font-bold text-freight-dark">Freightclear Workflows</h1>
                <p className="text-sm text-teal">Streamlined Import Management</p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button 
                onClick={() => window.location.href = "/register"}
                className="gradient-accent hover-glow text-white border-0"
              >
                Get Started
              </Button>
              <Button 
                onClick={() => window.location.href = "/api/login"}
                variant="outline"
                className="border-teal text-teal hover:bg-teal hover:text-white"
              >
                Sign In
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-freight-dark mb-6">
            <span className="gradient-text">Freightclear Workflows</span>
          </h1>
          <p className="text-xl text-gray-700 mb-6 max-w-4xl mx-auto">
            Intelligent document processing and shipment management platform. 
            Upload documents, create shipments, and track your freight operations efficiently.
          </p>
          <p className="text-sm text-gray-600 mb-8 max-w-2xl mx-auto">
            Create your free account to get started with professional freight management tools. 
            Registration takes just 2 minutes and includes a free trial period.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              onClick={() => window.location.href = "/register"}
              size="lg"
              className="btn-primary px-12 py-4 text-lg"
            >
              Create Free Account
            </Button>
            <Button 
              onClick={() => window.location.href = "/demo"}
              size="lg"
              variant="outline"
              className="border-freight-orange text-freight-orange hover:bg-freight-orange hover:text-white px-12 py-4 text-lg font-semibold"
            >
              Try Demo
            </Button>
          </div>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
          <Card className="text-center gradient-card hover-glow border-0">
            <CardContent className="p-8">
              <div className="bg-teal/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-teal" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-3 text-lg">Document Processing</h3>
              <p className="text-gray-600">Upload and process freight documents with intelligent OCR extraction</p>
            </CardContent>
          </Card>

          <Card className="text-center gradient-card hover-glow border-0">
            <CardContent className="p-8">
              <div className="bg-neon-green/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Ship className="w-8 h-8 text-neon-green" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-3 text-lg">Shipment Management</h3>
              <p className="text-gray-600">Track and manage air, ocean, and trucking shipments in one platform</p>
            </CardContent>
          </Card>

          <Card className="text-center gradient-card hover-glow border-0">
            <CardContent className="p-8">
              <div className="bg-powder-blue/20 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-powder-blue" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-3 text-lg">Analytics Dashboard</h3>
              <p className="text-gray-600">Monitor performance with comprehensive reports and insights</p>
            </CardContent>
          </Card>
        </div>

        {/* Application Features */}
        <div className="gradient-card rounded-xl shadow-lg border-0 p-8 mb-12 hover-glow">
          <h2 className="text-3xl font-bold gradient-text mb-8 text-center">
            Platform Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-freight-orange/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileUp className="w-8 h-8 text-freight-orange" />
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



        {/* Call to Action */}
        <div className="text-center gradient-primary rounded-xl p-12 hover-glow">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to streamline your freight operations?
          </h2>
          <p className="text-xl text-white/90 mb-6">
            Join freight professionals who trust Freightclear Workflows for their shipping needs.
          </p>
          <p className="text-sm text-white/80 mb-8">
            Click below to create your account and start your free trial. You'll be guided through a secure registration process.
          </p>
          <Button 
            onClick={() => window.location.href = "/register"}
            size="lg"
            className="bg-white text-teal hover:bg-white/90 px-12 py-4 text-lg font-semibold border-0"
          >
            Create Free Account
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