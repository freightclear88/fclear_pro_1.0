import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Crown, MessageCircle, AlertTriangle, ExternalLink, Shield } from "lucide-react";
import TalkJSChat from "@/components/TalkJSChat";
import { Link } from "wouter";

export default function Chat() {
  const { user } = useAuth();

  // Check subscription access
  const { data: userAccess } = useQuery({
    queryKey: ["/api/subscription/access"],
    enabled: !!user,
  });

  // Show upgrade prompt for Free users
  if (userAccess && !userAccess.hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-freight-orange to-freight-red rounded-full flex items-center justify-center">
            <Crown className="w-8 h-8 text-white" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-gray-900">Chat Support Access Required</h1>
            <p className="text-lg text-gray-600">
              Chat support is available for Starter and Pro subscribers
            </p>
          </div>

          <Card className="max-w-md mx-auto border-freight-orange/20 bg-gradient-to-br from-orange-50 to-red-50">
            <CardContent className="p-6 text-center space-y-4">
              <AlertTriangle className="w-12 h-12 text-freight-orange mx-auto" />
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Free Plan Limitations</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Your current Free plan includes basic shipment management but doesn't include chat support access.
                </p>
                <Link href="/subscription">
                  <Button className="w-full bg-gradient-to-r from-freight-orange to-freight-red hover:from-freight-orange/90 hover:to-freight-red/90 text-white">
                    <Crown className="w-4 h-4 mr-2" />
                    Upgrade to Starter Plan
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto text-sm">
            <div className="bg-white p-4 rounded-lg border border-green-200">
              <h4 className="font-medium text-green-800 mb-2">✓ Starter Plan ($49/month)</h4>
              <ul className="space-y-1 text-green-700">
                <li>• 20 shipments per month</li>
                <li>• 300 documents</li>
                <li>• <strong>Chat support access</strong></li>
                <li>• All basic features</li>
              </ul>
            </div>
            <div className="bg-white p-4 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-800 mb-2">✓ Pro Plan ($175/month)</h4>
              <ul className="space-y-1 text-blue-700">
                <li>• Unlimited shipments</li>
                <li>• Unlimited documents</li>
                <li>• <strong>Priority chat support</strong></li>
                <li>• All premium features</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-freight-blue to-freight-green rounded-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Chat Support</h1>
              <p className="text-gray-600">Get instant help with your shipments and freight management</p>
            </div>
          </div>
          
          {userAccess?.subscriptionStatus && (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <Shield className="w-3 h-3 mr-1" />
              {userAccess.subscriptionStatus === 'active' ? 'Pro Support' : 'Support Access'}
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Interface */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <MessageCircle className="w-5 h-5" />
                Live Support Chat
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TalkJSChat className="h-[600px]" />
            </CardContent>
          </Card>
        </div>

        {/* Help & Resources */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Help</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p className="font-medium text-gray-700">Common Questions:</p>
                <ul className="space-y-1 text-gray-600">
                  <li>• How to upload documents</li>
                  <li>• Tracking shipment status</li>
                  <li>• ISF filing requirements</li>
                  <li>• XML integration setup</li>
                  <li>• Subscription management</li>
                </ul>
              </div>
              
              <div className="pt-3 border-t">
                <p className="text-xs text-gray-500 mb-2">Response times:</p>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Starter Plan</span>
                    <span className="font-medium">~2 hours</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pro Plan</span>
                    <span className="font-medium text-green-600">~30 minutes</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <ExternalLink className="w-8 h-8 text-blue-600 mx-auto" />
                <h3 className="font-medium text-blue-900">Need immediate help?</h3>
                <p className="text-sm text-blue-700">
                  For urgent shipping issues, contact our priority support line
                </p>
                <Button size="sm" variant="outline" className="text-blue-700 border-blue-300 hover:bg-blue-100">
                  Contact Priority Support
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}