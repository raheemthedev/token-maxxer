import { isEmailConfigured } from "@/auth";
import Link from "next/link";
import { Card } from "@/components/ui/Card";

export default function VerifyRequestPage() {
  return (
    <div className="mx-auto max-w-sm">
      <Card className="text-center !p-8">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl shadow-inner">
          ✉️
        </div>
        <span className="eyebrow">Almost there</span>
        <h1 className="mb-2 mt-1 text-xl font-semibold">{isEmailConfigured ? "Check your email" : "Check the development console"}</h1>
        <p className="text-sm text-foreground-muted">
          {isEmailConfigured ? "We sent you a sign-in link. Check your spam folder if it doesn’t arrive. The link can be used once." : "Your development sign-in link is in the terminal running the app."}
        </p>
        <Link href="/sign-in" className="pill pill-light mt-5">Try another sign-in method</Link>
      </Card>
    </div>
  );
}
