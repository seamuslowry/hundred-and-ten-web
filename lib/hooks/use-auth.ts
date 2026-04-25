import { use } from "react";
import { AuthContext } from "@/components/auth/auth-provider";

export function useAuth() {
  return use(AuthContext);
}
