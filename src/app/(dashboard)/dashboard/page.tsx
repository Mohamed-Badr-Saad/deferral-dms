import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function StatCard({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <Card className="rounded-2xl border bg-card/80 backdrop-blur">
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">{title}</CardTitle>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </CardHeader>
      <CardContent>
        <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
          Coming next.
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of deferrals and approvals.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="My Drafts" subtitle="Deferrals you’re still editing" />
        <StatCard
          title="Pending Approvals"
          subtitle="Items waiting for your action"
        />
        <StatCard title="Completed" subtitle="Recently completed workflows" />
      </div>

      <Card className="rounded-2xl border bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Activity</CardTitle>
          <p className="text-sm text-muted-foreground">
            This section will show your latest submissions and approvals.
          </p>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border bg-muted/30 p-6 text-sm text-muted-foreground">
            Coming next.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
