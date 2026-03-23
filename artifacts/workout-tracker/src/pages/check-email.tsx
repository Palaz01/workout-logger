import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";
import { Dumbbell, Mail, RefreshCw } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function CheckEmailPage() {
  const [, setLocation] = useLocation();
  const keyboardHeight = useKeyboardHeight();
  const [isResending, setIsResending] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    setResendMessage("");

    try {
      const res = await fetch(`${BASE}/api/auth/resend-verification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => null);
      if (res.status === 429) {
        setResendMessage("Please wait a moment before requesting another email.");
      } else {
        setResendMessage(data?.message || "Verification email sent!");
      }
    } catch {
      setResendMessage("Failed to send. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col items-center justify-center px-6 overflow-y-auto"
      style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}
    >
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
          <Dumbbell className="w-8 h-8 text-primary" />
        </div>

        <div className="space-y-3">
          <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto">
            <Mail className="w-7 h-7 text-blue-500" />
          </div>
          <h1 className="text-2xl font-bold font-display">Check Your Email</h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            We sent a verification link to
            {email ? (
              <>
                <br />
                <strong className="text-foreground">{email}</strong>
              </>
            ) : (
              " your email address"
            )}
            . Click the link to activate your account.
          </p>
        </div>

        <div className="space-y-3">
          {resendMessage && (
            <div className="bg-primary/5 text-primary text-sm font-medium px-4 py-3 rounded-xl">
              {resendMessage}
            </div>
          )}

          {email && (
            <button
              onClick={handleResend}
              disabled={isResending}
              className="w-full h-12 bg-muted text-foreground rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isResending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Resend Verification Email
            </button>
          )}

          <Link
            href="/login"
            className="block w-full h-12 bg-primary text-white rounded-xl font-semibold text-sm flex items-center justify-center hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
