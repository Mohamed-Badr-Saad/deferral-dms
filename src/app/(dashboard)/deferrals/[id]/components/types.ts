import { ApprovalStatus } from "@/src/components/deferral/GmDecisionPanel";

export type Deferral = {
  id: string;
  deferralCode: string;
  status: string;
  workOrderNo: string;
  workOrderTitle: string;
  initiatorUserId: string;
  initiatorDepartment: string;

  equipmentTag: string;
  equipmentDescription: string;

  taskCriticality: string; // YES/NO
  safetyCriticality: string; // YES/NO

  originalLafd: string | null;
  lafdStartDate: string | null;
  lafdEndDate: string | null;

  description: string;
  justification: string;
  consequence: string;

  mitigationRows: Array<{
    id?: string;
    mitigationText: string;
    requiredDepartment: string;
  }>;
  // legacy single RAM fields (still in deferrals table)
  riskCategory: string;
  severity: number;
  likelihood: string;
  ramCell: string;
  ramConsequenceLevel: string;

  requiresTechnicalAuthority: boolean;
  requiresAdHoc: boolean;

  updatedAt: string;
  createdAt?: string;

  deletedReason?: string | null;
  returnedAt?: string;
  returnedByRole?: string;
  returnedComment?: string;
};

export type Profile = {
  id: string;
  role: string;
  name: string;
  department: string;
  position: string;
  gmGroup?: string | null;
};

export type ApprovalRow = {
  id: string;
  deferralId: string;
  stepOrder: number;
  stepRole: string;
  status: ApprovalStatus;
  isActive: boolean;
  comment: string;
  assignedUserId?: string | null;
  targetDepartment?: string | null;
  targetGmGroup?: string | null;
  signedAt: string | null;
};

export type RiskCategory = "PEOPLE" | "ASSET" | "ENVIRONMENT" | "REPUTATION";
export type RiskRow = {
  category: RiskCategory;
  severity: number;
  likelihood: string;
  ramCell: string;
  ramConsequenceLevel: string;
  justification: string;
};

export type Attachment = {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath: string;
  uploadedAt: string;
};



export type DuplicateDialogState = null | {
  source: "change" | "submit";
  duplicateRank: number;
  existingCount: number;
  needsConfirmation: boolean;
  blocked: boolean;
  message: string;
  workOrderNo: string;
  workOrderTitle?: string;
};
