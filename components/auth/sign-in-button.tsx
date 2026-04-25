import { use } from "react";
import { AuthContext } from "./auth-provider";

export function SignInButton() {
  const { signIn } = use(AuthContext);

  return (
    <button
      onClick={signIn}
      className="flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-medium text-gray-700 shadow-md transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
      style={{ minHeight: 44 }}
    >
      Sign in with Google
    </button>
  );
}
