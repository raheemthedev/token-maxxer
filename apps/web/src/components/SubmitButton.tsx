"use client";
import { useFormStatus } from "react-dom";
export function SubmitButton({ children, variant = "dark" }: { children: React.ReactNode; variant?: "dark" | "light" }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} className={`pill w-full disabled:opacity-50 ${variant === "dark" ? "pill-dark" : "pill-light"}`}>{pending ? "Connecting…" : children}</button>;
}
