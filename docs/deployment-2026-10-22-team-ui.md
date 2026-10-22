# GymDash — déploiement du 22 octobre 2026

- Image publiée : `electronteams/gymdash:ui-team-20261022-a1`.
- Digest : `sha256:aeb523e846a9231cf06838d800ae596eea3bcab49ac1ee8b0f8e22f4aad23014`.
- Application Coolify : `ijpluezkha433o1szxfxaqzp`.
- Déploiement : `1c76diksn1ebcakt5h9smcsh`, statut `finished`.
- Build Next.js : `_av5BmvpCdg8s0gKRQfJ0`.
- Site : https://dash.gympass.minifootapp.com.

La page Salle → Équipe contient la colonne Téléphone séparée et les actions alignées en icônes (activation, téléphone, renouvellement du mot de passe), avec libellés au survol. TypeScript et build Docker de production validés. Vérification publique : HTTP 200, identifiant du build identique et JavaScript des actions en icônes effectivement servi.

Coolify utilise désormais ce tag versionné. L’ancien tag configuré était `latest`, conservé sur Docker Hub : seule l’image versionnée a été poussée. Les variables et autres paramètres Coolify n’ont pas été modifiés. Aucun backend, migration ou APK déployé dans cette opération.
