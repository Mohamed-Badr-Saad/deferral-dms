"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Check } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Eye, EyeOff } from "lucide-react";

const DEPARTMENTS = [
  "Electrical",
  "Mechanical",
  "instrument",
  "Turbo",
  "Civil",
  "HVAC",
  "Telecom",
  "Condition monitoring",
  "inspection",
  "painting",
  "Subsea control",
  "Production",
] as const;

export default function SignupPage() {
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [deptOpen, setDeptOpen] = useState(false);

  const deptLabel = useMemo(() => {
    return department?.trim() ? department : "Select department…";
  }, [department]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, name, department, position }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        toast.error(data?.message ?? "Server error");
        setLoading(false);
        return;
      }

      toast.success("Account created");
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
        <CardTitle className="text-lg">Create your account</CardTitle>
        <p className="text-sm text-muted-foreground">
          You start as <span className="font-medium">Engineer (Applicant)</span>
          . Admin assigns roles later.
        </p>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="grid gap-4">
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  autoComplete="name"
                  required
                />
              </div>

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

            <div className="grid gap-3 md:grid-cols-2">
              {/* ✅ Searchable department dropdown */}
              <div className="space-y-2">
                <Label>Department</Label>

                {/* Hidden input to keep native form semantics */}
                <input type="hidden" value={department} />

                <Popover open={deptOpen} onOpenChange={setDeptOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between"
                    >
                      <span
                        className={department ? "" : "text-muted-foreground"}
                      >
                        {deptLabel}
                      </span>
                      <ChevronsUpDown className="h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent
                    align="start"
                    sideOffset={8}
                    className="z-50 w-[--radix-popover-trigger-width] p-0 overflow-hidden rounded-xl border bg-white text-slate-900 shadow-lg dark:bg-slate-950 dark:text-slate-50"
                  >
                    <Command className="bg-transparent text-inherit">
                      <CommandInput placeholder="Search department..." />
                      <CommandEmpty>No department found.</CommandEmpty>

                      {/* fixed height + scroll */}
                      <CommandList className="max-h-56 overflow-auto">
                        <CommandGroup>
                          {DEPARTMENTS.map((d) => (
                            <CommandItem
                              key={d}
                              value={d}
                              onSelect={(value) => {
                                setDepartment(value);
                                setDeptOpen(false);
                              }}
                            >
                              <Check
                                className={[
                                  "mr-2 h-4 w-4",
                                  department === d
                                    ? "opacity-100"
                                    : "opacity-0",
                                ].join(" ")}
                              />
                              {d}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

                {/* enforce required behavior */}
                {!department?.trim() && (
                  <p className="text-xs text-muted-foreground">
                    Please select a department.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  placeholder="Engineer"
                  required
                />
              </div>
            </div>
          </div>

          <Button
            className="w-full"
            disabled={loading || !department.trim()}
            type="submit"
          >
            {loading ? "Creating..." : "Create account"}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              className="text-foreground underline underline-offset-4"
              href="/login"
            >
              Sign in
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
