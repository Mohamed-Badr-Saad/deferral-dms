import Link from "next/link";
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
import {
  STATUS_COLORS,
  STATUS_LABELS,
  USER_ROLE_LABELS,
  type DeferralStatus,
} from "@/src/lib/constants";

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
  "Structured deferral requests: work order, equipment, criticality, original/current/new LAFD (Last Acceptable Failure Date), description, justification, and consequence of not deferring.",
  "RAM risk assessment: People, Asset, Environment, and Reputation severity/likelihood scoring with an auto-calculated risk cell and level.",
  "Mitigations with their own department-level approval: each mitigation is routed to the head of the department responsible for it.",
  "A multi-step approval workflow that automatically routes the deferral through department, reliability, optional Technical Authority / AD HOC, parallel management sign-off, and planning sign-off stages.",
  "Digital signatures: every user uploads a personal signature once from their profile, and it is stamped on every approval, return, or rejection they perform.",
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
  "Open the app's sign-up page (the \"Create account\" link on the sign-in screen, or the address your administrator shared with you).",
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
  "Department Head of the initiator department.",
  "Department Heads for all mitigation departments.",
  "Reliability Engineer.",
  "Reliability GM.",
  "Technical Authority or AD HOC, when required by the deferral.",
  "Parallel Sign-off Group: Responsible GM, SOD, and DFGM steps based on the selected decision path.",
  "Planning Engineer (GMS Integration).",
  "Planning Supervisor Engineer.",
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
  "When the reason for a notification is fulfilled, related notification handling can mark it as read so users do not keep acting on old alerts.",
  "When notifications are allowed in the browser, the app also sends a native browser notification for the same events, so approvers see an alert even if the app tab isn't open (as long as the browser itself is running).",
];

function Section(props: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={props.id} className="scroll-mt-24 space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">{props.title}</h2>
        {props.description && (
          <p className="mt-1 text-sm text-muted-foreground">
            {props.description}
          </p>
        )}
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
          <span>{item}</span>
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

export default function HelpPage() {
  return (
    <div id="top" className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" id="top">
            User guide
          </Badge>
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Deferral Management System Help
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground sm:text-base">
            This page explains the app's features, how to get started, how to
            use the app day to day, the approval cycle and each role's
            responsibility, statuses, notifications, filters, exports, and
            buttons.
          </p>
        </div>
      </div>

      <Card className="rounded-lg py-5">
        <CardContent className="grid gap-3 px-5 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Features", "#features"],
            ["Getting started", "#getting-started"],
            ["Your signature", "#signature"],
            ["Roles and access", "#roles"],
            ["Statuses", "#statuses"],
            ["Create a deferral", "#create-deferral"],
            ["Approval cycle", "#approvals"],
            ["Reviewer actions", "#reviewer-actions"],
            ["Reliability GM decision", "#gm-decision"],
            ["Notifications", "#notifications"],
            ["Buttons and actions", "#buttons"],
            ["PDF and signatures", "#pdf"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="rounded-lg border px-3 py-2 text-foreground transition-colors hover:bg-muted"
            >
              {label}
            </Link>
          ))}
        </CardContent>
      </Card>

      <Section
        id="features"
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
        title="Getting Started"
        description="How to create your account, sign in, and enable notifications."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">
              Create an account
            </h3>
            <StepList steps={accountCreationSteps} />
            <GuideImage
              src="/user-guide/create-account.png"
              alt="Sign-up form showing name, email, password, and department fields"
              caption="The sign-up form."
            />
          </div>
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Sign in</h3>
            <StepList steps={signInSteps} />
          </div>
        </div>
      </Section>

      <Section
        id="signature"
        title="Add Your Signature"
        description="Every user uploads a personal signature once. It is stamped automatically on approvals and PDFs from then on."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <StepList steps={signatureSteps} />
          <GuideImage
            src="/user-guide/add-signature.png"
            alt="Profile page signature upload and trim editor"
            caption="Uploading and trimming a signature from Profile."
          />
        </div>
      </Section>

      <Section
        id="roles"
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
        id="statuses"
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
          Dashboard status cards exclude Submitted because it is a transitional
          workflow state in the current process.
        </p>
      </Section>

      <Section
        id="dashboard"
        title="Dashboard"
        description="The dashboard summarizes deferrals by department, status, and deferral rank."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <HelpCard title="Department breakdown">
            Department tabs show how many deferrals are in each status. The app
            normalizes department names so capitalization differences do not
            create duplicate departments.
          </HelpCard>
          <HelpCard title="Role visibility">
            Initiators and Department Heads see dashboard counts for their own
            department. Higher management roles can see all departments.
          </HelpCard>
          <HelpCard title="First, second, and third deferrals">
            Counters show whether a deferral is the first, second, or third
            deferral created for the same work order.
          </HelpCard>
          <HelpCard title="Active and history records">
            Active records include Draft, In Approval, Returned, and Approved.
            History records include Completed, Closed, Rejected, Deleted, and
            Expired.
          </HelpCard>
        </div>
      </Section>

      <Section
        id="create-deferral"
        title="Create A Deferral"
        description="The initiator creates the record, completes all required sections, and submits it into approval."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <StepList steps={creationSteps} />
          <GuideImage
            src="/user-guide/create-deferral.png"
            alt="New deferral form with work order, equipment, LAFD dates, and risk fields"
            caption="The new deferral form."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <HelpCard title="Duplicate work order warning">
            If a work order already has a deferral, the app displays a warning
            before continuing so the initiator confirms this is an intended
            second or third deferral, not a duplicate.
          </HelpCard>
          <HelpCard title="Automatic draft saves">
            Draft and returned deferral changes are saved when moving between
            tabs, pressing Save, or opening details. This avoids losing
            mitigation and risk changes while editing.
          </HelpCard>
          <HelpCard title="Mitigations">
            The initiator can add multiple mitigations before submission. Each
            mitigation has a required department. The Department Head for that
            department is added to the approval workflow.
          </HelpCard>
        </div>
      </Section>

      <Section
        id="approvals"
        title="Approval Cycle"
        description="The approval timeline is written in the business sequence used by the workflow. Each step below is a role, in order."
      >
        <StepList steps={approvalSequence} />

        <div className="grid gap-3 md:grid-cols-3">
          <HelpCard title="Approve">
            The active approver signs the current step. The signature snapshot
            is stored with the approval so PDFs keep the signed evidence.
          </HelpCard>
          <HelpCard title="Return to initiator">
            Sends the deferral back for correction. A reason is required. The
            initiator can edit and resubmit.
          </HelpCard>
          <HelpCard title="Reject completely">
            Ends the workflow as Rejected. A reason is required, and the
            initiator cannot resubmit that same record.
          </HelpCard>
        </div>
      </Section>

      <Section
        id="reviewer-actions"
        title="How Reviewers Approve, Return, Or Reject A Deferral"
        description="A reviewer is any approval user who has an active approval step, such as Department Head, Reliability Engineer, Reliability GM, Technical Authority, AD HOC, Responsible GM, SOD, DFGM, or Planning."
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <StepList steps={reviewerSteps} />
          <GuideImage
            src="/user-guide/approve-return-reject.png"
            alt="Approval panel with comment box and Approve, Return to Initiator, and Reject Completely buttons"
            caption="The approval action panel."
          />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <HelpCard title="Before approving">
            Confirm that the work order, equipment, original/current/new LAFD,
            risk assessment, justification, consequence, mitigations, and
            attachments support the deferral request.
          </HelpCard>
          <HelpCard title="Returning">
            Use Return to Initiator when information is missing, incorrect, or
            needs clarification. The return reason is saved and shown to the
            initiator.
          </HelpCard>
          <HelpCard title="Rejecting">
            Use Reject Completely only when the deferral should not continue.
            This is final for the current record and requires a reason.
          </HelpCard>
        </div>
      </Section>

      <Section
        id="gm-decision"
        title="Reliability GM: Add Technical Authority Or AD HOC"
        description="Reliability GM can add optional Technical Authority and AD HOC approval steps before signing the Reliability GM approval."
      >
        <StepList steps={reliabilityGmDecisionSteps} />

        <div className="grid gap-3 md:grid-cols-2">
          <HelpCard title="Requires Technical Authority">
            Turn this on when the deferral needs a Technical Authority review.
            The workflow inserts a Technical Authority Signature step after
            Reliability GM and before the parallel sign-off group.
          </HelpCard>
          <HelpCard title="Requires AD HOC">
            Turn this on when the deferral needs an AD HOC review. The workflow
            inserts an AD HOC Signature step after Reliability GM and before
            the parallel sign-off group.
          </HelpCard>
          <HelpCard title="When it is editable">
            The decision is editable only when the Reliability GM approval is
            active and pending. If the panel shows Locked, the GM step is
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
        id="search"
        title="Search, Filters, And Export"
        description="The Deferrals page is used to find records and export filtered data."
      >
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
            Results are ordered by Updated At, newest first. The page loads the
            first group of records, then more records as the user scrolls.
          </HelpCard>
          <HelpCard title="CSV export">
            Export CSV downloads the deferrals matching the current filters, so
            users should apply filters before exporting.
          </HelpCard>
        </div>
      </Section>

      <Section
        id="notifications"
        title="Notifications"
        description="Notifications tell users when a deferral needs attention."
      >
        <Card className="rounded-lg py-5">
          <CardContent className="px-5">
            <BulletList items={notificationGuide} />
          </CardContent>
        </Card>
      </Section>

      <Section
        id="buttons"
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
                <div className="font-medium text-foreground">{button.name}</div>
                <div className="text-muted-foreground">{button.where}</div>
                <div className="text-muted-foreground">{button.meaning}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      <Section
        id="pdf"
        title="PDF, Signatures, And Profile"
        description="The app stores signatures and includes them in approval evidence."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <HelpCard title="Profile signature">
            Users upload their signature from Profile. The editor supports crop,
            rotation, brightness, contrast, reset, and live preview.
          </HelpCard>
          <HelpCard title="Approval signatures">
            When a user approves, returns, or rejects, the app stores the
            user's name and signature snapshot with that action.
          </HelpCard>
          <HelpCard title="Mitigation approval table">
            Mitigation approvals have their own PDF table. The table includes
            department, mitigation, signature, approved by, date, and comment.
          </HelpCard>
          <HelpCard title="PDF export">
            The Print tab exports the PDF containing deferral information,
            risks, mitigations, approval timeline, signatures, and mitigation
            approvals.
          </HelpCard>
        </div>
      </Section>

      <BackToTopButton />
    </div>
  );
}
