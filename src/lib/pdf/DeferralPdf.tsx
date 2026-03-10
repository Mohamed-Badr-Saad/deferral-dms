// src/lib/pdf/DeferralPdf.tsx
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from "@react-pdf/renderer";
import { IMAGES, IMAGES_BASE64_CODE } from "../assets";

export type PdfDeferral = {
  deferralCode: string;

  initiatorName: string;
  initiatorPosition: string;
  initiatorDepartment: string;

  workOrderNo: string;
  workOrderTitle: string;

  equipmentTag: string;
  equipmentDescription: string;

  safetyCriticality: string;
  taskCriticality: string;

  lafdStartDate: Date | null;
  lafdEndDate: Date | null;

  createdAt: Date | null;

  description: string;
  justification: string;
  consequence: string;
  mitigations: string;
};

export type PdfRiskRow = {
  category: "PEOPLE" | "ASSET" | "ENVIRONMENT" | "REPUTATION";
  severity: number;
  likelihood: string;
  justification: string;
};

export type PdfApprovalRow = {
  stepOrder: number;
  stepRole: string;
  status: string;

  signerName: string;
  signerPosition: string;
  signedAt: Date | null;
  comment: string;

  // ✅ NEW: already-resolved, fetch-safe image for react-pdf
  signatureDataUri?: string | null;
};

function fmtDate(d: Date | null | undefined) {
  if (!d) return "—";
  return d.toLocaleDateString();
}

const styles = StyleSheet.create({
  page: { padding: 18, fontSize: 9, fontFamily: "Helvetica" },

  titleRow: {
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 12, fontWeight: 700 },

  spacer: { height: 8 },

  table: { borderWidth: 1, borderColor: "#000", width: "100%" },
  row: { flexDirection: "row" },
  cellLabel: {
    width: "28%",
    backgroundColor: "#8fb6e1",
    padding: 6,
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderBottomWidth: 1,
    borderBottomColor: "#000",
    fontWeight: 700,
  },
  cellValue: {
    width: "72%",
    padding: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#000",
  },

  blockLabel: { fontWeight: 700, marginBottom: 3 },
  blockBox: { borderWidth: 1, borderColor: "#000", padding: 6, minHeight: 42 },

  band: {
    backgroundColor: "#8fb6e1",
    borderWidth: 1,
    borderColor: "#000",
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
  },

  riskTable: { borderWidth: 1, borderColor: "#000" },
  riskHeaderRow: { flexDirection: "row", backgroundColor: "#d0d0d0" },
  riskRow: { flexDirection: "row" },
  riskCellCat: {
    width: "18%",
    borderRightWidth: 1,
    borderRightColor: "#000",
    borderTopWidth: 1,
    borderTopColor: "#000",
    padding: 6,
    backgroundColor: "#d0d0d0",
    fontWeight: 700,
  },
  riskCell: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 6,
  },

  approvalsBand: {
    backgroundColor: "#8fb6e1",
    borderWidth: 1,
    borderColor: "#000",
    padding: 6,
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 700,
    marginTop: 8,
  },
  approvalsTable: { borderWidth: 1, borderColor: "#000" },
  approvalsHeader: { flexDirection: "row", backgroundColor: "#d0d0d0" },
  approvalsRow: { flexDirection: "row" },
  aCell: {
    borderTopWidth: 1,
    borderTopColor: "#000",
    borderRightWidth: 1,
    borderRightColor: "#000",
    padding: 6,
  },

  // ✅ NEW: signature cell layout
  sigWrap: {
    width: "100%",
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  sigImg: {
    width: 70,
    height: 24,
    objectFit: "contain",
  },
  // NEW: wrapper row
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 6,
  },
  titleImageLeft: {
    width: 50,
    height: 40,
    marginLeft: 6,
  },
  titleWrapper: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  titleImageRight: {
    width: 50,
    height: 40,
    marginRight: 6,
  },
});

const Roles = {
  DEPARTMENT_HEAD: "Department Head",
  RELIABILITY_ENGINEER: "Reliability Engineer",
  RELIABILITY_GM: "Reliability GM",
  RESPONSIBLE_GM: "Responsible GM",
  PLANNING_ENGINEER: "Planning Engineer",
  ENGINEER_APPLICANT: "Engineer (Applicant)",
  SOD: "SOD",
  DFGM: "DFGM",
  TECHNICAL_AUTHORITY: "Technical Authority",
  AD_HOC: "AD HOC",
  PLANNING_SUPERVISOR_ENGINEER: "Planning Supervisor Engineer",
  ADMIN: "Admin",
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value || "—"}</Text>
    </View>
  );
}

export function DeferralPdfDoc(props: {
  deferral: PdfDeferral;
  risks: PdfRiskRow[];
  approvals: PdfApprovalRow[];
}) {
  const { deferral, risks, approvals } = props;

  const pickRisk = (cat: PdfRiskRow["category"]) =>
    risks.find((r) => r.category === cat);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.titleContainer}>
          <Image
            style={styles.titleImageLeft}
            src={IMAGES_BASE64_CODE.Rashid_Logo}
          />

          {/* Center Title */}
          <View style={styles.titleWrapper}>
            <Text style={styles.title}>
              MAINTENANCE AND INSPECTION ACTIVITY DEFERRAL FORM
            </Text>
          </View>
          {/* Right Image */}
          <Image
            style={styles.titleImageRight}
            src={IMAGES_BASE64_CODE.Burullus_Logo}
          />
        </View>

        <View style={styles.spacer} />

        <View style={styles.table}>
          <InfoRow label="Deferral Code" value={deferral.deferralCode} />
          <InfoRow label="Initiator Name" value={deferral.initiatorName} />
          <InfoRow label="Job Title" value={deferral.initiatorPosition} />
          <InfoRow label="Department" value={deferral.initiatorDepartment} />
          <InfoRow
            label="Work Order(s) Number(s)"
            value={deferral.workOrderNo}
          />
          <InfoRow label="Work Order Title" value={deferral.workOrderTitle} />
          <InfoRow
            label="Equipment Full Code(s)"
            value={deferral.equipmentTag}
          />
          <InfoRow
            label="Equipment Description"
            value={deferral.equipmentDescription}
          />
          <InfoRow
            label="Equipment Safety Criticality"
            value={deferral.safetyCriticality}
          />
          <InfoRow label="Task Criticality" value={deferral.taskCriticality} />
          <InfoRow
            label="Deferral Request Date"
            value={fmtDate(deferral.createdAt)}
          />
          <InfoRow
            label="Current LAFD"
            value={fmtDate(deferral.lafdStartDate)}
          />
          <InfoRow
            label="Deferred To (New LAFD)"
            value={fmtDate(deferral.lafdEndDate)}
          />
        </View>

        <View style={styles.spacer} />

        <Text style={styles.blockLabel}>Description:</Text>
        <View style={styles.blockBox}>
          <Text>{deferral.description || "—"}</Text>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.blockLabel}>Justification:</Text>
        <View style={styles.blockBox}>
          <Text>{deferral.justification || "—"}</Text>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.blockLabel}>Consequence:</Text>
        <View style={styles.blockBox}>
          <Text>{deferral.consequence || "—"}</Text>
        </View>

        <View style={styles.spacer} />

        <Text style={styles.blockLabel}>Mitigations:</Text>
        <View style={styles.blockBox}>
          <Text>{deferral.mitigations || "—"}</Text>
        </View>

        <View style={styles.spacer} />

        <View style={styles.band}>
          <Text>Associated Risk (If Needed):</Text>
        </View>

        <View style={styles.riskTable}>
          <View style={styles.riskHeaderRow}>
            <Text
              style={[styles.riskCellCat, { backgroundColor: "#d0d0d0" }]}
            />
            <Text style={[styles.riskCell, { width: "18%", fontWeight: 700 }]}>
              Severity
            </Text>
            <Text style={[styles.riskCell, { width: "18%", fontWeight: 700 }]}>
              Likelihood
            </Text>
            <Text
              style={[
                styles.riskCell,
                { width: "46%", fontWeight: 700, borderRightWidth: 0 },
              ]}
            >
              Justification
            </Text>
          </View>

          {(["PEOPLE", "ASSET", "ENVIRONMENT", "REPUTATION"] as const).map(
            (cat) => {
              const r = pickRisk(cat);
              return (
                <View key={cat} style={styles.riskRow}>
                  <Text style={styles.riskCellCat}>
                    {cat === "PEOPLE"
                      ? "People"
                      : cat === "ASSET"
                        ? "Asset"
                        : cat === "ENVIRONMENT"
                          ? "Environment"
                          : "Reputation"}
                  </Text>
                  <Text style={[styles.riskCell, { width: "18%" }]}>
                    {r ? String(r.severity) : "—"}
                  </Text>
                  <Text style={[styles.riskCell, { width: "18%" }]}>
                    {r ? r.likelihood : "—"}
                  </Text>
                  <Text
                    style={[
                      styles.riskCell,
                      { width: "46%", borderRightWidth: 0 },
                    ]}
                  >
                    {r?.justification ?? ""}
                  </Text>
                </View>
              );
            },
          )}
        </View>

        <View style={styles.spacer} />
      </Page>

      <Page size="A4" style={styles.page}>
        <View style={styles.approvalsBand}>
          <Text>Approvals / Signatures</Text>
        </View>

        <View style={styles.approvalsTable}>
          <View style={styles.approvalsHeader}>
            <Text style={[styles.aCell, { width: "23%", fontWeight: 700 }]}>
              Role
            </Text>
            <Text style={[styles.aCell, { width: "23%", fontWeight: 700 }]}>
              Name
            </Text>
            <Text style={[styles.aCell, { width: "16%", fontWeight: 700 }]}>
              Position
            </Text>

            {/* ✅ NEW */}
            <Text style={[styles.aCell, { width: "18%", fontWeight: 700 }]}>
              Signature
            </Text>

            <Text style={[styles.aCell, { width: "10%", fontWeight: 700 }]}>
              Date
            </Text>
            <Text
              style={[
                styles.aCell,
                { width: "10%", fontWeight: 700, borderRightWidth: 0 },
              ]}
            >
              Comment
            </Text>
          </View>

          {approvals.map((a, idx) => (
            <View key={`${a.stepOrder}-${idx}`} style={styles.approvalsRow}>
              <Text style={[styles.aCell, { width: "23%" }]}>{Roles[a.stepRole]}</Text>
              <Text style={[styles.aCell, { width: "23%" }]}>
                {a.signerName || "—"}
              </Text>
              <Text style={[styles.aCell, { width: "16%" }]}>
                {a.signerPosition || "—"}
              </Text>

              {/* ✅ NEW signature column */}
              <View style={[styles.aCell, { width: "18%" }]}>
                <View style={styles.sigWrap}>
                  {a.signatureDataUri ? (
                    <Image style={styles.sigImg} src={a.signatureDataUri} />
                  ) : a.signerName ? (
                    <Text>{`Signed by: ${a.signerName}`}</Text>
                  ) : (
                    <Text>—</Text>
                  )}
                </View>
              </View>

              <Text style={[styles.aCell, { width: "10%" }]}>
                {fmtDate(a.signedAt)}
              </Text>
              <Text
                style={[styles.aCell, { width: "10%", borderRightWidth: 0 }]}
              >
                {a.comment ? ` ${a.comment}` : "-"}
              </Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}
