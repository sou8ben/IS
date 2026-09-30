# Design QA — BIP 風格巡查派工管理原型

## Evidence

- source visual truth path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/bip-user-management.png`
- implementation screenshot path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/is-works-final.png`
- responsive screenshot path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/is-work-detail-1280.png`
- workbench screenshot path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/is-workbench-final.png`
- side-by-side comparison path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/bip-visual-comparison.png`
- viewport: primary `1440 × 900` CSS px; responsive check `1280 × 800` CSS px
- source pixels: `1424 × 478`; implementation pixels: `1440 × 900` and `1280 × 800`
- density normalization: Chrome `deviceScaleFactor = 1`; full-width source and the implementation's top application region were displayed in equal `694 × 233` comparison frames using top-left alignment. Native-resolution captures were then inspected separately for typography, controls and table detail.
- state: BIP user-management list reference compared with the prototype work-management list; work-detail page checked at the minimum supported desktop width.

## Full-view Comparison Evidence

The combined comparison confirms the same desktop information architecture: compact global header, workspace/product context, tab strip, persistent left navigation, muted page canvas, dense white content surface, red primary action, thin borders, and low-radius controls. The prototype intentionally omits YonBIP branding and uses the system name, as required.

## Focused Region Comparison Evidence

Native-resolution inspection covered the header/search/account area, tab active indicator, left navigation states, filter controls, table headers and rows, semantic tags, pagination, work-detail actions, timeline, SLA panel, and local Macau map. Focused inspection was required because the normalized full-view comparison makes dense table text too small to assess reliably.

## Required Fidelity Surfaces

- Fonts and typography: Traditional Chinese system-font stack, compact 12–14 px operational copy, clear 18–22 px page hierarchy, restrained weights, and ellipsis treatment match the source's enterprise density. No broken wrapping or illegible labels were found.
- Spacing and layout rhythm: 48 px header, 36 px tabs, 224 px expanded navigation, 16 px page padding, 32 px controls, 38–42 px table rows, thin borders, and small radii reproduce the BIP rhythm. The 1280 px detail capture preserves all persistent controls without overlap.
- Colors and visual tokens: red `#E60012` primary hierarchy, cool gray canvas, white working surfaces, gray borders, dark body text, and restrained semantic blues/greens/oranges are consistently applied. No decorative gradients remain.
- Image quality and asset fidelity: the map is a locally stored, generated raster asset with crisp rendering, correct crop, domain-appropriate Macau geography, and no external dependency. Standard interface icons come from one consistent icon library; no emoji or text-glyph substitutes are used.
- Copy and content: Traditional Chinese operational language is coherent and traceable to the detailed design's plan, inspection, event, work, notification, reporting, device, log, and integration domains.

## Primary Interactions Tested

- Work list rendered and first work link opened the correct hash route.
- Work detail rendered the processing record and related operational panels.
- 「解決」 opened the correct action drawer; 「取消」 closed it.
- Notification icon opened the notification popover.
- Sidebar collapse control applied the compact navigation state.
- Hash navigation rendered the plan list without a 404.
- Browser runtime and console errors checked after interaction pass: none.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- Accepted intentional deviations: the YonBIP logo is not reproduced; the prototype exposes domain-specific navigation labels instead of the reference product's developer-console modules.

## Open Questions

- Formal BIP design tokens and private SDK were not available. The current component adapter and CSS tokens are ready to be replaced when the official package is supplied.

## Comparison History

- Pass 1: source and rendered implementation compared side by side after viewport normalization. No P0/P1/P2 finding was identified, so no visual correction iteration was required.

## Implementation Checklist

- [x] BIP-style shell, navigation proportions, tabs, filters, tables, status tags and action hierarchy
- [x] 1440 × 900 primary viewport
- [x] 1280 × 800 responsive desktop viewport
- [x] Local map asset and consistent icon system
- [x] Primary route and drawer interactions
- [x] Browser runtime error check
- [x] TypeScript, production build and site tests

## Follow-up Polish

- P3: once official BIP tokens are available, replace inferred neutral grays and exact font fallbacks with platform-provided values.

final result: passed
