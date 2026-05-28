import { IMAGES_BASE64_CODE } from "@/src/lib/assets";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background">
      {/* Subtle background */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[min(820px,100vw)] -translate-x-1/2 rounded-full bg-muted/40 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-start justify-center px-4 py-8 sm:items-center sm:px-6 sm:py-10">
        {/* Card container */}
        <div className="w-full max-w-md min-w-0">
          {/* Brand header */}
          <div className="mb-6 text-center">
            <div className="mb-4 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
              {/* <Image
                src={IMAGES.Burullus_Logo}
                alt="Burullus Logo"
                width={48}
                height={48}
                className="rounded-2xl"
              /> */}
              <Image
                src={IMAGES_BASE64_CODE.Rashid_Logo}
                alt="SHELL Logo"
                width={74}
                height={74}
                className="rounded-2xl sm:h-[82px] sm:w-[82px]"
              />
              <Image
                src={IMAGES_BASE64_CODE.SHELL_JV}
                alt="SHELL JV Logo"
                width={82}
                height={82}
                className="rounded-2xl sm:h-[90px] sm:w-[90px]"
              />
            </div>
            <h1 className="text-balance text-lg font-semibold tracking-tight sm:text-xl">
              Deferral Management System
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to manage deferrals and approvals.
            </p>
          </div>

          {children}

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-muted-foreground">
            © {new Date().getFullYear()} DMS • Secure access
          </div>
        </div>
      </div>
    </div>
  );
}
