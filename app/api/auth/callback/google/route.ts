import { googleSignInCallback } from "@/lib/better-auth";

// where Google sends someone back from "Sign in with Google" — see lib/better-auth.ts
export const GET = googleSignInCallback;
