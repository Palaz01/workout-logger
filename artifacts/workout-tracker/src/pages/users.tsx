import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { useUsers, useUsersMutations } from "@/hooks/use-users";
import { useUserContext } from "@/contexts/UserContext";
import { Plus, Trash2, UserCircle, Pencil, Copy, Check, Mail, MoreVertical } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${BASE}/api${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export default function UsersPage() {
  const { data: users, isLoading } = useUsers();
  const { deleteUser, updateUser, isUpdating } = useUsersMutations();
  const { trainerUser, isTrainer } = useUserContext();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isTrainer) {
      setLocation("/");
    }
  }, [isTrainer, setLocation]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<{ id: number; name: string } | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("client");
  const [isInviting, setIsInviting] = useState(false);

  const [inviteLink, setInviteLink] = useState("");
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const result = await apiFetch("/invitations", {
        method: "POST",
        body: JSON.stringify({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const origin = window.location.origin;
      const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
      setInviteLink(`${origin}${basePath}/invite/${result.token}`);
      setInviteEmailSent(result.emailSent !== false);
      toast({ title: "Invitation created" });
    } catch (err: unknown) {
      toast({ title: err instanceof Error ? err.message : "Error creating invitation", variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  const closeInviteModal = () => {
    setIsInviteOpen(false);
    setInviteName("");
    setInviteEmail("");
    setInviteRole("client");
    setInviteLink("");
    setInviteEmailSent(false);
    setCopied(false);
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !editingUser.name.trim()) return;

    try {
      await updateUser({ id: editingUser.id, data: { name: editingUser.name.trim() } });
      toast({ title: "Name updated" });
      setEditingUser(null);
    } catch {
      toast({ title: "Error updating name", variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser({ id });
      toast({ title: "Client removed" });
      setShowDeleteConfirm(null);
    } catch {
      toast({ title: "Error removing client", variant: "destructive" });
    }
  };

  const userToDelete = users?.find((u) => u.id === showDeleteConfirm);

  return (
    <Layout
      title="Users"
      action={
        <Button size="icon" variant="ghost" onClick={() => setIsInviteOpen(true)}>
          <Plus className="w-6 h-6 text-primary" />
        </Button>
      }
    >
      <div className="p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center p-8">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
          </div>
        ) : users?.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <UserCircle className="w-24 h-24 text-muted-foreground/30 mb-6" />
            <h3 className="text-xl font-bold mb-2">No users yet</h3>
            <p className="text-muted-foreground mb-6">Invite clients to start managing their workouts.</p>
            <Button onClick={() => setIsInviteOpen(true)} className="w-full sm:w-auto">
              <Mail className="w-4 h-4 mr-2" /> Invite First Client
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            {users?.map((user) => {
              const isTrainerUser = user.id === trainerUser?.id;
              return (
                <div
                  key={user.id}
                  className="bg-card rounded-2xl p-4 card-shadow flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary text-lg font-semibold">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-base leading-tight">{user.name}</h3>
                        {isTrainerUser && <span className="text-xs">&#11088;</span>}
                      </div>
                      <span className="inline-block mt-0.5 px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full bg-primary/10 text-primary">
                        {user.role}
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setActiveMenuId(activeMenuId === user.id ? null : user.id)}
                      className="p-1.5 text-muted-foreground hover:bg-muted rounded-full transition-colors"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    <AnimatePresence>
                      {activeMenuId === user.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                            className="absolute right-0 top-full mt-1 w-36 bg-white rounded-xl shadow-xl border border-border/50 overflow-hidden z-50 origin-top-right"
                          >
                            <button
                              onClick={() => { setEditingUser({ id: user.id, name: user.name }); setActiveMenuId(null); }}
                              className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-muted text-foreground transition-colors"
                            >
                              <Pencil className="w-4 h-4" /> Edit
                            </button>
                            {!isTrainerUser && (
                              <button
                                onClick={() => { setShowDeleteConfirm(user.id); setActiveMenuId(null); }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm font-semibold hover:bg-destructive/10 text-destructive transition-colors border-t border-border/50"
                              >
                                <Trash2 className="w-4 h-4" /> Remove
                              </button>
                            )}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Modal
        isOpen={isInviteOpen}
        onClose={closeInviteModal}
        title={inviteLink ? "Invite Link Ready" : "Invite User"}
      >
        {inviteLink ? (
          <div className="space-y-5">
            {inviteEmailSent ? (
              <div className="flex items-center gap-3 bg-green-50 px-4 py-3 rounded-xl">
                <Mail className="w-5 h-5 text-green-600 flex-shrink-0" />
                <p className="text-sm text-green-800">
                  Invitation email sent to <strong>{inviteEmail}</strong>
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3 bg-amber-50 px-4 py-3 rounded-xl">
                <Mail className="w-5 h-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  Could not send email to <strong>{inviteEmail}</strong>. Please share the link below directly.
                </p>
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              You can also share this link directly with <span className="font-semibold text-foreground">{inviteName}</span>:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={inviteLink}
                className="flex-1 h-11 px-3 rounded-xl border-2 border-border bg-muted/30 text-xs font-mono truncate"
              />
              <button
                onClick={handleCopy}
                className="h-11 px-4 rounded-xl bg-primary text-white font-semibold text-sm flex items-center gap-1.5 hover:bg-primary/90 transition-colors flex-shrink-0"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={closeInviteModal}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleInvite} className="space-y-4">
            <Input
              label="Name"
              placeholder="e.g. Anna"
              value={inviteName}
              onChange={(e) => setInviteName(e.target.value)}
              required
              autoFocus
            />
            <Input
              label="Email"
              type="email"
              placeholder="anna@example.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              required
            />
            <Select
              label="Role"
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              options={[
                { value: "client", label: "Client" },
                { value: "trainer", label: "Trainer" },
              ]}
            />
            <div className="pt-2">
              <Button type="submit" className="w-full" isLoading={isInviting}>
                <Mail className="w-4 h-4 mr-2" /> Create Invitation
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={editingUser !== null}
        onClose={() => setEditingUser(null)}
        title="Rename User"
      >
        <form onSubmit={handleRename} className="space-y-5">
          <Input
            label="Name"
            value={editingUser?.name ?? ""}
            onChange={(e) => setEditingUser((prev) => prev ? { ...prev, name: e.target.value } : null)}
            required
            autoFocus
          />
          <div className="pt-2">
            <Button type="submit" className="w-full" isLoading={isUpdating}>
              Save
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDeleteConfirm !== null}
        onClose={() => setShowDeleteConfirm(null)}
        title="Remove Client"
      >
        <div className="space-y-4">
          <p className="text-muted-foreground">
            Are you sure you want to remove <span className="font-semibold text-foreground">{userToDelete?.name}</span>? This will also delete their session history and plan assignments.
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={() => showDeleteConfirm && handleDelete(showDeleteConfirm)}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
