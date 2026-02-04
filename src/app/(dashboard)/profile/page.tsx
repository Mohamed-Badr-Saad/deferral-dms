"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SignatureCropDialog } from "@/src/components/profile/SignatureCropDialog";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";

type Profile = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: string;
  signatureUrl?: string | null;
  signatureUploadedAt?: string | null;
};

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card/70 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);

  // edit mode
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");

  async function load() {
    setLoading(true);
    try {
      const res = await api<{ profile: Profile }>("/api/profile");
      setProfile(res.profile);

      // seed edit form
      setName(res.profile.name ?? "");
      setDepartment(res.profile.department ?? "");
      setPosition(res.profile.position ?? "");
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to load profile" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signatureInfo = useMemo(() => {
    if (!profile?.signatureUploadedAt) return "Not uploaded";
    return new Date(profile.signatureUploadedAt).toLocaleString();
  }, [profile?.signatureUploadedAt]);

  function onPickFile(file: File) {
    const url = URL.createObjectURL(file);
    setRawImageSrc(url);
    setCropOpen(true);
  }

  async function uploadCropped(blob: Blob) {
    const form = new FormData();
    form.append(
      "file",
      new File([blob], "signature.png", { type: "image/png" }),
    );

    const res = await fetch("/api/profile/signature", {
      method: "POST",
      body: form,
    });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      toast("Upload failed", {
        description: json?.detail ?? json?.message ?? "Server error",
      });
      return;
    }

    toast("Saved", { description: "Your signature was updated." });
    await load();
  }

  async function saveProfile() {
    setSaving(true);
    try {
      // ✅ This requires an API route. If you don't have it yet, it will fail gracefully.
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, department, position }),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        toast("Save failed", {
          description: json?.message ?? json?.detail ?? "Server error",
        });
        return;
      }

      toast("Saved", { description: "Profile updated." });
      setEditing(false);
      await load();
    } catch {
      toast("Save failed", { description: "Server error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account and signature.
          </p>
        </div>

        {!loading && profile && (
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button variant="outline" onClick={() => setEditing(true)}>
                Edit profile
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    // reset
                    setName(profile.name ?? "");
                    setDepartment(profile.department ?? "");
                    setPosition(profile.position ?? "");
                    setEditing(false);
                  }}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button onClick={saveProfile} disabled={saving}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Card className="rounded-2xl border bg-card/80 backdrop-blur">
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>

        <CardContent>
          {loading || !profile ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : !editing ? (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Name" value={profile.name} />
              <Field label="Email" value={profile.email} />
              <Field label="Department" value={profile.department} />
              <Field label="Position" value={profile.position} />
              <Field label="Role" value={profile.role} />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={profile.email} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
                <Input
                  id="department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={profile.role} disabled />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border bg-card/80 backdrop-blur">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-base">Signature</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Used for approvals where your signature is required.
            </p>
          </div>
          <div className="text-xs text-muted-foreground">
            Last upload: {signatureInfo}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            {profile?.signatureUrl ? (
              <Image
                src={profile.signatureUrl}
                alt="signature"
                width={420}
                height={64}
                className="h-16 w-auto max-w-[420px] object-contain"
              />
            ) : (
              <div className="text-sm text-muted-foreground">
                No signature uploaded. Approvals will fall back to your name +
                date.
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                  e.currentTarget.value = "";
                }}
              />
              <Button asChild>
                <span>Upload & Trim</span>
              </Button>
            </label>

            <div className="text-xs text-muted-foreground">
              Upload an image, then crop tightly around the signature.
            </div>
          </div>
        </CardContent>
      </Card>

      {rawImageSrc && (
        <SignatureCropDialog
          open={cropOpen}
          onOpenChange={(v) => setCropOpen(v)}
          imageSrc={rawImageSrc}
          onCropped={uploadCropped}
        />
      )}
    </div>
  );
}
