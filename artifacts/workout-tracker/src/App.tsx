import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import NotFound from "@/pages/not-found";

import HomePage from "@/pages/home";
import ExercisesPage from "@/pages/exercises";
import PlanFormPage from "@/pages/plan-form";
import PlanDetailPage from "@/pages/plan-detail";
import SessionPage from "@/pages/session";
import LogPastPage from "@/pages/log-past";
import HistoryPage from "@/pages/history";
import SessionDetailPage from "@/pages/session-detail";
import UsersPage from "@/pages/users";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import InvitePage from "@/pages/invite";
import VerifyEmailPage from "@/pages/verify-email";
import CheckEmailPage from "@/pages/check-email";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1
    },
  },
});

function AuthenticatedRoutes() {
  return (
    <UserProvider>
      <Switch>
        <Route path="/" component={HomePage} />
        <Route path="/exercises" component={ExercisesPage} />
        <Route path="/plans/new" component={PlanFormPage} />
        <Route path="/plans/:id/edit" component={PlanFormPage} />
        <Route path="/plans/:id" component={PlanDetailPage} />
        <Route path="/session/:planId" component={SessionPage} />
        <Route path="/log-past/:planId" component={LogPastPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/history/:id" component={SessionDetailPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/login"><Redirect to="/" /></Route>
        <Route path="/register"><Redirect to="/" /></Route>
        <Route path="/invite/:token"><Redirect to="/" /></Route>
        <Route path="/check-email"><Redirect to="/" /></Route>
        <Route path="/verify-email"><Redirect to="/" /></Route>
        <Route component={NotFound} />
      </Switch>
    </UserProvider>
  );
}

function PublicRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/invite/:token" component={InvitePage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route path="/check-email" component={CheckEmailPage} />
      <Route>
        <Redirect to="/login" />
      </Route>
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <AuthenticatedRoutes />;
  }

  return <PublicRoutes />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
