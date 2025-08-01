import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Settings, Key, ExternalLink, Check, AlertCircle } from 'lucide-react';

interface GoogleMapsConfigProps {
  onApiKeySet?: () => void;
  className?: string;
}

const GoogleMapsConfig: React.FC<GoogleMapsConfigProps> = ({ onApiKeySet, className = '' }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const { toast } = useToast();

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Google Maps API key",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      toast({
        title: "Invalid API Key Format",
        description: "Google Maps API keys typically start with 'AIza'",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      // Store the API key in localStorage for now
      // In a production app, you'd want to securely store this server-side
      localStorage.setItem('GOOGLE_MAPS_API_KEY', apiKey);
      
      // Set the environment variable for the current session
      (window as any).VITE_GOOGLE_MAPS_API_KEY = apiKey;
      
      toast({
        title: "API Key Saved",
        description: "Google Maps API key has been configured successfully",
      });
      
      // Call the callback if provided
      if (onApiKeySet) {
        onApiKeySet();
      }
      
      // Refresh the page to apply the new API key
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      toast({
        title: "Error Saving API Key",
        description: "Failed to save the Google Maps API key",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('GOOGLE_MAPS_API_KEY');
    setApiKey('');
    toast({
      title: "API Key Cleared",
      description: "Google Maps API key has been removed",
    });
  };

  // Check if API key is already stored
  const storedApiKey = localStorage.getItem('GOOGLE_MAPS_API_KEY');

  return (
    <Card className={`border-freight-blue/20 ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <Settings className="w-5 h-5 mr-2 text-freight-blue" />
          Google Maps Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {storedApiKey ? (
          <Alert className="border-green-200 bg-green-50">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Google Maps API key is configured and active.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertCircle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-yellow-800">
              Google Maps API key is required to display interactive route maps.
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-3">
          <div>
            <Label htmlFor="google-api-key" className="text-sm font-medium">
              Google Maps API Key
            </Label>
            <div className="flex space-x-2 mt-1">
              <div className="relative flex-1">
                <Key className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                <Input
                  id="google-api-key"
                  type="password"
                  placeholder="Enter your Google Maps API key (AIza...)"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button 
                onClick={handleSaveApiKey}
                disabled={isLoading}
                className="bg-freight-blue hover:bg-freight-blue/90"
              >
                {isLoading ? (
                  <div className="w-4 h-4 animate-spin border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>

          {storedApiKey && (
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-md">
              <span className="text-sm text-gray-600">
                API Key: ••••••••••••••••{storedApiKey.slice(-4)}
              </span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleClearApiKey}
                className="text-red-600 hover:text-red-700"
              >
                Clear
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full"
          >
            {showInstructions ? 'Hide' : 'Show'} Setup Instructions
          </Button>

          {showInstructions && (
            <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-semibold text-freight-blue">How to get a Google Maps API Key:</h4>
              <ol className="space-y-2 text-sm">
                <li className="flex items-start">
                  <span className="font-medium text-freight-blue mr-2">1.</span>
                  <div>
                    Go to the <a 
                      href="https://console.cloud.google.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-freight-blue hover:underline inline-flex items-center"
                    >
                      Google Cloud Console <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-freight-blue mr-2">2.</span>
                  <span>Create a new project or select an existing one</span>
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-freight-blue mr-2">3.</span>
                  <span>Enable the "Maps JavaScript API" in the API Library</span>
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-freight-blue mr-2">4.</span>
                  <span>Go to "Credentials" and create an API key</span>
                </li>
                <li className="flex items-start">
                  <span className="font-medium text-freight-blue mr-2">5.</span>
                  <span>Copy the API key and paste it above</span>
                </li>
              </ol>
              
              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs text-yellow-800">
                  <strong>Note:</strong> For production use, make sure to restrict your API key to specific domains 
                  and enable only the necessary APIs to maintain security.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default GoogleMapsConfig;