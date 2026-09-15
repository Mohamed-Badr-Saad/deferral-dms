# User guide screenshots

The in-app Help page (`/help`) shows these screenshots directly from this
folder. Most of them have already been captured and added — this file is
mainly a reference for the two that are still outstanding, and for anyone
re-capturing a screenshot later.

## Still outstanding (shown as placeholders on the Help page)

| File to add | Where it's used | What to capture |
|---|---|---|
| `main-screen-overview.png` | Main Screens | The deferrals list / main screen, showing the sidebar, search, filters, and notifications bell. |
| `dashboard-statistics.png` | Dashboard & Statistics | The Dashboard screen showing department/status breakdown. |

## Already captured and in use

These are referenced by the Help page exactly as named (spaces and all —
the page URL-encodes them automatically, so there's no need to rename
anything):

- `signup.png`
- `enable notifications 1.png`, `enable notifications 2.png`
- `press on upload and trim to upload the signature.png`, `adjust the electronnic signature.png`
- `new deferral 1.png` through `new deferral 9.png`, `new deferral 10 (Submit).png`, `confirm submit .png`
- `delete with reason.png`
- `dh notified.png`, `open the deferral to check its details .png`, `approvals tab .png`, `approval page.png`, `approve , return to initiator , reject completely.png`
- `DH mitigation approvals .png`
- `reliability GM decision for TA and AD HOC.png`
- `deferral history .png`
- `export tab (print).png`

(`approve , return to initiator , reject.png` is an unused duplicate of
`approve , return to initiator , reject completely.png` — safe to delete.)

## Updating a screenshot

1. Recapture the screen in the app (1280×800 or similar makes a
   consistent-looking set).
2. Save it into this folder using **the exact same file name** as the one
   it's replacing — the Help page just refreshes, no code change needed.
3. Avoid using real employee names, emails, or work-order data in
   screenshots if the guide is shared outside the small group that already
   has app access.

## Adding a brand-new screenshot

Open `src/app/(dashboard)/help/page.tsx` and either add a filename to an
existing `...Slides` array (for a carousel that already has slides — e.g.
`createDeferralSlides`) or create a new array and render it with
`<GuideCarousel slides={...} />` in the relevant section. A single-image
section can use `<GuideImage src="/user-guide/<name>.png" alt="..." />`
instead of a carousel.
