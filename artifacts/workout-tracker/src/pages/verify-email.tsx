import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Dumbbell, CheckCircle, XCircle, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function VerifyEmailPage() {
  const [, setLocation] = useLocation();
  const { setAuthUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setErrorMessage("No verification token provided.");
      return;
    }

    fetch(`${BASE}/api/auth/verify-email?token=${encodeURIComponent(token)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (res.ok && data) {
          setAuthUser(data);
          setStatus("success");
          setTimeout(() => setLocation("/"), 2000);
        } else {
          setStatus("error");
          setErrorMessage(data?.error || "Verification failed.");
        }
      })
      .catch(() => {
        setStatus("error");
        setErrorMessage("Network error. Please try again.");
      });
  }, [setAuthUser, setLocation]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Dumbbell className="w-8 h-8 text-primary" />
        </div>

        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <h1 className="text-xl font-bold font-display">Verifying your email...</h1>
            <p className="text-muted-foreground text-sm">Please wait a moment.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold font-display">Email Verified!</h1>
            <p className="text-muted-foreground text-sm">
              Your account is now active. Redirecting...
            </p>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4">
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-xl font-bold font-display">Verification Failed</h1>
            <p className="text-muted-foreground text-sm">{errorMessage}</p>
            <button
              onClick={() => setLocation("/login")}
              className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
            >
              Go to Login
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
