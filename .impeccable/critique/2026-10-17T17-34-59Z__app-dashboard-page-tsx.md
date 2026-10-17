---
target: app/dashboard/page.tsx
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
target_identity: "file:C:\\Users\\HP\\Documents\\Informatique\\project\\GymPass\\gymdash\\app\\dashboard\\page.tsx"
target_fingerprint: "sha256:831b662da90a3d14ef320564e6276b4ba8216fbea0a748d0fba9c0b401d8dd6a"
target_path: "C:\\Users\\HP\\Documents\\Informatique\\project\\GymPass\\gymdash\\app\\dashboard\\page.tsx"
timestamp: 2026-10-17T17-34-59Z
slug: app-dashboard-page-tsx
---
## Design Health Score

| # | Heuristique | Score | Finding clé |
|---|-------------|-------|-------------|
| 1 | Visibility of System Status | 3 | Badge LIVE + skeletons excellents ; confirmations d'actions manquantes |
| 2 | Match System / Real World | 2 | "Redeploy", "Monitoring" = jargon IT dans une UI métier |
| 3 | User Control and Freedom | 2 | Logout destructif sans confirmation ; pagination payments bloquée à 50 |
| 4 | Consistency and Standards | 3 | Système de tokens solide ; borderLeft inline hors design system |
| 5 | Error Prevention | 1 | Redeploy sans guard, toggle sans confirmation, logout sans dialog |
| 6 | Recognition Rather Than Recall | 3 | Nav labels présents ; filtres actifs non affichés |
| 7 | Flexibility and Efficiency | 1 | Zéro raccourci clavier, zéro export, période KPI figée |
| 8 | Aesthetic and Minimalist Design | 3 | Palette sobre et cohérente ; dashboard trop dense |
| 9 | Error Recovery | 1 | Aucun toast, skeleton sans timeout d'erreur |
| 10 | Help and Documentation | 0 | Aucun tooltip, aucune aide contextuelle |
| Total | | 19/40 | Acceptable — travail significatif nécessaire |

## Priority Issues

### [P0] Redeploy sans confirmation — monitoring/page.tsx:224
### [P0] Toggle abonnement sans confirmation ni undo — payments/page.tsx:220
### [P1] ARIA violations systématiques (5+ fichiers)
### [P1] Contraste --fg3 (#3e4f65) ~3.9:1 — échec WCAG AA
### [P2] Dashboard non-responsive — grids inline sans breakpoints
### [P2] Touch targets < 44px (sidebar-logout 26px, btn-icon 34px)
### [P2] Aucun export CSV
### [P3] Pattern side-tab (borderLeft card-accent + monitoring inline)
