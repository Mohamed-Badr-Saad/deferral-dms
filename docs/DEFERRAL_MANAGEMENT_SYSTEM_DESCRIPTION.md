# Deferral Management System

## Overview

The Deferral Management System (DMS) is a secure web application for controlling maintenance and operational deferrals from the initial request through approvals, planning sign-off, execution confirmation, and expiry monitoring. It replaces paper forms, email follow-ups, disconnected spreadsheets, and separate signature sheets with a single digital record for every deferral.

A deferral record captures why work is delayed, the affected work order and equipment, original and new Latest Allowable Finish Dates (LAFDs), risk assessment, mitigation requirements, approval decisions, electronic signatures, comments, attachments, and the final outcome. It gives engineering, reliability, management, and planning users one shared view of the current deferral portfolio.

## Business Value

DMS provides a controlled, traceable, and auditable process for deciding whether work can be deferred. It helps the organization:

- Maintain a single source of truth for every deferral.
- Reduce manual follow-up to obtain approvals and signatures.
- Prevent accidental duplicate deferrals for the same work order.
- Make current risk, mitigation, LAFD, and approval information available immediately.
- Improve accountability by routing each action to the correct role and department.
- Produce reports and signed PDF evidence without manual compilation.
- Monitor approaching LAFD expiry before it becomes an operational issue.

## Deferral Creation And Draft Management

Authorized Engineer Applicants can create a structured deferral record. The form captures:

- Work order number and title.
- Equipment tag and description.
- Task and safety criticality.
- Original LAFD, current/start LAFD, and requested new LAFD.
- Description, justification, and consequence of the deferral.
- Risk Assessment Matrix (RAM) information.
- One or more mitigation actions.
- Supporting attachments.

Every deferral receives a unique code with a department and date/time hint, making records easier to identify while keeping them unique. If a work order already has a deferral, the system displays a warning before a second or third deferral is created. This helps the initiator confirm that it is a deliberate continuation, rather than a duplicate entry.

New records begin as Draft. Draft data saves when the user changes tabs, opens the details view, or selects Save. This protects work in progress without accidentally submitting it into the approval workflow. The initiator can edit Draft and Returned records, and can permanently delete a Draft before it enters approval.

## Work Order History And Deferral Numbering

DMS links deferrals to their work orders and identifies whether each is the first, second, or third deferral. The work-order history tab displays other deferrals linked to the same work order, including their status, dates, equipment details, and outcome.

Deferral ranking is used throughout the system:

- Warning before creating another deferral for an existing work order.
- Search filter for 1st, 2nd, or 3rd deferrals.
- Dashboard counters for each deferral rank.
- Expiry alerts that guide the initiator to create a 2nd or 3rd deferral when required.

## LAFD And Expiry Control

The application stores the original LAFD, the current LAFD, and the requested new LAFD. The new LAFD must be later than the applicable earlier LAFD and cannot exceed the configured six-month maximum.

Fifteen days before the new LAFD, the system notifies the initiator, Reliability Engineer, and Reliability GM. The notification directs the initiator to create the next deferral if work remains deferred, or close the deferral if the job has been executed. When the new LAFD passes for an eligible record, the scheduled expiry process can mark it as Expired.

## Risk Assessment And Mitigations

Each deferral supports structured RAM assessment across four categories:

- People
- Asset
- Environment
- Reputation

For each category, the user records severity, likelihood, RAM cell, consequence level, and justification. This information is visible to all reviewers and retained in the final PDF.

The initiator can add multiple mitigations. Each mitigation includes its description and the responsible department. When submitted, the system automatically adds the Department Head of every mitigation department to the workflow. These approvals happen after the initiator’s Department Head and before Reliability Engineer review. The timeline clearly identifies them as mitigation-related approvals, and the PDF places them in a dedicated mitigation approval table.

## Attachments

Supporting attachments can be added to eligible records. The system accepts PDF, PNG, JPG, and WEBP files up to 25 MB per file. Reviewers can access attachments from the details page, and the attachment display is responsive for desktop and mobile screens.

For the cloud prototype, file storage is handled through cloud object storage. For local deployment, attachments and signatures are retained in persistent local server storage.

## Approval Workflow

Submitting a Draft or Returned deferral validates the required data and creates a new approval cycle. The record moves into In Approval. Submitted exists only as a short technical transition and is intentionally excluded from dashboard status cards.

The workflow follows this ordered sequence:

1. Department Head of the initiator’s department.
2. Department Heads for all mitigation departments.
3. Reliability Engineer.
4. Reliability GM.
5. Technical Authority and/or AD HOC, when required.
6. Responsible sign-off stage: Responsible GM for a first deferral, or the Responsible GM, SOD, and DFGM parallel group for later deferrals when applicable.
7. Planning Engineer (GMS Integration).
8. Planning Supervisor Engineer.

Only the active stage can take action. The system notifies relevant users when their approval is required, tracks the status of parallel approvers, and does not advance until every required approval in the active stage is completed.

After all pre-planning approvals have completed, the deferral status becomes Approved. The Planning Engineer and Planning Supervisor Engineer then complete the final two sign-offs. Once both have signed, the deferral becomes Completed.

### Reviewer Decisions

Approvers can work from the Approvals page or directly from an action notification. The deferral details page displays an approval action panel whenever the signed-in user owns the active step.

An active reviewer can:

- Approve the record and advance it to the next stage.
- Return it to the initiator for correction. A reason is required, stored in the record history, and the initiator can edit and resubmit the deferral.
- Reject it completely. A reason is required, and the initiator cannot resubmit the rejected record.

Each action records the approver, role, comment, date/time, and signature snapshot. When a returned deferral is resubmitted, the system starts a new approval cycle while preserving the earlier decisions for audit traceability.

### Reliability GM Decision

At the active Reliability GM stage, the Reliability GM can decide whether a Technical Authority, an AD HOC reviewer, or both are required. Saving the decision inserts the selected optional approval steps in the appropriate place before the responsible sign-off stage. The decision is locked once the Reliability GM has approved.

## Deferral Statuses

| Status | Meaning |
| --- | --- |
| Draft | The deferral is being prepared. The initiator can edit or permanently delete it. |
| Submitted | A brief technical state during submission; records normally move immediately to In Approval. |
| In Approval | The record is progressing through the required approval route. |
| Returned | An approver requested corrections. The initiator can edit and resubmit it. |
| Rejected | The record was rejected completely and cannot be resubmitted. |
| Approved | All approvals before Planning are complete; the two Planning approvals remain. |
| Completed | All approvals, including both Planning approvals, are complete. |
| Closed | The initiator confirmed the job was executed and closed the completed deferral. |
| Deleted | An In Approval deferral was soft-deleted with a saved reason; the audit record remains. |
| Expired | The new LAFD elapsed while the deferral remained eligible for expiry monitoring. |

## Dashboard

The dashboard presents current status counts, recent activity, department breakdowns, and deferral-rank counters. It includes Draft, Returned, In Approval, Rejected, Approved, Completed, Closed, Deleted, and Expired records. Submitted is deliberately excluded because it is not a practical working state.

The dashboard includes total and active counters for first, second, and third deferrals. “Active” indicates that the new LAFD has not yet elapsed.

Department names are normalized so capitalization or spacing differences do not create duplicate department tabs. Engineer Applicants and Department Heads see their own department’s dashboard data. Management roles can see global totals and all department tabs. Dashboard cards link to the corresponding filtered deferral register for immediate follow-up.

## Search, Filtering, And CSV Export

The Deferrals page is a searchable register for active, historical, or all deferrals. Users can filter by:

- Department, subject to role-based visibility.
- Deferral status.
- Deferral code.
- Work order number.
- Equipment tag.
- Updated-from and updated-to dates.
- 1st, 2nd, or 3rd deferral rank.

Results are ordered by latest update and load progressively for large data sets. Users can apply filters, reset them, refresh results, and export the exact filtered result set to an Excel-compatible CSV file.

## Deferral Details, History, And PDF Export

The deferral details page provides a complete operational view. It displays the deferral code, status, initiating department, last update, initiator name, job title, work order, equipment information, LAFD dates, risk assessment, mitigations, attachments, approval timeline, and work-order history.

The page provides dedicated Details, Approvals, Work Order History, Deferral History, and Print tabs. Deferral History retains return and rejection decisions and comments. The Approval Timeline shows the correct business sequence, approval status, user, signature, timestamp, comments, mitigation labels, and progress for parallel sign-off groups.

The Print tab produces a formal PDF containing:

- Deferral, initiator, work order, and equipment information.
- Original, current, and new LAFD dates.
- RAM assessment and risk justifications.
- Mitigation descriptions and responsible departments.
- Approval timeline, comments, dates, and signature images.
- A separate mitigation approval table with department, mitigation, signature, approved by, date, and comment.

## Notifications

The notification bell provides each user with a focused list of workflow actions and important events. Notifications are sent when a user needs to act on an approval and for key outcomes such as returned, rejected, and completed deferrals.

Expiry notifications are sent before the new LAFD to the initiator, Reliability Engineer, and Reliability GM. Users can open the related deferral directly from a notification and mark individual or all notifications as read. Resolved notification reasons can be marked as read to prevent users from acting on outdated alerts.

## Electronic Signatures And User Profile

Every user profile includes name, department, job position, role, and a signature image. Users can upload a PNG or JPEG signature and edit it with crop, rotation, brightness, contrast, reset, and live-preview controls.

When an approval, return, or rejection takes place, DMS stores the reviewer name and a signature snapshot. Later changes to the profile signature do not change the signature evidence recorded on earlier approvals.

## Roles And Access

The system uses authenticated accounts and role-based permissions.

- Engineer Applicant: Creates and edits own Draft/Returned deferrals, manages risks, mitigations, and attachments, submits, deletes Drafts, soft-deletes In Approval records with a reason, and closes Completed records after job execution.
- Department Head: Reviews deferrals for the relevant department, including mitigation approvals for the Department Head’s department.
- Reliability Engineer: Reviews after departmental approvals and receives expiry alerts.
- Reliability GM: Reviews after the Reliability Engineer, configures optional Technical Authority/AD HOC routing, and receives expiry alerts.
- Technical Authority and AD HOC: Provide optional approvals when selected by the Reliability GM.
- Responsible GM, SOD, and DFGM: Complete the responsible sign-off stage, including parallel approval when required.
- Planning Engineer and Planning Supervisor Engineer: Complete the final planning sign-offs.
- Administrator: Manages user accounts, roles, and Responsible GM mappings.

Department-based rules protect data visibility. Initiators are restricted to their own department in dashboard and search contexts, while higher management roles can access all departments.

## Administration

Administrators can manage business users, assign roles, update departments and job positions, and maintain Responsible GM mappings. This allows the application’s routing to reflect the organization’s current accountability structure without changing source code.

## Mobile Experience And Help

DMS is responsive for desktop and mobile use. It includes a mobile sidebar menu, responsive search results, horizontally accessible tab controls, mobile-friendly approval cards, constrained attachment layouts, and mobile-safe notification messages.

The built-in Help page documents system roles, statuses, deferral creation, approval decisions, Reliability GM routing, notifications, exports, profile signatures, and common buttons. It also provides a return-to-top control for long guidance pages.

## Technical Architecture And Deployment

The application is built with Next.js, React, TypeScript, PostgreSQL, Drizzle ORM, and Better Auth. It provides protected APIs for deferrals, approvals, notifications, reporting, administration, signatures, and attachments.

The prototype can use managed PostgreSQL and cloud storage. The local deployment package uses Docker Compose to run the application, PostgreSQL, Nginx, persistent upload storage, database migrations, health checks, and scheduled expiry jobs on an organization-managed server. This supports keeping operational data and attachments within the organization’s own infrastructure.

## Expected Operational Savings

DMS is designed to replace manually assembled forms, separate signature sheets, follow-up emails, and spreadsheet trackers with an automated digital workflow. It can substantially reduce paper usage, reduce time spent chasing approvals and preparing reports, and make the latest approval and expiry position visible immediately.

For formal benefits reporting, the organization should measure its own baseline before and after rollout: average approval-cycle duration, printed pages per deferral, number of follow-up emails, time required for status reporting, and percentage of records approaching LAFD without action. DMS moves these activities into automated routing, notifications, dashboards, searchable records, and one-click CSV/PDF exports.
