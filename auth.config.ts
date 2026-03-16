import type { NextAuthConfig } from "next-auth"
import Google from "next-auth/providers/google"
import Facebook from "next-auth/providers/facebook"

export default {
  providers: [
    Google,
    Facebook
  ],
} satisfies NextAuthConfig
