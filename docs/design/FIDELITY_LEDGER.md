# Overview fidelity ledger

QA date: 2026-08-23

Concept: `docs/design/overview-concept.png` (1536×1024)

Implementation QA used the local Next.js dev server, Chrome DOM inspection, and Playwright screenshots at exact 1536×1024 and 390×844 viewports. Temporary QA screenshots were removed after `view_image` comparison.

| Area | Concept evidence | Render evidence | Result |
| --- | --- | --- | --- |
| First viewport | 288px charcoal sidebar, 64px header, white app canvas | Same desktop shell geometry | Matched |
| Summary row | Three equal connection cards with zero metadata only | Same order, copy, values, icon containers, and card height | Matched |
| Connections table | Open table with title row, column row, centered empty state | Table top, content height, actions, and empty-state hierarchy aligned | Matched after increasing table/title/column heights |
| Palette | True white surfaces, cool-gray borders, orange-red actions | `#ffffff`, `#dfe2e5`, and `#f4511e` tokens used | Matched |
| Typography | Compact Swiss-style UI, 30px page title, restrained labels | Self-hosted Geist with explicit control typography | Matched |
| Icons | Thin outline navigation and status icons | Tabler Icons only with consistent 1.4–1.8 strokes | Matched to project source-of-truth icon family |
| Copy | Overview labels, CTA labels, empty state, security note | No added Ads metrics, shops, claims, or charts | Exact above-the-fold copy match |
| Responsive behavior | Collapsible sidebar and mobile continuation | Desktop collapse/expand and mobile drawer open/close verified; no horizontal overflow at 390px | Matched |

## Intentional deviation

The generated concept added a “DATA HUB” sub-label under the wordmark. The implementation uses the supplied official Rabbit Bytes wordmark asset exactly and does not recreate or alter brand artwork. This is intentional because the real brand asset is the product source of truth.

No other material visual mismatch remained at sign-off.
