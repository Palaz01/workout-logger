import { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import type { AuthUser } from "../types";

export type { AuthUser };

import "../types";

const PUBLIC_PATHS = [
  "/healthz",
  "/auth/register",
  "/auth/login",
  "/auth/logout",
  "/auth/me",
  "/auth/verify-email",
  "/auth/resend-verification",
];

function isPublicPath(path: string): boolean {
  if (PUBLIC_PATHS.includes(path)) return true;
  if (/^\/invitations\/[^/]+$/.test(path)) return true;
  if (/^\/invitations\/[^/]+\/accept$/.test(path)) return true;
  return false;
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isPublicPath(req.path)) {
    next();
    return;
  }

  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      organizationId: usersTable.organizationId,
      name: usersTable.name,
      email: usersTable.email,
      username: usersTable.username,
      role: usersTable.role,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.user = user as AuthUser;
  next();
}
