import { redirect } from "next/navigation";
import { auth, signIn, isGithubConfigured, isEmailConfigured } from "@/auth";
import { Card } from "@/components/ui/Card";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-2 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-foreground-muted">
        Signing in identifies you on Token Maxxer. It does not grant access to your Claude,
        ChatGPT, or OpenCode accounts — usage only ever arrives through a collector you explicitly
        pair afterward.
      </p>

      <Card className="space-y-3">
        {!isGithubConfigured && !isEmailConfigured && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
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
              className="w-full rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              Continue with GitHub
            </button>
          </form>
        )}

        {isGithubConfigured && isEmailConfigured && (
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span className="h-px flex-1 bg-border-soft" />
            or
            <span className="h-px flex-1 bg-border-soft" />
          </div>
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
            className="w-full rounded-xl border border-border-soft bg-surface px-3.5 py-2.5 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="w-full rounded-xl border border-border-soft px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-muted"
          >
            Continue with email
          </button>
          {!isEmailConfigured && (
            <p className="text-xs text-foreground-muted">
              Dev mode: no email server configured, so the sign-in link will be printed to the
              server console instead of emailed.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}
