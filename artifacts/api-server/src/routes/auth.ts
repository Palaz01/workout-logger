import { Router, type IRouter } from "express";
import { eq, or } from "drizzle-orm";
import { db, usersTable, organizationsTable } from "@workspace/db";
import { RegisterBody, LoginBody } from "@workspace/api-zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail } from "../lib/email";

const SALT_ROUNDS = 10;
const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
const router: IRouter = Router();

function getWebBaseUrl(req: import("express").Request): string {
  if (process.env.WEB_BASE_URL) return process.env.WEB_BASE_URL;
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  return req.headers.origin || `${req.protocol}://${req.get("host")}`;
}

function generateVerificationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { name, email, username, password, organizationName } = parsed.data;

  const [existingByEmail] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (existingByEmail) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const [existingByUsername] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.username, username));

  if (existingByUsername) {
    res.status(409).json({ error: "Username already taken" });
    return;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const verificationToken = generateVerificationToken();
  const verificationTokenExpiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  );

  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizationsTable)
      .values({ name: organizationName })
      .returning();

    const [user] = await tx
      .insert(usersTable)
      .values({
        name,
        email,
        username,
        passwordHash,
        role: "trainer",
        organizationId: org.id,
        emailVerified: false,
        verificationToken,
        verificationTokenExpiresAt,
      })
      .returning();

    return { user, org };
  });

  const baseUrl = getWebBaseUrl(req);
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

  let emailSent = false;
  try {
    await sendVerificationEmail(email, name, verificationUrl);
    emailSent = true;
  } catch (err) {
    console.error("Failed to send verification email:", err);
  }

  res.status(201).json({
    message: emailSent
      ? "Registration successful. Please check your email to verify your account."
      : "Registration successful, but we could not send the verification email. Please use the resend option on the login page.",
    email: result.user.email,
    emailSent,
  });
});

router.get("/auth/verify-email", async (req, res): Promise<void> => {
  const token = req.query.token as string;
  if (!token) {
    res.status(400).json({ error: "Missing token" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.verificationToken, token));

  if (!user) {
    res.status(404).json({ error: "Invalid or expired verification link" });
    return;
  }

  if (user.verificationTokenExpiresAt && new Date() > user.verificationTokenExpiresAt) {
    res.status(410).json({ error: "Verification link has expired. Please request a new one." });
    return;
  }

  await db
    .update(usersTable)
    .set({
      emailVerified: true,
      verificationToken: null,
      verificationTokenExpiresAt: null,
    })
    .where(eq(usersTable.id, user.id));

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));

  req.session.userId = user.id;
  req.session.save(() => {
    res.json({
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

router.post("/auth/resend-verification", async (req, res): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email));

  if (!user) {
    res.json({ message: "If an account exists with that email, a verification link has been sent." });
    return;
  }

  if (user.emailVerified) {
    res.json({ message: "If an account exists with that email, a verification link has been sent." });
    return;
  }

  if (
    user.verificationTokenExpiresAt &&
    new Date() < new Date(user.verificationTokenExpiresAt.getTime() - (VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000 - 60 * 1000))
  ) {
    res.status(429).json({ error: "Please wait before requesting another verification email." });
    return;
  }

  const verificationToken = generateVerificationToken();
  const verificationTokenExpiresAt = new Date(
    Date.now() + VERIFICATION_TOKEN_EXPIRY_HOURS * 60 * 60 * 1000
  );

  await db
    .update(usersTable)
    .set({ verificationToken, verificationTokenExpiresAt })
    .where(eq(usersTable.id, user.id));

  const baseUrl = getWebBaseUrl(req);
  const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;

  let emailSent = false;
  try {
    await sendVerificationEmail(email, user.name, verificationUrl);
    emailSent = true;
  } catch (err) {
    console.error("Failed to resend verification email:", err);
  }

  if (!emailSent) {
    res.status(500).json({ error: "Failed to send verification email. Please try again later." });
    return;
  }

  res.json({ message: "If an account exists with that email, a verification link has been sent." });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { login, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(or(eq(usersTable.username, login), eq(usersTable.email, login)));

  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  if (!user.emailVerified) {
    res.status(403).json({ error: "Please verify your email before logging in.", email: user.email });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));

  req.session.userId = user.id;
  req.session.save(() => {
    res.json({
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

router.post("/auth/logout", async (req, res): Promise<void> => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ message: "Logged out" });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  const [org] = await db
    .select()
    .from(organizationsTable)
    .where(eq(organizationsTable.id, user.organizationId));

  res.json({
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

export default router;
