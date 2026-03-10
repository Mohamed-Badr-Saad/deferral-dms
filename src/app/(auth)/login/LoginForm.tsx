"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm() {
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dms_remember_me");
      if (saved !== null) setRememberMe(saved === "true");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("dms_remember_me", String(rememberMe));
    } catch {}
  }, [rememberMe]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          rememberMe,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message ?? "Invalid credentials");
        setLoading(false);
        return;
      }

      toast.success("Logged in");
      window.location.href = "/dashboard";
    } catch {
      toast.error("Server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg">Welcome back</CardTitle>
        <p className="text-sm text-muted-foreground">
          Sign in to manage deferrals and approvals.
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>

              <div className="relative">
                <Input
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  className="pr-10"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="rememberMe"
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(Boolean(v))}
            />
            <Label htmlFor="rememberMe" className="text-sm">
              Keep me signed in
            </Label>
          </div>

          <Button className="w-full" disabled={loading} type="submit">
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Don’t have an account?{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href="/signup"
            >
              Sign up
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
