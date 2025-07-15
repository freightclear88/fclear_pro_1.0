import { Switch, Route } from "wouter";
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
import Subscription from "@/pages/subscription";
import Payments from "@/pages/payments";
import Demo from "@/pages/demo";
import Chat from "@/pages/chat";
import { BarChart3, Ship, User, Shield, CreditCard, Receipt, MessageCircle } from "lucide-react";
import freightclearLogo from "@assets/cropped-freigthclear_alt_logo2_1751903859339.png";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Shipments", href: "/shipments", icon: Ship },
  { name: "Chat", href: "/chat", icon: MessageCircle },
  { name: "Payments", href: "/payments", icon: Receipt },
  { name: "Profile", href: "/profile", icon: User },
  { name: "Subscription", href: "/subscription", icon: CreditCard },
];

const adminNavigation = [
  { name: "Admin", href: "/admin", icon: Shield },
];

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen gradient-secondary">
      {/* Flowing Wave Background */}
      <div className="wave-background"></div>
      
      {/* Sidebar */}
      <div className="w-64 glass-effect shadow-lg border-r border-white/20 fixed h-full z-30">
        <Sidebar>
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

          <SidebarContent className="mt-6">
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
                    >
                      <Icon 
                        className={cn(
                          "mr-3 w-5 h-5",
                          isActive ? "text-freight-orange" : ""
                        )} 
                      />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
              
              {/* Admin Navigation - Only visible for admin users */}
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
                    >
                      <Icon 
                        className={cn(
                          "mr-3 w-5 h-5",
                          isActive ? "text-freight-orange" : ""
                        )} 
                      />
                      {item.name}
                    </a>
                  </Link>
                );
              })}
            </div>
          </SidebarContent>

          <SidebarFooter className="absolute bottom-0 w-full p-4 border-t border-white/20 glass-effect">
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
                  {user?.company || "Freight Professional"}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        <div className="min-h-screen">
          {children}
        </div>
      </div>
    </div>
  );
}

function Router() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading || !isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Landing} />
        <Route path="/demo" component={Demo} />
        <Route path="/register" component={Register} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/shipments" component={Shipments} />
        <Route path="/chat" component={Chat} />
        <Route path="/subscription" component={Subscription} />
        <Route path="/payments" component={Payments} />
        <Route path="/admin" component={Admin} />
        <Route path="/profile" component={Profile} />
        <Route path="/demo" component={Demo} />
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
