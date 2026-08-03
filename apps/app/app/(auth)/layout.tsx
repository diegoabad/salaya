import { BrandLogo } from "@/components/layouts/brand-logo";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 70% 45% at 50% -10%, rgba(204,255,0,0.12), transparent 60%)",
        }}
      />

      <div className="flex flex-1 flex-col justify-center px-4 py-10">
        <div className="mx-auto mb-8 flex w-full max-w-sm justify-center">
          <BrandLogo height={64} />
        </div>
        {children}
      </div>

      <p className="pb-8 text-center text-sm text-muted">
        <Link href="/" className="underline hover:text-brand">
          Volver al directorio
        </Link>
      </p>
    </div>
  );
}
