"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/src/lib/api";
import { toast } from "sonner";
import {
  USER_ROLES,
  USER_ROLE_LABELS,
  type UserRole,
} from "@/src/lib/constants";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { GM_GROUPS, GmGroup } from "@/src/lib/gm-group";

type UserRow = {
  id: string;
  email: string;
  name: string;
  department: string;
  position: string;
  role: UserRole;
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

export default function AdminPage() {
  const [tab, setTab] = useState<"users" | "mappings">("users");

  // Users
  const [uq, setUq] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersItems, setUsersItems] = useState<UserRow[]>([]);

  
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
    if (!confirm("Delete this mapping?")) return;
    try {
      await api(`/api/admin/responsible-gm/${id}`, { method: "DELETE" });
      toast("Deleted", { description: "Mapping removed." });
      await loadMappings();
    } catch (e: any) {
      toast("Error", { description: e.message ?? "Failed to delete mapping" });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <div className="text-sm text-muted-foreground">
          Manage user roles and Responsible GM mappings.
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="users">Users & Roles</TabsTrigger>
          <TabsTrigger value="mappings">Responsible GM Mappings</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <Card>
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle className="text-base">Users</CardTitle>
              <div className="flex gap-2">
                <Input
                  value={uq}
                  onChange={(e) => setUq(e.target.value)}
                  placeholder="Search email / name / department..."
                  className="md:w-80"
                />
                <Button
                  variant="secondary"
                  onClick={loadUsers}
                  disabled={usersLoading}
                >
                  Refresh
                </Button>
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
                <div className="rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Email</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Signature</TableHead>
                        <TableHead>GM Group</TableHead>
                        <TableHead className="w-[260px]">Role</TableHead>
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
                              value={u.gmGroup}
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
              <div className="flex gap-2">
                <Input
                  value={mq}
                  onChange={(e) => setMq(e.target.value)}
                  placeholder="Search department..."
                  className="md:w-72"
                />
                <Button
                  variant="secondary"
                  onClick={loadMappings}
                  disabled={mLoading}
                >
                  Refresh
                </Button>

                <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                  <DialogTrigger asChild>
                    <Button>Add</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Responsible GM Mapping</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Department</Label>
                        <Input
                          value={newDept}
                          onChange={(e) => setNewDept(e.target.value)}
                          placeholder="e.g. Electrical"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>GM Group</Label>
                        <Select
                          value={newGroup}
                          onValueChange={(v) => setNewGroup(v as any)}
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
                <div className="rounded-lg border">
                  <Table>
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
                            <Input
                              value={m.department}
                              onChange={(e) => {
                                const next = e.target.value;
                                setMItems((prev) =>
                                  prev.map((x) =>
                                    x.id === m.id
                                      ? { ...x, department: next }
                                      : x,
                                  ),
                                );
                              }}
                              onBlur={() =>
                                updateMapping(m.id, {
                                  department: m.department,
                                })
                              }
                            />
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
                            <Button
                              variant="destructive"
                              onClick={() => deleteMapping(m.id)}
                            >
                              Delete
                            </Button>
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
