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
import Dashboard from "@/pages/dashboard";
import Shipments from "@/pages/shipments";
import Profile from "@/pages/profile";
import Admin from "@/pages/admin";
import Documents from "@/pages/documents";
import { BarChart3, Ship, Upload, User, Shield } from "lucide-react";
import freightclearLogo from "@assets/cropped-freigthclear_alt_logo2_1751903859339.png";

const navigation = [
  { name: "Dashboard", href: "/", icon: BarChart3 },
  { name: "Shipments", href: "/shipments", icon: Ship },
  { name: "Documents", href: "/documents", icon: Upload },
  { name: "Admin", href: "/admin", icon: Shield },
  { name: "Profile", href: "/profile", icon: User },
];

function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-white shadow-lg border-r border-gray-200 fixed h-full z-30">
        <Sidebar>
          <SidebarHeader className="p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <img src={freightclearLogo} alt="Freightclear Logo" className="h-8" />
              <div>
                <h1 className="text-lg font-bold text-freight-dark">Freight Flow</h1>
                <p className="text-sm text-gray-500">by Freightclear</p>
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
                          ? "text-freight-dark bg-freight-orange bg-opacity-10"
                          : "text-gray-600 hover:text-freight-dark hover:bg-gray-50"
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

          <SidebarFooter className="absolute bottom-0 w-full p-4 border-t border-gray-200 bg-white">
            <div className="flex items-center space-x-3">
              <Avatar className="w-10 h-10">
                <AvatarImage 
                  src={user?.profileImageUrl || ""} 
                  alt={`${user?.firstName || ""} ${user?.lastName || ""}`}
                  className="object-cover"
                />
                <AvatarFallback className="bg-freight-blue text-white">
                  {user?.firstName?.[0] || "U"}{user?.lastName?.[0] || ""}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-freight-dark truncate">
                  {user?.firstName || ""} {user?.lastName || ""}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {user?.company || "Freight Professional"}
                </p>
              </div>
            </div>
          </SidebarFooter>
        </Sidebar>
      </div>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        <div className="bg-freight-gray min-h-screen">
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
        <Route component={NotFound} />
      </Switch>
    );
  }

  return (
    <AuthenticatedLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/shipments" component={Shipments} />
        <Route path="/documents" component={Documents} />
        <Route path="/admin" component={Admin} />
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
