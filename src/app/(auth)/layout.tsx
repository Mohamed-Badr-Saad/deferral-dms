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
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border bg-background shadow-sm">
              <span className="text-sm font-semibold text-muted-foreground">
                DMS
              </span>
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
