import { useState } from "react";
import { useUserContext } from "@/contexts/UserContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut } from "lucide-react";

export function PersonSwitcher() {
  const { users, activeUser, setActiveUser, trainerUser } = useUserContext();
  const { logout, authUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!activeUser) return null;

  const isActiveTrainer = activeUser.id === trainerUser?.id;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
    } catch {
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-1 py-1 -ml-1 rounded-lg active:bg-black/5 transition-colors"
      >
        {isActiveTrainer && <span className="text-sm">&#11088;</span>}
        <span className="text-xl font-bold text-foreground font-display truncate max-w-[180px]">
          {activeUser.name}
        </span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-muted-foreground flex-shrink-0">
          <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-[100]"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className="fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-2xl shadow-2xl max-w-md mx-auto pb-safe"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>
              <div className="px-4 pb-2 pt-1">
                <h3 className="text-lg font-bold text-foreground">Switch Person</h3>
                {authUser && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Signed in as {authUser.username ?? authUser.email}
                  </p>
                )}
              </div>
              <div className="px-2 pb-4 max-h-[50vh] overflow-y-auto">
                {users.map((user) => {
                  const isTrainer = user.id === trainerUser?.id;
                  const isActive = user.id === activeUser.id;
                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        setActiveUser(user);
                        setOpen(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors",
                        isActive ? "bg-primary/10" : "active:bg-gray-50"
                      )}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold flex-shrink-0",
                        isActive ? "bg-primary text-white" : "bg-gray-100 text-gray-600"
                      )}>
                        {user.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "font-semibold",
                            isActive ? "text-primary" : "text-foreground"
                          )}>
                            {user.name}
                          </span>
                          {isTrainer && <span className="text-xs">&#11088;</span>}
                        </div>
                        <span className="text-xs text-muted-foreground capitalize">
                          {user.role}
                        </span>
                      </div>
                      {isActive && (
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="text-primary flex-shrink-0">
                          <path d="M4 10L8 14L16 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="px-4 pb-20 border-t border-border/50 pt-3">
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-semibold text-sm">Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
