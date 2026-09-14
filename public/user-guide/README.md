# User guide screenshots

The Help page (`/help` in the app) looks for screenshots in this folder and
shows a "not added yet" placeholder until each file exists. Drop PNG or JPG
files in here with the exact names below and they'll appear automatically —
no code change needed, just refresh the Help page.

| File to add | Where it's used | What to capture |
|---|---|---|
| `create-account.png` | Getting Started → Create an account | The sign-up form, filled in with example data (name, email, password, department, position) before pressing "Create account". |
| `add-signature.png` | Add Your Signature | The Profile page's signature upload/trim editor, ideally mid-crop so the editing controls are visible. |
| `create-deferral.png` | Create A Deferral | The new-deferral form — the top section (work order, equipment, LAFD dates) is the most useful part to show. |
| `approve-return-reject.png` | Reviewer Actions | An open deferral's Approvals tab, showing the action panel with the comment box and the Approve / Return to Initiator / Reject Completely buttons. |

## How to capture one

1. Sign in to the app with a test account (not a real production account) —
   in a normal browser window sized around 1280×800 for a clean, consistent
   look across screenshots.
2. Navigate to the screen listed above and get it into the state described.
3. Take a screenshot (Windows: `Win+Shift+S`, then paste into Paint or any
   image editor and save as PNG).
4. Crop out anything sensitive — your OS taskbar, other open tabs, or any
   real data you don't want in a document that may be shared with other
   staff.
5. Save the file into this folder (`public/user-guide/`) using the exact
   file name from the table above, overwriting the old one if you're
   replacing it.
6. Rebuild/redeploy, or just refresh the page if you're running the dev
   server — Next.js serves anything in `public/` directly.

## Notes

- Don't use real employee names, emails, or work-order data in these
  screenshots if the guide will be shared outside the small group that
  already has app access — create a throwaway test deferral/account for the
  capture instead.
- You can add more screenshots later (a second one per section, a numbered
  sequence, etc.) by adding another `<GuideImage src="/user-guide/..." .../>`
  in `src/app/(dashboard)/help/page.tsx` next to the existing ones.
