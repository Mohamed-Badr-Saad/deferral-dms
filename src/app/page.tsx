import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12">
        <header className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">
              Deferral Management System
            </h1>
            <p className="text-sm text-muted-foreground">
              Create, approve, and track deferrals through a controlled workflow.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="secondary">
              <Link href="/login">Login</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Workflow-driven</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Multi-step approvals with signatures, comments, and refusals.
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Risk Matrix</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Severity × Likelihood produces consistent consequence scoring.
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="text-base">Traceable</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Track 1st/2nd/3rd deferral per work order and full approval history.
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Next steps</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            We’ll implement Better Auth (UUID IDs), Signup/Login UI, and start the
            dashboard layout.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
