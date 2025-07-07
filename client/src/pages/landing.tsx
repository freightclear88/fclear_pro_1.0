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
          <h1 className="text-5xl font-bold text-freight-dark mb-6">
            USA Imports Made Simple!
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto">
            Freight Flow is a digital customs brokerage service for importing freight into the United States. 
            We make imports and customs clearance simple by offering a streamlined process for shipping, 
            clearing and delivering your imports to the USA in one seamless transaction.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-freight-orange hover:bg-freight-orange/90 text-white px-12 py-4 text-lg font-semibold"
          >
            Clear My Freight Now
          </Button>
        </div>

        {/* Key Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="p-6">
              <div className="bg-freight-blue/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Ship className="w-8 h-8 text-freight-blue" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-2">Fast Customs Clearance</h3>
              <p className="text-sm text-gray-600">Streamlined customs processing for faster imports</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="bg-freight-green/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-freight-green" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-2">Fast ISF Filing</h3>
              <p className="text-sm text-gray-600">Quick Importer Security Filing processing</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="bg-freight-orange/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <BarChart3 className="w-8 h-8 text-freight-orange" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-2">Streamlined Workflows</h3>
              <p className="text-sm text-gray-600">Digital solutions for import efficiency</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="bg-freight-blue/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <Ship className="w-8 h-8 text-freight-blue" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-2">Last Mile Delivery</h3>
              <p className="text-sm text-gray-600">Complete delivery solutions to your door</p>
            </CardContent>
          </Card>

          <Card className="text-center">
            <CardContent className="p-6">
              <div className="bg-freight-green/10 p-4 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                <FileText className="w-8 h-8 text-freight-green" />
              </div>
              <h3 className="font-semibold text-freight-dark mb-2">Experts on Call</h3>
              <p className="text-sm text-gray-600">Professional support when you need it</p>
            </CardContent>
          </Card>
        </div>

        {/* Services Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customs Clearance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Customs Clearance USA for importers of foreign manufactured products.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Importer Compliance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Customs compliance solutions for USA importers. Brokers on call to advise.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Freight Solutions</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                International shipping solutions in air and ocean freight. Get a quote today.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Customs Bonds</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 text-sm">
                Single entry and continuous bonds for USA importers. Apply today for savings.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Process Steps */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-12">
          <h2 className="text-3xl font-bold text-freight-dark mb-8 text-center">
            Customs Clearance in 3 Easy Steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-freight-orange text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Fill out Quote Form</h3>
              <p className="text-gray-600 text-sm">
                Enter your shipment details and upload your documents in our easy to use quote request form.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-freight-blue text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Agent Response</h3>
              <p className="text-gray-600 text-sm">
                Our import agents will respond to your ticket with expert import rates and info on your pending customs clearance.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-freight-green text-white rounded-full w-12 h-12 flex items-center justify-center text-xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-lg font-semibold text-freight-dark mb-2">Clearance Process</h3>
              <p className="text-gray-600 text-sm">
                Freightclear sets up your importer profile, processes your customs documents and transmits your shipment entry to U.S. Customs.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-freight-blue rounded-xl shadow-sm p-8 text-center text-white">
          <h2 className="text-3xl font-bold mb-4">
            Ready to Streamline Your USA Imports?
          </h2>
          <p className="text-blue-100 mb-6 text-lg">
            Get customs clearance rates and service from our import agents on call.
          </p>
          <Button 
            onClick={() => window.location.href = "/api/login"}
            size="lg"
            className="bg-freight-orange hover:bg-freight-orange/90 text-white px-12 py-4 text-lg font-semibold"
          >
            Clear My Freight
          </Button>
        </div>
      </main>
    </div>
  );
}
