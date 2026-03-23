import { ReactNode, useRef, useState, useEffect, useCallback } from "react";
import { Link, useRoute } from "wouter";
import { Dumbbell, ScrollText, History, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { PersonSwitcher } from "@/components/PersonSwitcher";
import { useUserContext } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { useKeyboardHeight } from "@/hooks/use-keyboard-height";

interface LayoutProps {
  children: ReactNode;
  title?: string;
  action?: ReactNode;
  backTo?: string;
}

export function Layout({ children, title, action, backTo }: LayoutProps) {
  const [isHome] = useRoute("/");
  const [isExercises] = useRoute("/exercises");
  const [isHistory] = useRoute("/history");
  const [isHistoryDetail] = useRoute("/history/:id");
  const [isUsers] = useRoute("/users");

  const { isTrainer } = useUserContext();
  const { logout } = useAuth();
  const showSwitcher = isTrainer && !backTo;

  const mainRef = useRef<HTMLElement>(null);
  const lastScrollY = useRef(0);
  const rafId = useRef(0);
  const [headerHidden, setHeaderHidden] = useState(false);
  const keyboardHeight = useKeyboardHeight();
  const autoHide = !backTo;
  const hasHeader = !!(title || action || backTo || showSwitcher);

  const handleScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(() => {
      const el = mainRef.current;
      if (!el) return;

      const currentY = el.scrollTop;
      const threshold = 5;

      if (currentY <= 0) {
        setHeaderHidden(false);
      } else if (currentY > lastScrollY.current + threshold) {
        setHeaderHidden(true);
      } else if (currentY < lastScrollY.current - threshold) {
        setHeaderHidden(false);
      }

      lastScrollY.current = currentY;
    });
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el || !autoHide) return;

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", handleScroll);
      cancelAnimationFrame(rafId.current);
    };
  }, [autoHide, handleScroll]);

  return (
    <div
      className="fixed inset-0 bg-background flex flex-col max-w-md mx-auto overflow-clip shadow-2xl shadow-black/10 sm:border-x sm:border-border/50"
      style={{ zIndex: 1 }}
    >

      <main ref={mainRef} className="flex-1 overflow-y-auto no-scrollbar" style={{ paddingBottom: keyboardHeight > 0 ? keyboardHeight : undefined }}>
        {hasHeader && (
          <header
            className={cn(
              "sticky top-0 z-50 bg-white border-b border-border/30 shadow-sm px-4 py-4 flex items-center justify-between",
              autoHide && "transition-transform duration-300 ease-in-out",
              autoHide && headerHidden && "-translate-y-full"
            )}
          >
            <div className="flex items-center gap-3">
              {backTo && (
                <Link href={backTo} className="p-2 -ml-2 rounded-full hover:bg-black/5 active:bg-black/10 transition-colors">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              )}
              {showSwitcher ? (
                <PersonSwitcher />
              ) : (
                title && <h1 className="text-xl font-bold text-foreground font-display">{title}</h1>
              )}
            </div>
            <div className="flex items-center gap-1">
              {action && <div>{action}</div>}
              {!isTrainer && !backTo && (
                <button
                  onClick={() => logout()}
                  className="p-2 text-muted-foreground hover:text-destructive transition-colors rounded-lg"
                  title="Sign Out"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              )}
            </div>
          </header>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={title || 'content'}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="min-h-0"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="flex-shrink-0 bg-white border-t border-border/50 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-50">
        <div className="flex items-center justify-around px-2 h-16">
          <Link href="/" className="flex-1 flex justify-center">
            <div className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200",
              isHome ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <div className="relative">
                <ScrollText className="w-6 h-6" strokeWidth={isHome ? 2.5 : 2} />
                {isHome && (
                  <motion.div layoutId="nav-indicator" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium">Plans</span>
            </div>
          </Link>
          <Link href="/history" className="flex-1 flex justify-center">
            <div className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200",
              (isHistory || isHistoryDetail) ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <div className="relative">
                <History className="w-6 h-6" strokeWidth={(isHistory || isHistoryDetail) ? 2.5 : 2} />
                {(isHistory || isHistoryDetail) && (
                  <motion.div layoutId="nav-indicator" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium">History</span>
            </div>
          </Link>
          <Link href="/exercises" className="flex-1 flex justify-center">
            <div className={cn(
              "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200",
              isExercises ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}>
              <div className="relative">
                <Dumbbell className="w-6 h-6" strokeWidth={isExercises ? 2.5 : 2} />
                {isExercises && (
                  <motion.div layoutId="nav-indicator" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                )}
              </div>
              <span className="text-[10px] font-medium">Exercises</span>
            </div>
          </Link>
          {isTrainer && (
            <Link href="/users" className="flex-1 flex justify-center">
              <div className={cn(
                "flex flex-col items-center justify-center w-full h-full gap-1 transition-colors duration-200",
                isUsers ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
                <div className="relative">
                  <Users className="w-6 h-6" strokeWidth={isUsers ? 2.5 : 2} />
                  {isUsers && (
                    <motion.div layoutId="nav-indicator" className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
                <span className="text-[10px] font-medium">Users</span>
              </div>
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
