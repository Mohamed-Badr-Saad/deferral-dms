"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function NewDeferralPage() {
  const router = useRouter();
  const [deferralCode, setDeferralCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function create() {
    setErr(null);
    if (!deferralCode.trim()) {
      setErr("Deferral code is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await api<{ item: { id: string } }>("/api/deferrals", {
        method: "POST",
        json: { deferralCode: deferralCode.trim() },
      });

      const id = res?.item?.id;
      if (!id) {
        throw new Error(
          "Create succeeded but response did not include item.id",
        );
      }

      router.push(`/deferrals/${id}`);
    } catch (e: any) {
      setErr(e.message ?? "Server error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-2">New Deferral</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Start by creating a draft, then fill the full form.
      </p>

      <Card>
        <CardHeader>
          <CardTitle>Draft Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Deferral Code</label>
            <Input
              value={deferralCode}
              onChange={(e) => setDeferralCode(e.target.value)}
              placeholder="WDDM-N-0001"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Must be unique. Example: WDDM-N-0001
            </p>
          </div>

          {err && <div className="text-sm text-destructive">{err}</div>}

          <div className="flex gap-2">
            <Button onClick={create} disabled={saving}>
              {saving ? "Creating..." : "Create Draft"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => router.push("/deferrals")}
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
