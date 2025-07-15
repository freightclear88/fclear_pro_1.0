import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, TestTube, User } from "lucide-react";

export default function Demo() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Demo Mode Banner */}
        <Card className="mb-8 border-l-4 border-l-amber-500 bg-amber-50">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 rounded-full bg-amber-100">
                <TestTube className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-amber-800 mb-2">
                  Development Demo Mode Active
                </h2>
                <p className="text-amber-700">
                  You're viewing the application in demo mode with a test user account. 
                  This bypasses authentication to let you explore the subscription features.
                </p>
              </div>
              <Badge variant="outline" className="border-amber-500 text-amber-700">
                TEST MODE
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Demo User Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <User className="w-5 h-5" />
              <span>Demo User Profile</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-600">Name</label>
                <p className="text-freight-dark">Demo User</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Email</label>
                <p className="text-freight-dark">demo@freightclear.com</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Company</label>
                <p className="text-freight-dark">Demo Logistics Inc.</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-600">Plan</label>
                <p className="text-freight-dark">Free Trial (14 days)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Available Features */}
        <Card>
          <CardHeader>
            <CardTitle>Available Features to Test</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button 
                onClick={() => window.location.href = '/shipments'}
                className="btn-primary h-12"
              >
                📦 Shipments Management
              </Button>
              <Button 
                onClick={() => window.location.href = '/payment'}
                className="btn-primary h-12"
              >
                💳 Subscription Plans
              </Button>
              <Button 
                onClick={() => window.location.href = '/admin'}
                className="btn-secondary h-12"
              >
                ⚙️ Admin Dashboard
              </Button>
              <Button 
                onClick={() => window.location.href = '/profile'}
                className="btn-secondary h-12"
              >
                👤 User Profile
              </Button>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-medium text-blue-800">Testing Notes</h4>
                  <ul className="text-sm text-blue-700 mt-2 space-y-1">
                    <li>• The subscription system shows Free and Pro plans ($175/month)</li>
                    <li>• Demo user starts with Free plan limits (5 shipments, 20 documents)</li>
                    <li>• You can test plan upgrades and payment flow (no actual charges)</li>
                    <li>• All features are accessible in this demo mode</li>
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}