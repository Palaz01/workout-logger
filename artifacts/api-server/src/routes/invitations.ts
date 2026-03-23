import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, organizationsTable, invitationsTable } from "@workspace/db";
import { CreateInvitationBody, AcceptInvitationBody, GetInvitationParams, AcceptInvitationParams } from "@workspace/api-zod";
import "../types";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendInvitationEmail } from "../lib/email";

const SALT_ROUNDS = 10;
const router: IRouter = Router();

function getWebBaseUrl(req: import("express").Request): string {
  if (process.env.WEB_BASE_URL) return process.env.WEB_BASE_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return req.headers.origin || `${req.protocol}://${req.get("host")}`;
}

router.post("/invitations", async (req, res): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  if (req.user.role !== "trainer") {
    res.status(403).json({ error: "Only trainers can create invitations" });
    return;
  }

  const parsed = CreateInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(invitationsTable)
    .values({
      organizationId: req.user.organizationId,
      email: parsed.data.email,
      name: parsed.data.name,
      role: parsed.data.role ?? "client",
      token,
      expiresAt,
      invitedBy: req.user.id,
    })
    .returning();

  const baseUrl = getWebBaseUrl(req);
  const inviteUrl = `${baseUrl}/invite/${invitation.token}`;

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, req.user!.organizationId));

  let emailSent = false;
  try {
    await sendInvitationEmail(
      parsed.data.email,
      parsed.data.name,
      org?.name ?? "the team",
      req.user!.name,
      invitation.role,
      inviteUrl
    );
    emailSent = true;
  } catch (err) {
    console.error("Failed to send invitation email:", err);
  }

  res.status(201).json({
    id: invitation.id,
    token: invitation.token,
    inviteUrl,
    email: invitation.email,
    name: invitation.name,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    emailSent,
  });
});

router.get("/invitations/:token", async (req, res): Promise<void> => {
  const params = GetInvitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.token, params.data.token));

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  if (invitation.acceptedAt) {
    res.status(410).json({ error: "Invitation already accepted" });
    return;
  }

  if (new Date() > invitation.expiresAt) {
    res.status(410).json({ error: "Invitation has expired" });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, invitation.organizationId));

  res.json({
    name: invitation.name,
    email: invitation.email,
    role: invitation.role,
    organizationName: org?.name ?? null,
    expiresAt: invitation.expiresAt.toISOString(),
  });
});

router.post("/invitations/:token/accept", async (req, res): Promise<void> => {
  const params = AcceptInvitationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = AcceptInvitationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [invitation] = await db
    .select()
    .from(invitationsTable)
    .where(eq(invitationsTable.token, params.data.token));

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  if (invitation.acceptedAt) {
    res.status(410).json({ error: "Invitation already accepted" });
    return;
  }

  if (new Date() > invitation.expiresAt) {
    res.status(410).json({ error: "Invitation has expired" });
    return;
  }

  const [existingByEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, invitation.email));

  if (existingByEmail) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const [existingByUsername] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, parsed.data.username));

  if (existingByUsername) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, SALT_ROUNDS);

  const user = await db.transaction(async (tx) => {
    const [newUser] = await tx
      .insert(usersTable)
      .values({
        name: invitation.name,
        email: invitation.email,
        username: parsed.data.username,
        passwordHash,
        role: invitation.role,
        organizationId: invitation.organizationId,
        emailVerified: true,
      })
      .returning();

    await tx
      .update(invitationsTable)
      .set({ acceptedAt: new Date() })
      .where(eq(invitationsTable.id, invitation.id));

    return newUser;
  });

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));

  req.session.userId = user.id;
  req.session.save(() => {
    res.status(201).json({
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
      organizationId: user.organizationId,
      organizationName: org?.name ?? null,
      createdAt: user.createdAt.toISOString(),
    });
  });
});

export default router;
