export interface AuthUser {
  id: number;
  organizationId: number;
  name: string;
  email: string | null;
  username: string | null;
  role: "trainer" | "client";
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: import("./types").AuthUser;
    }
  }
}
