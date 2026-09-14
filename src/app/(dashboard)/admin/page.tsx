"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import { ShieldCheck, UserPlus, Users as UsersIcon, Network, Trash2 } from "lucide-react";
import {
  DEPARTMENTS,
  USER_ROLES,
  USER_ROLE_LABELS,
  type UserRole,
} from "@/src/lib/constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { GM_GROUPS, GmGroup } from "@/src/lib/gm-group";

type UserRow = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: UserRole;
  gmGroup: GmGroup | null;
  signatureUrl?: string | null;
  signatureUploadedAt?: string | null;
};

type GmMapping = {
  id: string;
  department: string;
  gmGroup:
    | "MAINTENANCE_GM"
    | "FACILITY_SUPPORT_GM"
    | "SUBSEA_CONTROL_GM"
    | "PRODUCTION_GM";
  createdAt: string;
  updatedAt: string;
};

const GM_GROUP_LABELS: Record<GmMapping["gmGroup"], string> = {
  MAINTENANCE_GM: "Maintenance GM",
  FACILITY_SUPPORT_GM: "Facility Support GM",
  SUBSEA_CONTROL_GM: "Subsea Control GM",
  PRODUCTION_GM: "Production GM",
};

const NO_GM_GROUP = "__none__";

const emptyNewUser = {
  name: "",
  email: "",
  password: "",
  department: "",
  position: "",
  role: "ENGINEER_APPLICANT" as UserRole,
  gmGroup: NO_GM_GROUP as string,
};

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "mappings">("users");

  // Users
  const [uq, setUq] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersItems, setUsersItems] = useState<UserRow[]>([]);

  // Add user dialog
  const [addUserOpen, setAddUserOpen] = useState(false);
  const [addUserBusy, setAddUserBusy] = useState(false);
  const [newUser, setNewUser] = useState(emptyNewUser);

  // Delete user
  const [deleteUserBusy, setDeleteUserBusy] = useState<string | null>(null);

  // Mappings
  const [mq, setMq] = useState("");
  const [mLoading, setMLoading] = useState(true);
  const [mItems, setMItems] = useState<GmMapping[]>([]);

  // Create mapping dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newDept, setNewDept] = useState("");
  const [newGroup, setNewGroup] =
    useState<GmMapping["gmGroup"]>("MAINTENANCE_GM");
  const [createBusy, setCreateBusy] = useState(false);

  async function loadUsers() {
    setUsersLoading(true);
    try {
      const res = await api<{ items: UserRow[] }>(
        `/api/admin/users?q=${encodeURIComponent(uq.trim())}`,
      );
      setUsersItems(res.items ?? []);
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to load users" });
    } finally {
      setUsersLoading(false);
    }
  }

  async function loadMappings() {
    setMLoading(true);
    try {
      const res = await api<{ items: GmMapping[] }>(
        `/api/admin/responsible-gm?q=${encodeURIComponent(mq.trim())}`,
      );
      setMItems(res.items ?? []);
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to load mappings" });
    } finally {
      setMLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = uq.trim().toLowerCase();
    if (!needle) return usersItems;
    return usersItems.filter((u) => {
      return (
        u.email.toLowerCase().includes(needle) ||
        u.name.toLowerCase().includes(needle) ||
        u.department.toLowerCase().includes(needle) ||
        u.position.toLowerCase().includes(needle)
      );
    });
  }, [usersItems, uq]);

  const filteredMappings = useMemo(() => {
    const needle = mq.trim().toLowerCase();
    if (!needle) return mItems;
    return mItems.filter((m) => m.department.toLowerCase().includes(needle));
  }, [mItems, mq]);

  const adminCount = useMemo(
    () => usersItems.filter((u) => u.role === "ADMIN").length,
    [usersItems],
  );

  async function changeUserRole(userId: string, role: UserRole) {
    try {
      await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        json: { role },
      });
      toast("Saved", { description: "Role updated." });
      await loadUsers();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to update role" });
    }
  }

  async function changeGMGroup(userId: string, gmGroup: GmGroup) {
    try {
      await api(`/api/admin/users/${userId}`, {
        method: "PATCH",
        json: { gmGroup },
      });
      toast("Saved", { description: "GM group updated." });
      await loadUsers();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to update GM group" });
    }
  }

  async function createUser() {
    if (
      !newUser.name.trim() ||
      !newUser.email.trim() ||
      !newUser.password ||
      !newUser.department ||
      !newUser.position.trim()
    ) {
      toast("Validation error", {
        description: "Name, email, password, department and position are required.",
      });
      return;
    }
    if (newUser.password.length < 8) {
      toast("Validation error", {
        description: "Password must be at least 8 characters.",
      });
      return;
    }

    setAddUserBusy(true);
    try {
      await api(`/api/admin/users`, {
        method: "POST",
        json: {
          name: newUser.name.trim(),
          email: newUser.email.trim(),
          password: newUser.password,
          department: newUser.department,
          position: newUser.position.trim(),
          role: newUser.role,
          gmGroup: newUser.gmGroup === NO_GM_GROUP ? null : newUser.gmGroup,
        },
      });
      toast("Account created", {
        description: `${newUser.name.trim()} can now sign in.`,
      });
      setAddUserOpen(false);
      setNewUser(emptyNewUser);
      await loadUsers();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to create account" });
    } finally {
      setAddUserBusy(false);
    }
  }

  async function deleteUser(userId: string) {
    setDeleteUserBusy(userId);
    try {
      await api(`/api/admin/users/${userId}`, { method: "DELETE" });
      toast("Account removed", { description: "The account was deleted." });
      await loadUsers();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to remove account" });
    } finally {
      setDeleteUserBusy(null);
    }
  }

  async function createMapping() {
    if (!newDept.trim()) {
      toast("Validation error", { description: "Department is required." });
      return;
    }
    setCreateBusy(true);
    try {
      await api(`/api/admin/responsible-gm`, {
        method: "POST",
        json: { department: newDept.trim(), gmGroup: newGroup },
      });
      toast("Created", { description: "Mapping added." });
      setCreateOpen(false);
      setNewDept("");
      setNewGroup("MAINTENANCE_GM");
      await loadMappings();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to create mapping" });
    } finally {
      setCreateBusy(false);
    }
  }

  async function updateMapping(
    id: string,
    patch: Partial<Pick<GmMapping, "department" | "gmGroup">>,
  ) {
    try {
      await api(`/api/admin/responsible-gm/${id}`, {
        method: "PATCH",
        json: patch,
      });
      toast("Saved", { description: "Mapping updated." });
      await loadMappings();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to update mapping" });
    }
  }

  async function deleteMapping(id: string) {
    try {
      await api(`/api/admin/responsible-gm/${id}`, { method: "DELETE" });
      toast("Deleted", { description: "Mapping removed." });
      await loadMappings();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to delete mapping" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-xl border bg-gradient-to-br from-primary/5 via-background to-background p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">Admin</h1>
            <div className="text-sm text-muted-foreground">
              Manage user accounts, roles, and Responsible GM mappings.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
            <UsersIcon className="h-3.5 w-3.5" />
            {usersItems.length} users
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            {adminCount} admin{adminCount === 1 ? "" : "s"}
          </Badge>
          <Badge variant="secondary" className="gap-1.5 px-3 py-1.5 text-sm">
            <Network className="h-3.5 w-3.5" />
            {mItems.length} mappings
          </Badge>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <div className="w-full overflow-x-auto pb-1">
          <TabsList className="h-auto w-max min-w-full justify-start gap-1 p-1">
            <TabsTrigger value="users" className="h-9 flex-none px-4">
              Users & Roles
            </TabsTrigger>
            <TabsTrigger value="mappings" className="h-9 flex-none px-4">
              Responsible GM Mappings
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Users</CardTitle>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                <Input
                  value={uq}
                  onChange={(e) => setUq(e.target.value)}
                  placeholder="Search email / name / department..."
                  className="md:w-80"
                />
                <Button
                  variant="secondary"
                  className="w-full md:w-auto"
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  Refresh
                </Button>

                <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full gap-1.5 md:w-auto">
                      <UserPlus className="h-4 w-4" />
                      Add Account
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Account</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Full name</Label>
                          <Input
                            value={newUser.name}
                            onChange={(e) =>
                              setNewUser((s) => ({ ...s, name: e.target.value }))
                            }
                            placeholder="Full name"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Email</Label>
                          <Input
                            type="email"
                            value={newUser.email}
                            onChange={(e) =>
                              setNewUser((s) => ({ ...s, email: e.target.value }))
                            }
                            placeholder="name@company.com"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Temporary password</Label>
                        <Input
                          type="text"
                          value={newUser.password}
                          onChange={(e) =>
                            setNewUser((s) => ({ ...s, password: e.target.value }))
                          }
                          placeholder="At least 8 characters"
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Department</Label>
                          <Select
                            value={newUser.department}
                            onValueChange={(v) =>
                              setNewUser((s) => ({ ...s, department: v }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select department..." />
                            </SelectTrigger>
                            <SelectContent>
                              {DEPARTMENTS.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Position</Label>
                          <Input
                            value={newUser.position}
                            onChange={(e) =>
                              setNewUser((s) => ({ ...s, position: e.target.value }))
                            }
                            placeholder="Engineer"
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Role</Label>
                          <Select
                            value={newUser.role}
                            onValueChange={(v) =>
                              setNewUser((s) => ({ ...s, role: v as UserRole }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {USER_ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {USER_ROLE_LABELS[r]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>GM group (optional)</Label>
                          <Select
                            value={newUser.gmGroup}
                            onValueChange={(v) =>
                              setNewUser((s) => ({ ...s, gmGroup: v }))
                            }
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={NO_GM_GROUP}>None</SelectItem>
                              {GM_GROUPS.map((g) => (
                                <SelectItem key={g} value={g}>
                                  {g}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setAddUserOpen(false);
                            setNewUser(emptyNewUser);
                          }}
                          disabled={addUserBusy}
                        >
                          Cancel
                        </Button>
                        <Button onClick={createUser} disabled={addUserBusy}>
                          {addUserBusy ? "Creating..." : "Create account"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No users found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[1020px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Signature</TableHead>
                        <TableHead>GM Group</TableHead>
                        <TableHead className="w-[240px]">Role</TableHead>
                        <TableHead className="w-[80px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell className="font-medium">
                            {u.email}
                          </TableCell>
                          <TableCell>{u.name}</TableCell>
                          <TableCell>{u.department}</TableCell>
                          <TableCell>{u.position}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {u.signatureUrl ? "Uploaded" : "Missing"}
                          </TableCell>

                          <TableCell>
                            <Select
                              value={u.gmGroup ?? NO_GM_GROUP}
                              onValueChange={(v) =>
                                changeGMGroup(u.id, v as GmGroup)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {GM_GROUPS.map((g) => (
                                  <SelectItem key={g} value={g}>
                                    {g}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell>
                            <Select
                              value={u.role}
                              onValueChange={(v) =>
                                changeUserRole(u.id, v as UserRole)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {USER_ROLES.map((r) => (
                                  <SelectItem key={r} value={r}>
                                    {USER_ROLE_LABELS[r]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>

                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                                  disabled={deleteUserBusy === u.id}
                                  aria-label={`Remove ${u.email}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Remove {u.name}&apos;s account?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This permanently deletes the login for{" "}
                                    <span className="font-medium">{u.email}</span>{" "}
                                    and their business profile. Deferrals or
                                    approvals they are linked to will keep the
                                    historical record but the account itself
                                    cannot sign in again. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => deleteUser(u.id)}
                                  >
                                    Remove account
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mappings" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">
                Responsible GM Mappings
              </CardTitle>
              <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row">
                <Input
                  value={mq}
                  onChange={(e) => setMq(e.target.value)}
                  placeholder="Search department..."
                  className="md:w-72"
                />
                <Button
                  variant="secondary"
                  className="w-full md:w-auto"
                  onClick={loadMappings}
                  disabled={mLoading}
                >
                  Refresh
                </Button>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full md:w-auto">Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Responsible GM Mapping</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Select value={newDept} onValueChange={setNewDept}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select department..." />
                          </SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>GM Group</Label>
                        <Select
                          value={newGroup}
                          onValueChange={(v) => setNewGroup(v as any)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(GM_GROUP_LABELS).map((k) => (
                              <SelectItem key={k} value={k}>
                                {GM_GROUP_LABELS[k as GmMapping["gmGroup"]]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setCreateOpen(false)}
                          disabled={createBusy}
                        >
                          Cancel
                        </Button>
                        <Button onClick={createMapping} disabled={createBusy}>
                          {createBusy ? "Saving..." : "Create"}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>

            <CardContent>
              {mLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : filteredMappings.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No mappings found.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead>Department</TableHead>
                        <TableHead>GM Group</TableHead>
                        <TableHead className="w-[220px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMappings.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell>
                            <Select
                              value={m.department}
                              onValueChange={(v) => {
                                setMItems((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id ? { ...x, department: v } : x,
                                  ),
                                );
                                updateMapping(m.id, { department: v });
                              }}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DEPARTMENTS.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                                {!DEPARTMENTS.includes(m.department as any) && (
                                  <SelectItem value={m.department}>
                                    {m.department} (legacy)
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={m.gmGroup}
                              onValueChange={(v) => {
                                setMItems((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id
                                      ? { ...x, gmGroup: v as any }
                                      : x,
                                  ),
                                );
                                updateMapping(m.id, { gmGroup: v as any });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.keys(GM_GROUP_LABELS).map((k) => (
                                  <SelectItem key={k} value={k}>
                                    {GM_GROUP_LABELS[k as GmMapping["gmGroup"]]}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="flex gap-2">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="destructive">Delete</Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    Delete this mapping?
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {m.department} will no longer route to{" "}
                                    {GM_GROUP_LABELS[m.gmGroup]}. This cannot be
                                    undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-white hover:bg-destructive/90"
                                    onClick={() => deleteMapping(m.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
