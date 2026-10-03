import { redirect } from "next/navigation";
import { auth, signIn, isGithubConfigured, isEmailConfigured, isDevEmail } from "@/auth";
import { AuthError } from "next-auth";
import { SubmitButton } from "@/components/SubmitButton";
import { Card } from "@/components/ui/Card";

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto grid max-w-4xl items-center gap-10 lg:grid-cols-2">
      <div className="hidden lg:block">
        <span className="eyebrow">Token Maxxer</span>
        <h2 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight">
          Your usage,
          <br />
          <span className="text-accent">your rules.</span>
        </h2>
        <ul className="mt-6 space-y-4 text-sm text-foreground-muted">
          {[
            ["Private by default", "Your account starts unpublished. You choose when to join the leaderboard."],
            ["Metadata only", "Token counts and model names. Never prompts, code, or file paths."],
            ["Identity ≠ access", "Signing in never grants access to your AI accounts or repositories."],
          ].map(([t, b]) => (
            <li key={t} className="flex gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-positive-soft text-xs text-positive">✓</span>
              <span><span className="font-medium text-foreground">{t}.</span> {b}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mx-auto w-full max-w-sm">
      <span className="eyebrow">Welcome</span>
      <h1 className="mb-2 mt-1 text-3xl font-semibold tracking-tight">Sign in</h1>
      <p className="mb-6 text-sm text-foreground-muted">
        Signing in identifies you on Token Maxxer. It does not grant access to your Claude,
        ChatGPT, or OpenCode accounts — usage only ever arrives through a collector you explicitly
        pair afterward.
      </p>

      <Card className="space-y-3 !p-5">
        {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error === "OAuthAccountNotLinked" ? "This email is already linked to another sign-in method. Use the method you originally signed up with." : error === "Verification" ? "That sign-in link expired or has already been used. Request a new one below." : "Sign-in could not be completed. Please try again."}</p>}
        {!isGithubConfigured && !isEmailConfigured && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            No sign-in method is configured yet. Set <code>AUTH_GITHUB_ID</code>/
            <code>AUTH_GITHUB_SECRET</code> or <code>EMAIL_SERVER</code>/<code>EMAIL_FROM</code> in
            your environment — see <code>apps/web/.env.example</code>.
          </div>
        )}

        {isGithubConfigured && (
          <form
            action={async () => {
              "use server";
              try { await signIn("github", { redirectTo: "/dashboard" }); }
              catch (e) { if (e instanceof AuthError) redirect(`/sign-in?error=${e.type}`); throw e; }
            }}
          >
            <SubmitButton>Continue with GitHub</SubmitButton>
          </form>
        )}

        {isGithubConfigured && isEmailConfigured && (
          <div className="flex items-center gap-3 text-xs text-foreground-muted">
            <span className="h-px flex-1 bg-border-soft" />
            or
            <span className="h-px flex-1 bg-border-soft" />
          </div>
        )}

        {(isEmailConfigured || isDevEmail) && <form
          action={async (formData: FormData) => {
            "use server";
            try { await signIn("nodemailer", { email: formData.get("email"), redirectTo: "/dashboard" }); }
            catch (e) { if (e instanceof AuthError) redirect(`/sign-in?error=${e.type}`); throw e; }
          }}
          className="space-y-2"
        >
          <input
            aria-label="Email address"
            autoComplete="email"
            type="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full rounded-full border border-border-soft bg-surface px-4 py-2.5 text-sm outline-none focus:border-accent"
          />
          <SubmitButton variant="light">Continue with email</SubmitButton>
          {!isEmailConfigured && (
            <p className="text-xs text-foreground-muted">
              Dev mode: no email server configured, so the sign-in link will be printed to the
              server console instead of emailed.
            </p>
          )}
        </form>}
      </Card>
      </div>
    </div>
  );
}
