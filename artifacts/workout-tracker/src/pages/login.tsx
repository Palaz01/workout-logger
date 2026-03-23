import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { Dumbbell, LogIn, Eye, EyeOff, Mail } from "lucide-react";

export default function LoginPage() {
  const { login } = useAuth();
  const [, setLocation] = useLocation();
  const keyboardHeight = useKeyboardHeight();
  const [loginStr, setLoginStr] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setUnverifiedEmail("");
    setIsLoading(true);

    try {
      await login(loginStr.trim(), password);
    } catch (err: unknown) {
      const error = err as Error & { status?: number; email?: string };
      if (error.status === 403 && error.email) {
        setUnverifiedEmail(error.email);
        setError("Please verify your email before logging in.");
      } else {
        setError(error.message || "Invalid credentials");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center px-6 overflow-y-auto" style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}>
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
            <Dumbbell className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold font-display">Welcome Back</h1>
          <p className="text-muted-foreground text-sm">Sign in to your workout tracker</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm font-medium px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          {unverifiedEmail && (
            <button
              type="button"
              onClick={() => setLocation(`/check-email?email=${encodeURIComponent(unverifiedEmail)}`)}
              className="w-full h-10 bg-blue-50 text-blue-600 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Resend verification email
            </button>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Username or Email
            </label>
            <input
              type="text"
              value={loginStr}
              onChange={(e) => setLoginStr(e.target.value)}
              className="w-full h-12 px-4 rounded-xl border-2 border-border bg-background text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="Enter username or email"
              required
              autoFocus
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 pr-12 rounded-xl border-2 border-border bg-background text-sm font-medium focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Enter password"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-primary/20"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link href="/register" className="text-primary font-semibold hover:underline">
            Register as trainer
          </Link>
        </p>
      </div>
    </div>
  );
}
