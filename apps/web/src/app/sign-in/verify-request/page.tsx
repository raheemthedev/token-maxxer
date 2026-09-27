import { Card } from "@/components/ui/Card";

export default function VerifyRequestPage() {
  return (
    <div className="mx-auto max-w-sm">
      <Card className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-2xl">
          ✉️
        </div>
        <h1 className="mb-2 text-xl font-semibold">Check your email</h1>
        <p className="text-sm text-foreground-muted">
          A sign-in link was sent. In local development without an email server configured, it was
          printed to the server console instead.
        </p>
      </Card>
    </div>
  );
}
