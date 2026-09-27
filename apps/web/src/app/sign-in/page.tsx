import { redirect } from "next/navigation";
import { auth, signIn, isGithubConfigured, isEmailConfigured } from "@/auth";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-2xl font-semibold">Sign in</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Signing in identifies you on Token Maxxer. It does not grant access to your Claude,
        ChatGPT, or OpenCode accounts — usage only ever arrives through a collector you explicitly
        pair afterward.
      </p>

      {!isGithubConfigured && !isEmailConfigured && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          No sign-in method is configured yet. Set <code>AUTH_GITHUB_ID</code>/
          <code>AUTH_GITHUB_SECRET</code> or <code>EMAIL_SERVER</code>/<code>EMAIL_FROM</code> in
          your environment — see <code>apps/web/.env.example</code>.
        </div>
      )}

      {isGithubConfigured && (
        <form
          action={async () => {
            "use server";
            await signIn("github", { redirectTo: "/dashboard" });
          }}
        >
          <button
            type="submit"
            className="mb-3 w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900"
          >
            Continue with GitHub
          </button>
        </form>
      )}

      <form
        action={async (formData: FormData) => {
          "use server";
          await signIn("nodemailer", { email: formData.get("email"), redirectTo: "/dashboard" });
        }}
        className="space-y-2"
      >
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          Continue with email
        </button>
        {!isEmailConfigured && (
          <p className="text-xs text-neutral-500">
            Dev mode: no email server configured, so the sign-in link will be printed to the
            server console instead of emailed.
          </p>
        )}
      </form>
    </div>
  );
}
