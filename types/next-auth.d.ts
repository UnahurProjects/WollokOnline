import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/lib/types/db";

declare module "next-auth" {
  interface Session {
    user: {
      githubId: string;
      githubUsername: string;
      role: UserRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    githubId?: string;
    githubUsername?: string;
  }
}
