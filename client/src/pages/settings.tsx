import React from 'react';
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import GoogleMapsConfig from '@/components/GoogleMapsConfig';
import { Settings as SettingsIcon, User, Map, Bell, Shield, Database } from 'lucide-react';

export default function Settings() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (!isAuthenticated && !isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-96">
          <CardContent className="pt-6 text-center">
            <p className="text-gray-600 mb-4">Please log in to access settings</p>
            <Button onClick={() => window.location.href = "/api/login"}>
              Log In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-freight-blue border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-8">
      {/* Header */}
      <div className="flex items-center space-x-3 mb-8">
        <SettingsIcon className="w-8 h-8 text-freight-blue" />
        <div>
          <h1 className="text-3xl font-bold text-freight-dark">Settings</h1>
          <p className="text-gray-600 mt-1">Manage your account and application preferences</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle className="text-lg">Settings Menu</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left"
                onClick={() => document.getElementById('account-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <User className="w-4 h-4 mr-3" />
                Account Information
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left"
                onClick={() => document.getElementById('maps-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Map className="w-4 h-4 mr-3" />
                Maps & Visualization
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left"
                onClick={() => document.getElementById('notifications-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Bell className="w-4 h-4 mr-3" />
                Notifications
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left"
                onClick={() => document.getElementById('data-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Database className="w-4 h-4 mr-3" />
                Data & Export
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-start text-left"
                onClick={() => document.getElementById('security-section')?.scrollIntoView({ behavior: 'smooth' })}
              >
                <Shield className="w-4 h-4 mr-3" />
                Security
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Account Information */}
          <section id="account-section">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="w-5 h-5 mr-2 text-freight-blue" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Email</label>
                    <p className="mt-1 text-sm text-gray-900">{user?.email || 'Not available'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Username</label>
                    <p className="mt-1 text-sm text-gray-900">{user?.username || 'Not available'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Account Type</label>
                    <p className="mt-1 text-sm text-gray-900 capitalize">{user?.role || 'User'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Subscription</label>
                    <p className="mt-1 text-sm text-gray-900">{user?.subscriptionPlan || 'Free'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Maps & Visualization */}
          <section id="maps-section">
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-freight-dark flex items-center">
                  <Map className="w-5 h-5 mr-2 text-freight-blue" />
                  Maps & Visualization
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Configure Google Maps integration for interactive route visualization
                </p>
              </div>
              <GoogleMapsConfig />
            </div>
          </section>

          <Separator />

          {/* Notifications */}
          <section id="notifications-section">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Bell className="w-5 h-5 mr-2 text-freight-blue" />
                  Notification Preferences
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Shipment Updates</label>
                      <p className="text-xs text-gray-600">Get notified when shipment status changes</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Document Processing</label>
                      <p className="text-xs text-gray-600">Notifications for OCR processing completion</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Invoice Alerts</label>
                      <p className="text-xs text-gray-600">New invoice notifications</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Data & Export */}
          <section id="data-section">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="w-5 h-5 mr-2 text-freight-blue" />
                  Data & Export Options
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Export Shipment Data</label>
                      <p className="text-xs text-gray-600">Download your shipment data as CSV</p>
                    </div>
                    <Button variant="outline" size="sm">Download CSV</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Backup Documents</label>
                      <p className="text-xs text-gray-600">Create backup of uploaded documents</p>
                    </div>
                    <Button variant="outline" size="sm">Create Backup</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Data Retention</label>
                      <p className="text-xs text-gray-600">Configure how long data is stored</p>
                    </div>
                    <Button variant="outline" size="sm">Configure</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Security */}
          <section id="security-section">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Shield className="w-5 h-5 mr-2 text-freight-blue" />
                  Security Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Two-Factor Authentication</label>
                      <p className="text-xs text-gray-600">Add an extra layer of security</p>
                    </div>
                    <Button variant="outline" size="sm">Enable</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">Active Sessions</label>
                      <p className="text-xs text-gray-600">Manage your active login sessions</p>
                    </div>
                    <Button variant="outline" size="sm">View Sessions</Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium">API Access</label>
                      <p className="text-xs text-gray-600">Manage API keys and access tokens</p>
                    </div>
                    <Button variant="outline" size="sm">Manage</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}