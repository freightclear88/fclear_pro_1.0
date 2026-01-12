import { Switch, Route, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import PaymentForm from "./components/PaymentForm";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Success from "./pages/Success";
import History from "./pages/History";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const response = await fetch(queryKey[0] as string, {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      },
      staleTime: 60000,
      retry: false,
    },
  },
});

function Navigation() {
  const [location, setLocation] = useLocation();
  const { data: user } = useQuery<{ id: number; email: string; isAdmin?: boolean }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    setLocation('/login');
  };

  if (!user) return null;

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-blue-600">FreightClear Payments</h1>
          <div className="flex gap-4">
            <button
              onClick={() => setLocation('/payment')}
              className={`text-sm font-medium ${location === '/payment' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Make Payment
            </button>
            <button
              onClick={() => setLocation('/history')}
              className={`text-sm font-medium ${location === '/history' ? 'text-blue-600' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Payment History
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user.email}</span>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Sign Out
          </button>
        </div>
      </div>
    </nav>
  );
}

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery<{ id: number }>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    setLocation('/login');
    return null;
  }

  return (
    <>
      <Navigation />
      <Component />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/success" component={Success} />
      <Route path="/payment">
        <ProtectedRoute component={PaymentForm} />
      </Route>
      <Route path="/history">
        <ProtectedRoute component={History} />
      </Route>
      <Route>
        <ProtectedRoute component={PaymentForm} />
      </Route>
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
    </QueryClientProvider>
  );
}
