import Link from "next/link";
import {
  BookOpen,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  Bell,
  PenTool,
  FileCheck2,
  Users,
  Workflow,
  Search,
  BarChart3,
  MousePointerClick,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { BackToTopButton } from "./BackToTopButton";
import { GuideImage } from "./GuideImage";
import { GuideCarousel, type GuideSlide } from "./GuideCarousel";
import { HelpSidebar, type HelpNavGroup } from "./HelpSidebar";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  USER_ROLE_LABELS,
  type DeferralStatus,
} from "@/src/lib/constants";

// ---------------------------------------------------------------------------
// Content data
// ---------------------------------------------------------------------------

const navGroups: HelpNavGroup[] = [
  {
    label: "Overview",
    items: [
      { id: "introduction", label: "Introduction" },
      { id: "features", label: "App features" },
    ],
  },
  {
    label: "Getting started",
    items: [
      { id: "getting-started", label: "Create account & sign in" },
      { id: "signature", label: "Add your signature" },
      { id: "roles", label: "Roles & access" },
    ],
  },
  {
    label: "Using the app",
    items: [
      { id: "screens", label: "Main screens" },
      { id: "create-deferral", label: "Create a deferral" },
      { id: "search", label: "Search, filters & export" },
    ],
  },
  {
    label: "Approvals",
    items: [
      { id: "approvals", label: "Approval cycle & roles" },
      { id: "reviewer-actions", label: "Approve / return / reject" },
      { id: "gm-decision", label: "Reliability GM decision" },
      { id: "statuses", label: "Deferral statuses" },
    ],
  },
  {
    label: "Reference",
    items: [
      { id: "dashboard", label: "Dashboard & statistics" },
      { id: "notifications", label: "Notifications" },
      { id: "pdf", label: "PDF, signatures & profile" },
      { id: "buttons", label: "Buttons & actions" },
    ],
  },
];

const statusGuide: Array<{
  status: DeferralStatus;
  meaning: string;
  userAction: string;
}> = [
  {
    status: "DRAFT",
    meaning:
      "The deferral was created but has not entered the approval workflow. The initiator can still edit it freely.",
    userAction:
      "Complete all required fields, add risks, add mitigations, upload attachments, then submit. The initiator can permanently delete a draft.",
  },
  {
    status: "SUBMITTED",
    meaning:
      "A transitional state used when a record has just been submitted. In the current workflow, submitted records normally move directly into In Approval.",
    userAction:
      "No manual action is normally needed. If a record stays here unexpectedly, refresh the page or contact the administrator.",
  },
  {
    status: "RETURNED",
    meaning:
      "An approver sent the deferral back to the initiator for modification. The return reason is saved in the deferral history.",
    userAction:
      "The initiator edits the requested information, saves the changes, and submits the deferral again.",
  },
  {
    status: "IN_APPROVAL",
    meaning:
      "The deferral is moving through the approval cycle. The active approver can approve, return to initiator, or reject completely.",
    userAction:
      "Approvers should open the approval, review the details, add a comment when needed, and choose the correct decision.",
  },
  {
    status: "REJECTED",
    meaning:
      "The deferral was rejected completely by an approval user. It cannot be resubmitted by the initiator.",
    userAction:
      "Review the rejection reason in the approval timeline or deferral history. Create a new deferral only if a new business case exists.",
  },
  {
    status: "APPROVED",
    meaning:
      "All approval stages before Planning are complete. The deferral is waiting for the two Planning signatures.",
    userAction:
      "Planning Engineer and Planning Supervisor Engineer complete the final planning sign-offs.",
  },
  {
    status: "COMPLETED",
    meaning:
      "All approvals, including the two Planning approvals, have been signed. The deferral workflow is complete.",
    userAction:
      "The initiator can close the deferral if the work order has been executed before the new LAFD.",
  },
  {
    status: "CLOSED",
    meaning:
      "The initiator confirmed the job was executed and closed the deferral after completion.",
    userAction:
      "No approval action is needed. Use the record for history, reporting, and PDF export.",
  },
  {
    status: "DELETED",
    meaning:
      "The initiator requested deletion after the deferral had already entered approval. The record remains in the database with a deletion reason.",
    userAction:
      "Use filters or dashboards to audit deleted records and review the saved deletion reason.",
  },
  {
    status: "EXPIRED",
    meaning:
      "The new LAFD date has passed while the deferral was still active. The system can mark it expired through the expiry job.",
    userAction:
      "Review whether a 2nd/3rd deferral is needed or whether the work has been completed and should be closed.",
  },
];

const featureList = [
  "Structured deferral requests: work order, equipment, criticality, original/current/new LAFD, description, justification, and consequence of not deferring.",
  "RAM risk assessment: People, Asset, Environment, and Reputation severity/likelihood scoring with an auto-calculated risk cell and level.",
  "Mitigations with their own department-level approval, automatically routed to the head of the responsible department.",
  "A multi-step approval workflow that automatically routes the deferral through department, reliability, optional Technical Authority / AD HOC, parallel management sign-off, and planning stages.",
  "Digital signatures: every user uploads a personal signature once, and it is stamped on every approval, return, or rejection they perform.",
  "1st / 2nd / 3rd deferral tracking for the same work order, with a duplicate-work-order warning when starting a new one.",
  "Attachments on deferrals (PDF, PNG, JPG, WEBP up to 25 MB) kept with the record and included in the PDF export.",
  "Printable PDF export containing the full deferral, risk data, mitigations, approval timeline, and signatures.",
  "In-app notifications plus optional browser push notifications, so approvers are alerted even when the app tab isn't open.",
  "Expiry tracking: the system warns the initiator and reliability roles before a new LAFD date arrives.",
  "Dashboard with department, status, and deferral-rank breakdowns, scoped to what each role is allowed to see.",
  "Search, filtering, and CSV export of deferrals matching the current filters.",
  "Admin page for creating/removing user accounts, assigning roles and departments, and managing Responsible GM department mappings.",
];

const accountCreationSteps = [
  "Open the app's sign-up page (the “Create account” link on the sign-in screen, or the address your administrator shared with you).",
  "Enter your full name, work email address, and a password.",
  "Choose your Department from the dropdown. This determines which Department Head reviews deferrals you create, and which deferrals you review if your role is Department Head.",
  "Enter your Position (job title).",
  "Press Create account. You'll be signed in automatically.",
  "An administrator still needs to confirm your role (Applicant, Department Head, Reliability Engineer, etc.) from the Admin page — new accounts start with a basic role until assigned otherwise.",
];

const signInSteps = [
  "Open the app's sign-in page.",
  "Enter the email address and password used at sign-up.",
  "Press Sign in. You'll land on the Dashboard.",
  "The first time you sign in on a new browser, the app may ask permission to show notifications — choose Allow so you're alerted when a deferral needs your action, even if the tab isn't open.",
];

const signatureSteps = [
  "Open Profile from the sidebar or the user menu in the header.",
  "In the Signature section, press Upload & Trim and choose an image of your signature (a photo or scan works — plain background is best).",
  "Use the editor to crop tightly around the signature, then adjust rotation, brightness, and contrast until it's clean and legible.",
  "Press Save. Your signature is now stored and will automatically be stamped on every approval, return, or rejection you perform, and on any deferral PDF that includes your sign-off.",
  "You can repeat these steps at any time to replace your signature with a new one.",
];

const approvalSequence = [
  {
    role: "Department Head",
    detail:
      "Of the initiator's department — the first review of every deferral.",
  },
  {
    role: "Mitigation Department Heads",
    detail:
      "One per mitigation department selected on the deferral, reviewed in parallel.",
  },
  {
    role: "Reliability Engineer",
    detail: "Reviews after department and mitigation approvals are complete.",
  },
  {
    role: "Reliability GM",
    detail:
      "Reviews next, and decides whether Technical Authority and/or AD HOC review is required.",
  },
  {
    role: "Technical Authority / AD HOC",
    detail:
      "Only inserted into the cycle when the Reliability GM enables them.",
  },
  {
    role: "Parallel Sign-off Group",
    detail:
      "Responsible GM (always), plus SOD and DFGM in parallel for a 2nd/3rd deferral.",
  },
  {
    role: "Planning Engineer",
    detail: "GMS Integration sign-off.",
  },
  {
    role: "Planning Supervisor Engineer",
    detail: "Final signature — after this, the deferral becomes Completed.",
  },
];

const reviewerSteps = [
  "Open Approvals from the sidebar to see deferrals that need review, or open the deferral directly from a notification.",
  "Open the deferral details page and review the header information: deferral code, status, department, last update, initiator name, and job title.",
  "Review the Details tab: work order, equipment, LAFD dates, description, justification, consequence, RAM risk values, mitigations, and attachments.",
  "Review the Approvals tab to understand the current approval stage, previous comments, mitigation approvals, signatures, and parallel sign-off progress.",
  "If the reviewer is the active approval user, the action panel appears with a comment box and the Approve, Return to Initiator, and Reject Completely buttons.",
  "Add a comment when needed. A comment is required when returning or rejecting the deferral.",
  "Choose Approve when the deferral is acceptable and should move to the next approval step.",
  "Choose Return to Initiator when the deferral needs correction. The initiator can edit and submit it again.",
  "Choose Reject Completely when the deferral should be stopped permanently. The initiator cannot resubmit the same record after complete rejection.",
];

const reliabilityGmDecisionSteps = [
  "The Reliability GM Decision panel appears for the Reliability GM on the deferral details page.",
  "The panel is editable only while the Reliability GM approval step is active and still pending.",
  "Enable Requires Technical Authority when the deferral needs a Technical Authority signature before moving forward.",
  "Enable Requires AD HOC when the deferral needs an AD HOC signature before moving forward.",
  "Both Technical Authority and AD HOC can be enabled if both signatures are required.",
  "Press Save Decision before approving the Reliability GM step. Saving updates the approval timeline and inserts the selected optional approval steps.",
  "After the Reliability GM approval is signed, the decision is locked. TA/AD HOC routing cannot be changed from that panel after the GM step is no longer pending.",
];

const dashboardSteps = [
  "Department Deferrals:Department tabs show how many deferrals are in each status.",
  "Role visibility: Initiators and Department Heads see dashboard counts for their own department. Higher management roles can see all departments.",
  "First, second, and third deferrals: Counters show whether a deferral is the first, second, or third deferral created for the same work order.",
  "Active and history records: Active records include Draft, In Approval, Returned, and Approved. History records include Completed, Closed, Rejected, Deleted, and Expired.",
];

const creationSteps = [
  "Open Deferrals, then choose the new deferral action.",
  "Enter the Work Order number and title. If the same work order already has a deferral, the app warns the initiator so a second deferral is intentional and not a duplicate.",
  "Complete equipment information, equipment description, task criticality, and safety criticality.",
  "Enter Original LAFD, Current LAFD, and Deferred To (New LAFD). The new LAFD must be later than the current/original LAFD and cannot exceed the 6 month maximum.",
  "Complete RAM risk details for People, Asset, Environment, and Reputation, including severity, likelihood, cell, level, and justification.",
  "Add one or more mitigations. Each mitigation needs text and a required department. Each selected department head is added to the approval cycle after the initiator department head.",
  "Upload supporting attachments. Supported files are PDF, PNG, JPG, and WEBP, up to 25 MB per file.",
  "Save changes. Draft data is saved on tab change, when details are opened, and by using the save button.",
  "Submit the deferral. If required fields are missing, the app lists what must be completed before submission.",
];

const buttonGuide = [
  {
    name: "Apply",
    where: "Deferrals search",
    meaning: "Runs the search using the selected filters.",
  },
  {
    name: "Reset",
    where: "Deferrals search",
    meaning: "Clears filters and returns the search to its default state.",
  },
  {
    name: "Refresh results",
    where: "Deferrals search",
    meaning: "Reloads the current results without changing filters.",
  },
  {
    name: "Export CSV",
    where: "Deferrals search",
    meaning: "Exports the deferrals that match the current filters.",
  },
  {
    name: "Save",
    where: "Draft/edit forms",
    meaning: "Saves changed draft or returned deferral fields.",
  },
  {
    name: "Submit",
    where: "Deferral details",
    meaning: "Moves a draft or returned deferral into the approval workflow.",
  },
  {
    name: "Approve",
    where: "Approval panel",
    meaning: "Signs the active approval step and moves the workflow forward.",
  },
  {
    name: "Return to Initiator",
    where: "Approval panel",
    meaning:
      "Sends the deferral back for modification. A reason/comment is required.",
  },
  {
    name: "Reject Completely",
    where: "Approval panel",
    meaning:
      "Rejects the deferral permanently. The initiator cannot resubmit the same record.",
  },
  {
    name: "Save Decision",
    where: "Reliability GM Decision",
    meaning:
      "Saves whether Technical Authority and/or AD HOC signatures should be added to the approval cycle.",
  },
  {
    name: "Close deferral",
    where: "Deferral details/print tab",
    meaning:
      "Allows the initiator to close a completed deferral when the job has been executed before the new LAFD.",
  },
  {
    name: "Mark as deleted",
    where: "Deferral details",
    meaning:
      "Soft-deletes an in-approval deferral and stores the deletion reason.",
  },
  {
    name: "Delete draft",
    where: "Deferral details",
    meaning:
      "Permanently removes the initiator's draft from the database before it enters approval.",
  },
  {
    name: "Export PDF",
    where: "Print tab",
    meaning:
      "Downloads the printable deferral PDF, including signatures, risks, approvals, and mitigation approvals.",
  },
  {
    name: "Upload & Trim",
    where: "Profile",
    meaning:
      "Uploads a signature image and opens the editor for crop, rotation, brightness, and contrast.",
  },
];

const notificationGuide = [
  "Approval users receive notifications when a deferral requires their action.",
  "The initiator receives notifications when a deferral is returned, rejected, completed, or needs expiry attention.",
  "Reliability Engineer, Reliability GM, and the initiator receive expiry notifications before the new LAFD by the configured 15 day window.",
  "Expiry notifications remind the initiator to create a 2nd/3rd deferral if the work remains deferred, or to close the deferral if the job has been completed.",
  "Notifications are available from the bell in the header. Users can open the related deferral and mark notifications as read.",
  "When notifications are allowed in the browser, the app also sends a native browser notification for the same events, so approvers see an alert even if the app tab isn't open (as long as the browser itself is running).",
];

// Real captured screenshots, saved by the team into public/user-guide/.
// Filenames contain spaces, so every reference goes through this helper to
// URL-encode them; the files themselves are left exactly as captured.
const ug = (name: string) => `/user-guide/${encodeURIComponent(name)}`;

const signupSlides: GuideSlide[] = [
  {
    src: ug("create an account.png"),
    alt: "Sign-in form",
    caption: "Create an account.",
  },
  { src: ug("signup.png"), alt: "Sign-up form", caption: "The sign-up form." },
];

const notificationSlides: GuideSlide[] = [
  {
    src: ug("sign-in page.png"),
    alt: "Sign-in page",
    caption: "The sign in page",
  },
  {
    src: ug("enable notifications 1.png"),
    alt: "Browser notification permission prompt",
    caption: "The browser's native permission prompt.",
  },
  {
    src: ug("enable notifications 2.png"),
    alt: "Notifications enabled",
    caption: "Notifications enabled.",
  },
];

const signatureSlides: GuideSlide[] = [
  {
    src: ug("how to open profile page.png"),
    alt: "open profile page",
    caption: "open profile page",
  },
  {
    src: ug("press on upload and trim to upload the signature.png"),
    alt: "Upload and trim signature button",
    caption: "Press Upload & Trim to add your signature.",
  },
  {
    src: ug("adjust the electronnic signature.png"),
    alt: "Signature crop and adjustment editor",
    caption: "Crop, rotate, and adjust the signature.",
  },
];

const createDeferralSlides: GuideSlide[] = [
  { src: ug("new deferral 1.png"), alt: "New deferral — step 1" },
  { src: ug("new deferral 2.png"), alt: "New deferral — step 2" },
  { src: ug("new deferral 4.png"), alt: "New deferral — step 3" },
  { src: ug("new deferral 5.png"), alt: "New deferral — step 4" },
  { src: ug("new deferral 6.png"), alt: "New deferral — step 5" },
  { src: ug("new deferral 7.png"), alt: "New deferral — step 6" },
  { src: ug("new deferral 8.png"), alt: "New deferral — step 7" },
  { src: ug("new deferral 9.png"), alt: "New deferral — step 8" },
  { src: ug("new deferral 3.png"), alt: "New deferral — step 9" },
  {
    src: ug("new deferral 10 (Submit).png"),
    alt: "New deferral — step 10, Submit",
  },
  {
    src: ug("confirm submit .png"),
    alt: "Confirm submit dialog",
    caption: "Confirming submission.",
  },
];

const deleteDeferralSlides: GuideSlide[] = [
  {
    src: ug("delete the draft deferral permanently from database.png"),
    alt: "Deleting a deferral with a reason",
    caption: "Deleting a draft, with a reason recorded.",
  },
  {
    src: ug("delete with reason.png"),
    alt: "Deleting a deferral with a reason after submission",
    caption: "Deleting an in-approval deferral, with a reason recorded.",
  },
];

const dashboardSlides: GuideSlide[] = [
  {
    src: ug("dashboard 1.png"),
    alt: "Department deferrals count",
    caption:
      "Department deferrals in case of Initiators and Department Heads accounts.",
  },
  {
    src: ug("dashboard 2.png"),
    alt: "1st, 2nd, and 3rd deferrals count",
    caption:
      "1st, 2nd, and 3rd deferrals count in case of Initiators and Department Heads accounts.",
  },
  {
    src: ug("dashboard 3.png"),
    alt: "Department deferrals count",
    caption:
      "Department deferrals in case of Initiators and Department Heads accounts.",
  },
  {
    src: ug("dashboard 4.png"),
    alt: "Recently created deferrals",
    caption:
      "Recently created deferrals in case of Initiators and Department Heads accounts.",
  },
  {
    src: ug("dashboard 5.png"),
    alt: "deferrals count",
    caption: "All deferrals counts in case of Higher Management accounts.",
  },
  {
    src: ug("dashboard 6.png"),
    alt: "Departments deferrals count",
    caption:
      "All Departments deferrals count in case of Higher Management accounts.",
  },
];

const reviewerSlides: GuideSlide[] = [
  {
    src: ug("dh notified.png"),
    alt: "Department Head notified of a new deferral",
    caption: "The reviewer is notified that a deferral needs their action.",
  },
  {
    src: ug("open the deferral to check its details .png"),
    alt: "Opening a deferral to review its details",
    caption: "Opening the deferral to review its details.",
  },
  {
    src: ug("approval page.png"),
    alt: "The approval page",
    caption: "The approval page.",
  },
  {
    src: ug("approve , return to initiator , reject completely.png"),
    alt: "Approve, Return to Initiator, and Reject Completely buttons",
    caption: "Approve, Return to Initiator, or Reject Completely.",
  },
];

const mitigationSlides: GuideSlide[] = [
  {
    src: ug("DH mitigation approvals .png"),
    alt: "Department Head mitigation approval step",
    caption: "A mitigation department head signing their mitigation step.",
  },
];

const gmDecisionSlides: GuideSlide[] = [
  {
    src: ug("reliability GM decision for TA and AD HOC.png"),
    alt: "Reliability GM decision panel for Technical Authority and AD HOC",
    caption: "Reliability GM choosing whether TA and/or AD HOC are required.",
  },
];

const historySlides: GuideSlide[] = [
  {
    src: ug("approvals history.png"),
    alt: "Deferral approval history and timeline",
    caption: "The approval history/timeline on a deferral.",
  },

  {
    src: ug("work order history.png"),
    alt: "work order history and timeline",
    caption: "the work order history and timeline.",
  },

  {
    src: ug("deferral history .png"),
    alt: "Deferral returns history and timeline",
    caption: "Deferral returns history and timeline.",
  },
];

const exportSlides: GuideSlide[] = [
  {
    src: ug("export tab (print).png"),
    alt: "Export/Print tab for PDF export",
    caption: "The Print/Export tab.",
  },
    {
    src: ug("exported pdf.png"),
    alt: "exported pdf",
    caption: "The exported pdf.",
  },
];

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1.5">
      {eyebrow && (
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          {eyebrow}
        </p>
      )}
      <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
        {title}
      </h2>
      {description && (
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function Section(props: {
  id: string;
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={props.id} className="scroll-mt-24 space-y-5">
      <div className="flex items-start gap-3">
        {props.icon && (
          <div className="mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-primary/10 text-primary">
            {props.icon}
          </div>
        )}
        <SectionHeading
          eyebrow={props.eyebrow}
          title={props.title}
          description={props.description}
        />
      </div>
      {props.children}
    </section>
  );
}

function HelpCard(props: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 rounded-lg py-5">
      <CardHeader className="px-5">
        <CardTitle className="text-base">{props.title}</CardTitle>
        {props.description && (
          <CardDescription>{props.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="px-5 text-sm text-muted-foreground">
        {props.children}
      </CardContent>
    </Card>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">{item}</span>
        </li>
      ))}
    </ul>
  );
}

function StepList({ steps }: { steps: string[] }) {
  return (
    <Card className="rounded-lg py-5">
      <CardContent className="px-5">
        <ol className="space-y-3 text-sm text-muted-foreground">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HelpPage() {
  return (
    <div id="top" className="mx-auto max-w-7xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background px-6 py-10 sm:px-10">
        <div className="relative space-y-4">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            User guide
          </Badge>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
            Deferral Management System
          </h1>
          <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
            Everything you need to know: what the app does, how to get set up,
            how to create and review deferrals, and how the approval cycle works
            &mdash; with a full breakdown of every role's responsibility.
          </p>
        </div>
      </div>

      {/* Mobile quick nav */}
      <div className="mt-6 flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {navGroups
          .flatMap((g) => g.items)
          .map((item) => (
            <Link
              key={item.id}
              href={`#${item.id}`}
              className="shrink-0 rounded-full border bg-background px-3.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted"
            >
              {item.label}
            </Link>
          ))}
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
        <HelpSidebar groups={navGroups} />

        <div className="min-w-0 space-y-14">
          <Section
            id="introduction"
            icon={<BookOpen className="h-4.5 w-4.5" />}
            eyebrow="Chapter 1"
            title="Introduction"
            description="What the Deferral Management System is for, and how it fits into the LAFD deferral process."
          >
            <Card className="rounded-lg py-5">
              <CardContent className="space-y-3 px-5 text-sm text-muted-foreground">
                <p>
                  The Deferral Management System (DMS) is a company-wide tool
                  designed to make the process of requesting, reviewing, and
                  approving Last Acceptable Failure Date (LAFD) deferrals
                  simple, transparent, and auditable. Engineers submit a
                  deferral request with its supporting risk assessment and
                  mitigations, then track it as it moves through a structured,
                  multi-step approval cycle.
                </p>
                <p>
                  Once submitted, a deferral is stored centrally and
                  automatically routed to the correct approvers based on
                  department and decisions made along the way &mdash; for
                  example, whether Technical Authority or AD HOC review is
                  required. Every approval, return, and rejection is stamped
                  with the approver&apos;s digital signature and kept in the
                  deferral&apos;s history, and the completed record can be
                  exported as a PDF for audit and reporting.
                </p>
                <p>
                  The app also sends notifications &mdash; inside the app, and
                  as native browser notifications once enabled &mdash; so
                  approvers know immediately when a deferral needs their action,
                  and initiators are reminded before a new LAFD date arrives.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Section
            id="features"
            icon={<ListChecks className="h-4.5 w-4.5" />}
            eyebrow="Chapter 1"
            title="App Features"
            description="What the Deferral Management System does, at a glance."
          >
            <Card className="rounded-lg py-5">
              <CardContent className="px-5">
                <BulletList items={featureList} />
              </CardContent>
            </Card>
          </Section>

          <Section
            id="getting-started"
            icon={<KeyRound className="h-4.5 w-4.5" />}
            eyebrow="Chapter 2"
            title="Create An Account & Sign In"
            description="How to get into the app for the first time, and every time after."
          >
            <div className="grid gap-6 lg:grid-cols-1">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Create an account
                </h3>
                <div className="grid gap-6 lg:grid-cols-2">
                  <StepList steps={accountCreationSteps} />
                  <GuideCarousel slides={signupSlides} />
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Sign in
                </h3>
                <div className="grid gap-6 lg:grid-cols-2">
                  <StepList steps={signInSteps} />
                  <GuideCarousel slides={notificationSlides} />
                </div>
              </div>
            </div>
          </Section>

          <Section
            id="signature"
            icon={<PenTool className="h-4.5 w-4.5" />}
            eyebrow="Chapter 2"
            title="Add Your Signature"
            description="Every user uploads a personal signature once. It is stamped automatically on approvals and PDFs from then on."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <StepList steps={signatureSteps} />
              <GuideCarousel slides={signatureSlides} />
            </div>
          </Section>

          <Section
            id="roles"
            icon={<Users className="h-4.5 w-4.5" />}
            eyebrow="Chapter 2"
            title="Roles And Access"
            description="The app shows actions based on the signed-in user's role and department."
          >
            <div className="grid gap-3 md:grid-cols-2">
              {Object.entries(USER_ROLE_LABELS).map(([role, label]) => (
                <HelpCard key={role} title={label}>
                  {role === "ENGINEER_APPLICANT" &&
                    "Creates deferrals, edits drafts/returned records, uploads attachments, submits deferrals, closes completed deferrals, deletes drafts, and can mark in-approval deferrals as deleted with a reason."}
                  {role === "DEPARTMENT_HEAD" &&
                    "Reviews deferrals for the user's department. Department Heads also approve mitigation steps when their department is selected as a required mitigation department."}
                  {role === "RELIABILITY_ENGINEER" &&
                    "Reviews deferrals after department and mitigation approvals. Also receives expiry notifications."}
                  {role === "RELIABILITY_GM" &&
                    "Reviews deferrals after Reliability Engineer, decides whether Technical Authority and/or AD HOC signatures are required, and receives expiry notifications."}
                  {role === "RESPONSIBLE_GM" &&
                    "Signs the responsible GM step inside the parallel sign-off group."}
                  {role === "SOD" &&
                    "Signs the SOD step when it is part of the selected approval path."}
                  {role === "DFGM" &&
                    "Signs the DFGM step when it is part of the selected approval path."}
                  {role === "TECHNICAL_AUTHORITY" &&
                    "Signs the Technical Authority step when the deferral requires TA review."}
                  {role === "AD_HOC" &&
                    "Signs the AD HOC step when the deferral requires AD HOC review."}
                  {role === "PLANNING_ENGINEER" &&
                    "Signs the Planning Engineer (GMS Integration) step after the main approvals are complete."}
                  {role === "PLANNING_SUPERVISOR_ENGINEER" &&
                    "Signs the final Planning Supervisor step. After this signature, the deferral becomes Completed."}
                  {role === "ADMIN" &&
                    "Manages users, roles, responsible GM mappings, and can access administrative setup pages."}
                </HelpCard>
              ))}
            </div>
          </Section>

          <Section
            id="screens"
            icon={<LayoutDashboard className="h-4.5 w-4.5" />}
            eyebrow="Chapter 3"
            title="Main Screens"
            description="A quick tour of the main screen before diving into each feature."
          >
            <div className="grid gap-6 lg:grid-cols-2">
              <StepList steps={dashboardSteps} />
              <GuideCarousel slides={dashboardSlides} />
            </div>
          </Section>

          <Section
            id="create-deferral"
            icon={<Workflow className="h-4.5 w-4.5" />}
            eyebrow="Chapter 3"
            title="Create A Deferral"
            description="The initiator creates the record, completes all required sections, and submits it into approval."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <StepList steps={creationSteps} />
              <GuideCarousel slides={createDeferralSlides} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <HelpCard title="Duplicate work order warning">
                If a work order already has a deferral, the app displays a
                warning before continuing so the initiator confirms this is an
                intended second or third deferral, not a duplicate.
              </HelpCard>
              <GuideImage
                src={ug("warning before creating second or third deferral.png")}
                alt="Duplicate work order warning"
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <HelpCard title="Deleting a deferral">
                A draft can be permanently deleted by its initiator before
                submission. An in-approval deferral can instead be marked as
                deleted with a reason, which keeps the record for audit purposes
                while removing it from active lists.
              </HelpCard>
              <GuideCarousel slides={deleteDeferralSlides} />
            </div>
          </Section>

          <Section
            id="search"
            icon={<Search className="h-4.5 w-4.5" />}
            eyebrow="Chapter 3"
            title="Search, Filters, And Export"
            description="The Deferrals page is used to find records and export filtered data."
          >
            <GuideImage
              src={ug("deferrals search.png")}
              alt="Deferrals Search, Filters, And Export"
            />
            <div className="grid gap-3 md:grid-cols-2">
              <HelpCard title="Available filters">
                Filter by department, status, deferral code, work order number,
                equipment tag, updated date range, and whether the record is the
                1st, 2nd, or 3rd deferral for its work order.
              </HelpCard>
              <HelpCard title="Role-based filtering">
                Initiators are limited to their own department when searching.
              </HelpCard>
              <HelpCard title="Results">
                Results are ordered by Updated At, newest first. The page loads
                the first group of records, then more records as the user
                scrolls.
              </HelpCard>
              <HelpCard title="CSV export">
                Export CSV downloads the deferrals matching the current filters,
                so users should apply filters before exporting.
              </HelpCard>
            </div>
          </Section>

          <Section
            id="approvals"
            icon={<FileCheck2 className="h-4.5 w-4.5" />}
            eyebrow="Chapter 4"
            title="Approval Cycle & Roles"
            description="Every deferral moves through these roles in order. Each step below is a role, in sequence."
          >
            <Card className="overflow-hidden rounded-lg py-0">
              <div className="divide-y">
                {approvalSequence.map((item, index) => (
                  <div key={item.role} className="flex gap-4 px-5 py-4">
                    <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {item.role}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <div className="space-y-4">
                <HelpCard title="Approval history">
                  Every deferral keeps a full timeline of who approved,
                  returned, or rejected each step, with their comment and
                  signature, so the whole approval history stays auditable.
                </HelpCard>
                <HelpCard title="Work order history">
                  Shows every deferral ever raised against the same work
                  order &mdash; 1st, 2nd, 3rd, and so on &mdash; so reviewers
                  can see the full deferral history for that equipment or
                  work order at a glance.
                </HelpCard>
                <HelpCard title="Deferral history">
                  Shows the deferral's own return and resubmission timeline
                  &mdash; when it was returned to the initiator, what was
                  changed, and when it was resubmitted.
                </HelpCard>
              </div>
              <GuideCarousel slides={historySlides} />
            </div>
          </Section>

          <Section
            id="reviewer-actions"
            icon={<MousePointerClick className="h-4.5 w-4.5" />}
            eyebrow="Chapter 4"
            title="How Reviewers Approve, Return, Or Reject A Deferral"
            description="A reviewer is any approval user who has an active approval step, such as Department Head, Reliability Engineer, Reliability GM, Technical Authority, AD HOC, Responsible GM, SOD, DFGM, or Planning."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
              <StepList steps={reviewerSteps} />
              <GuideCarousel slides={reviewerSlides} />
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <HelpCard title="Approve">
                Confirm that the work order, equipment, original/current/new
                LAFD, risk assessment, justification, consequence, mitigations,
                and attachments support the deferral request.
              </HelpCard>
              <HelpCard title="Return to initiator">
                Use Return to Initiator when information is missing, incorrect,
                or needs clarification. The return reason is saved and shown to
                the initiator.
              </HelpCard>
              <HelpCard title="Reject completely">
                Use Reject Completely only when the deferral should not
                continue. This is final for the current record and requires a
                reason.
              </HelpCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <HelpCard title="Mitigation approvals">
                When a deferral has mitigations, each mitigation's department
                head reviews and signs their own mitigation step &mdash;
                separate from.
              </HelpCard>
              <GuideCarousel slides={mitigationSlides} />
            </div>
          </Section>

          <Section
            id="gm-decision"
            icon={<Workflow className="h-4.5 w-4.5" />}
            eyebrow="Chapter 4"
            title="Reliability GM: Add Technical Authority Or AD HOC"
            description="Reliability GM can add optional Technical Authority and AD HOC approval steps before signing the Reliability GM approval."
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
              <StepList steps={reliabilityGmDecisionSteps} />
              <GuideCarousel slides={gmDecisionSlides} />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <HelpCard title="When it is editable">
                The decision is editable only when the Reliability GM approval
                is active and pending. If the panel shows Locked, the GM step is
                either not active yet or has already been signed.
              </HelpCard>
              <HelpCard title="Correct order">
                Reliability GM should set TA/AD HOC requirements, press Save
                Decision, confirm the approval timeline, then approve the
                Reliability GM step.
              </HelpCard>
            </div>
          </Section>

          <Section
            id="statuses"
            icon={<ListChecks className="h-4.5 w-4.5" />}
            eyebrow="Chapter 4"
            title="Deferral Statuses"
            description="Every deferral has one lifecycle status. Use filters and dashboards to review these states."
          >
            <div className="grid gap-3">
              {statusGuide.map((item) => (
                <Card key={item.status} className="rounded-lg py-4">
                  <CardContent className="grid gap-3 px-5 md:grid-cols-[180px_minmax(0,1fr)]">
                    <div>
                      <Badge
                        className={cn(
                          "border-transparent",
                          STATUS_COLORS[item.status],
                        )}
                      >
                        {STATUS_LABELS[item.status]}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <p className="text-foreground">{item.meaning}</p>
                      <p className="text-muted-foreground">{item.userAction}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Dashboard status cards exclude Submitted because it is a
              transitional workflow state in the current process.
            </p>
          </Section>

          <Section
            id="dashboard"
            icon={<BarChart3 className="h-4.5 w-4.5" />}
            eyebrow="Chapter 5"
            title="Dashboard & Statistics"
            description="A visual overview of deferrals across the company, by department, status, and deferral rank."
          >
     
            <GuideImage
              src={ug("dashboard-statistics.png")}
              alt="Deferrals Search, Filters, And Export"
              caption="The dashboard's department and status breakdown."
              aspect="16 / 8"
            />
          </Section>

          <Section
            id="notifications"
            icon={<Bell className="h-4.5 w-4.5" />}
            eyebrow="Chapter 5"
            title="Notifications"
            description="Notifications tell users when a deferral needs attention."
          >
            
            <GuideImage
              src={ug("notifications list.png")}
              alt="Notifications"
              aspect="16 / 8"
            />
     
            <Card className="rounded-lg py-5">
              <CardContent className="px-5">
                <BulletList items={notificationGuide} />
              </CardContent>
            </Card>
          </Section>

          <Section
            id="pdf"
            icon={<FileCheck2 className="h-4.5 w-4.5" />}
            eyebrow="Chapter 5"
            title="PDF, Signatures, And Profile"
            description="The app stores signatures and includes them in approval evidence."
          >
            <div className="grid gap-3 md:grid-cols-2">
              <HelpCard title="Profile signature">
                Users upload their signature from Profile. The editor supports
                crop, rotation, brightness, contrast, reset, and live preview.
              </HelpCard>
              <HelpCard title="Approval signatures">
                When a user approves, returns, or rejects, the app stores the
                user's name and signature snapshot with that action.
              </HelpCard>
              <HelpCard title="Mitigation approval table">
                Mitigation approvals have their own PDF table. The table
                includes department, mitigation, signature, approved by, date,
                and comment.
              </HelpCard>
              <HelpCard title="PDF export">
                The Print tab exports the PDF containing deferral information,
                risks, mitigations, approval timeline, signatures, and
                mitigation approvals.
              </HelpCard>
            </div>

            <GuideCarousel slides={exportSlides} aspect="16 / 9" />
          </Section>

          <Section
            id="buttons"
            icon={<MousePointerClick className="h-4.5 w-4.5" />}
            eyebrow="Chapter 5"
            title="Buttons And Actions"
            description="Common buttons and what they do."
          >
            <div className="grid gap-3">
              {buttonGuide.map((button) => (
                <Card
                  key={`${button.where}-${button.name}`}
                  className="rounded-lg py-4"
                >
                  <CardContent className="grid gap-3 px-5 text-sm md:grid-cols-[180px_220px_minmax(0,1fr)]">
                    <div className="font-medium text-foreground">
                      {button.name}
                    </div>
                    <div className="text-muted-foreground">{button.where}</div>
                    <div className="text-muted-foreground">
                      {button.meaning}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <BackToTopButton />
    </div>
  );
}
