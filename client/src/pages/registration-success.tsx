import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

export default function RegistrationSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-green-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">
            Registration Successful!
          </CardTitle>
          <CardDescription className="text-gray-600 dark:text-gray-300">
            Your account information has been received and is being processed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-sm text-gray-600 dark:text-gray-400">
            <p className="mb-4">
              Thank you for registering with FreightClear Workflows. Your registration details have been saved successfully.
            </p>
            <p className="mb-6">
              To complete your account setup and start using our freight management platform, please proceed to sign in.
            </p>
          </div>
          
          <div className="space-y-3">
            <Link to="/login">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                Continue to Sign In
              </Button>
            </Link>
            
            <Link to="/">
              <Button variant="outline" className="w-full">
                Return to Home
              </Button>
            </Link>
          </div>
          
          <div className="text-xs text-center text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            Need help? Contact our support team for assistance.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}