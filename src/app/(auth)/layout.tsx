import { IMAGES, IMAGES_BASE64_CODE } from "@/src/lib/assets";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-muted/40 via-background to-background" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-muted/40 blur-3xl" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-6 py-10">
        {/* Card container */}
        <div className="w-full max-w-md">
          {/* Brand header */}
          <div className="mb-6 text-center">
            <div className=" mb-4 flex items-center justify-center gap-4">
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
                width={82}
                height={82}
                className="rounded-2xl"
              />
              <Image
                src={IMAGES_BASE64_CODE.SHELL_JV}
                alt="SHELL JV Logo"
                width={90}
                height={90}
                className="rounded-2xl"
              />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
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
