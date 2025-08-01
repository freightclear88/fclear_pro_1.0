import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, AlertTriangle, ArrowRight } from "lucide-react";
import { Link } from "wouter";

interface UpgradePromptProps {
  type: 'shipment' | 'document' | 'general';
  current: number;
  max: number;
  variant?: 'warning' | 'blocked';
}

export function UpgradePrompt({ type, current, max, variant = 'warning' }: UpgradePromptProps) {
  const isAtLimit = current >= max;
  const isNearLimit = current >= max * 0.8; // 80% of limit reached
  
  if (!isNearLimit && variant === 'warning') {
    return null;
  }

  const getTitle = () => {
    if (variant === 'blocked') {
      return `${type === 'shipment' ? 'Shipment' : 'Document'} Limit Reached`;
    }
    return `Approaching ${type === 'shipment' ? 'Shipment' : 'Document'} Limit`;
  };

  const getMessage = () => {
    if (variant === 'blocked') {
      return `You've reached your Free plan limit of ${max} ${type}s. Upgrade to continue creating ${type}s.`;
    }
    return `You're using ${current} of ${max} ${type}s on your Free plan. Consider upgrading for higher limits.`;
  };

  const cardStyle = variant === 'blocked' 
    ? "border-red-200 bg-gradient-to-br from-red-50 to-orange-50"
    : "border-freight-orange/20 bg-gradient-to-br from-orange-50 to-yellow-50";

  const iconColor = variant === 'blocked' ? "text-red-500" : "text-freight-orange";

  return (
    <Card className={`${cardStyle} mb-4`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className={`w-5 h-5 mt-0.5 ${iconColor} flex-shrink-0`} />
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 mb-1">{getTitle()}</h4>
            <p className="text-sm text-gray-600 mb-3">{getMessage()}</p>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Link href="/subscription">
                <Button size="sm" className="bg-gradient-to-r from-freight-orange to-freight-red hover:from-freight-orange/90 hover:to-freight-red/90 text-white">
                  <Crown className="w-4 h-4 mr-2" />
                  Upgrade to Starter
                </Button>
              </Link>
              
              <div className="text-xs text-gray-500 pt-2 sm:pt-1">
                Starter Plan: 20 shipments, 300 documents • $49/month
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Component for blocked state when limit is exceeded
export function LimitExceededDialog({ type }: { type: 'shipment' | 'document' }) {
  return (
    <Card className="max-w-md mx-auto border-red-200 bg-gradient-to-br from-red-50 to-orange-50">
      <CardContent className="p-6 text-center space-y-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto" />
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">
            {type === 'shipment' ? 'Shipment' : 'Document'} Limit Reached
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Your Free plan is limited to {type === 'shipment' ? '3 shipments' : '9 documents'} per month. 
            Upgrade to continue adding {type}s to your account.
          </p>
          <div className="space-y-3">
            <Link href="/subscription">
              <Button className="w-full bg-gradient-to-r from-freight-orange to-freight-red hover:from-freight-orange/90 hover:to-freight-red/90 text-white">
                <Crown className="w-4 h-4 mr-2" />
                Upgrade to Starter Plan
              </Button>
            </Link>
            <div className="grid grid-cols-1 gap-2 text-xs text-gray-600">
              <div className="p-2 bg-white rounded border">
                <strong>Starter Plan - $49/month</strong><br />
                20 shipments • 300 documents • Chat support
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}