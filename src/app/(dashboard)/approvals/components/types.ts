export type ApprovalRow = {
  approval: {
    id: string;
    deferralId: string;
    stepRole: string;
    stepOrder: number;
    status: "PENDING" | "APPROVED" | "REJECTED" | "SKIPPED";
    isActive: boolean;
    comment: string;
    signedAt: string | null;
    targetDepartment?: string | null;
  };
  deferral: {
    id: string;
    deferralCode: string;
    initiatorDepartment: string;
    status: string;
    updatedAt: string;
  };
};

export type Profile = {
  id: string;
  role: string;
  name: string;
  department: string;
  position: string;
};

export type ApiRes = {
  ok: boolean;
  pending: ApprovalRow[];
  history: ApprovalRow[];
  parallelCounts: Record<
    string,
    { total: number; approved: number; pending: number }
  >;
};