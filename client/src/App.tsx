import { Switch, Route } from "wouter";
import { useState } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { Sidebar, SidebarHeader, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Shipments from "@/pages/shipments";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import Agent from "@/pages/agent";
import Subscription from "@/pages/subscription";
import Payments from "@/pages/payments";
import PaymentTest from "@/pages/payment-test";
import AuthorizeNetDebug from "@/pages/authorize-net-debug";

import Chat from "@/pages/chat";
import FastIsf from "@/pages/fastisf";
import IsfEdit from "@/pages/isf-edit";
import IsfDetail from "@/pages/isfdetail";
import XmlManagement from "@/pages/XmlManagement";

import { BarChart3, Ship, User, Shield, CreditCard, Receipt, MessageCircle, FileText, Menu, X, Upload, Settings } from "lucide-react";
import freightclearLogo from "@assets/cropped-freigthclear_alt_logo2_1751903859339.png";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Shipments", href: "/shipments", icon: Ship },
  { name: "Fast ISF", href: "/fastisf", icon: FileText },
  { name: "Chat/Support", href: "/chat", icon: MessageCircle },
  { name: "Payments", href: "/payments", icon: Receipt },
  { name: "Payment Test", href: "/payment-test", icon: CreditCard },
  { name: "Debug A.Net", href: "/authorize-net-debug", icon: Settings },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Subscription", href: "/subscription", icon: CreditCard },
];

const adminNavigation = [
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "XML Management", href: "/xml-management", icon: Settings },
];

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="flex min-h-screen gradient-secondary max-w-full overflow-x-hidden">
      {/* Flowing Wave Background */}
      <div className="wave-background max-w-full"></div>
      
      {/* Mobile Menu Button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg bg-white/90 backdrop-blur-sm shadow-lg border border-white/20 text-freight-dark hover:bg-white transition-all"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={cn(
        "w-64 glass-effect shadow-lg border-r border-white/20 fixed h-full z-50 transition-transform duration-300 ease-in-out flex flex-col",
        "lg:translate-x-0", // Always visible on large screens
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full" // Hidden/shown on mobile
      )}>
        <Sidebar className="h-full flex flex-col">
          <SidebarHeader className="p-8 border-b border-white/20">
            <div className="flex flex-col items-center text-center">
              <div className="p-4">
                <img src={freightclearLogo} alt="Freightclear Logo" className="h-15 w-auto mx-auto" style={{height: '60px'}} />
              </div>
              <div>
                <h1 className="font-light text-freight-dark" style={{
                  fontFamily: 'Kanit, sans-serif',
                  fontWeight: 300,
                  fontSize: '28px',
                  background: 'linear-gradient(to bottom, #66c2ff, #33cccc)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text'
                }}>WORKFLOWS</h1>
              </div>
            </div>
          </SidebarHeader>

          <SidebarContent className="mt-6 flex-1 overflow-y-auto">
            <div className="space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center px-4 py-3 rounded-lg font-medium transition-colors",
                        isActive
                          ? "text-freight-dark bg-teal/10"
                          : "text-gray-700 hover:text-freight-dark hover:bg-white/50"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon 
                        className="mr-3 w-5 h-5"
                        style={isActive ? { color: "#33cccc" } : {}}
                      />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
              
              {/* Admin Navigation - Only visible for admin users */}
              {user?.isAgent && !user?.isAdmin && (
                <Link href="/agent">
                  <a
                    className={cn(
                      "flex items-center px-4 py-3 rounded-lg font-medium transition-colors",
                      location === "/agent"
                        ? "text-freight-dark bg-teal/10"
                        : "text-gray-700 hover:text-freight-dark hover:bg-white/50"
                    )}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Shield 
                      className="mr-3 w-5 h-5"
                      style={location === "/agent" ? { color: "#33cccc" } : {}}
                    />
                    Agent Dashboard
                  </a>
                </Link>
              )}
              {user?.isAdmin && adminNavigation.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                return (
                  <Link key={item.name} href={item.href}>
                    <a
                      className={cn(
                        "flex items-center px-4 py-3 rounded-lg font-medium transition-colors",
                        isActive
                          ? "text-freight-dark bg-teal/10"
                          : "text-gray-700 hover:text-freight-dark hover:bg-white/50"
                      )}
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      <Icon 
                        className="mr-3 w-5 h-5"
                        style={isActive ? { color: "#33cccc" } : {}}
                      />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </div>
          </SidebarContent>

          <SidebarFooter className="p-4 border-t border-white/20 glass-effect bg-white/95 backdrop-blur-sm">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage 
                  src={user?.profileImageUrl || ""} 
                  alt={`${user?.firstName || ""} ${user?.lastName || ""}`}
                  className="object-cover"
                />
                <AvatarFallback className="bg-teal text-white">
                  {user?.firstName?.[0] || "U"}{user?.lastName?.[0] || ""}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-freight-dark truncate">
                  {user?.firstName || ""} {user?.lastName || ""}
                </p>
                <p className="text-xs text-teal truncate">
                  {user?.companyName || "Freight Professional"}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-64 ml-0 max-w-full overflow-x-hidden">
        <div className="min-h-screen p-4 lg:p-8 pt-16 lg:pt-8 max-w-full overflow-x-hidden">
          <div className="max-w-full overflow-x-hidden w-full">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();
  const [location] = useLocation();

  // Always show public pages when explicitly requested, regardless of auth status
  const publicPaths = ['/landing', '/register'];
  const isPublicPath = publicPaths.includes(location);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-secondary">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-teal mx-auto mb-4"></div>
          <p className="text-teal">Loading...</p>
        </div>
      </div>
    );
  }

  // Show public pages when requested or when not authenticated
  if (isPublicPath || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
        <Route path="/landing" component={Landing} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Show authenticated pages
  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/shipments" component={Shipments} />
        <Route path="/xml-management" component={XmlManagement} />
        <Route path="/fastisf" component={FastIsf} />
        <Route path="/isf/edit/:id" component={IsfEdit} />
        <Route path="/isf/detail/:id" component={IsfDetail} />
        <Route path="/chat" component={Chat} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/payments" component={Payments} />
        <Route path="/payment-test" component={PaymentTest} />
        <Route path="/authorize-net-debug" component={AuthorizeNetDebug} />
        <Route path="/admin" component={Admin} />
        <Route path="/agent" component={Agent} />
        <Route path="/profile" component={Profile} />
        <Route component={NotFound} />
      </Switch>
    </AuthenticatedLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
