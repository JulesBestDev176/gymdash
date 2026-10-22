# Renouvellement et récupération des mots de passe GymPass

## GymDash

Les listes Utilisateurs et Équipe d’une salle proposent :

- le numéro WhatsApp enregistré, ou « Numéro à renseigner » ;
- l’ajout/la correction du numéro, contrôlé et unique dans la salle ;
- le renouvellement du mot de passe d’un compte actif, après confirmation.

L’indicatif est facultatif à la saisie dans GymDash et GymPass. Avant validation et enregistrement, `77 123 45 67` devient `+221771234567`. Les formes `+221…`, `221…` et `00221…` sont acceptées sans ajouter deux fois l’indicatif ; espaces, tirets et parenthèses sont nettoyés. Le contrôle d’unicité est effectué sur le numéro normalisé, de sorte qu’un même numéro saisi avec et sans indicatif reste un doublon dans la salle.

Le backend génère un mot de passe temporaire aléatoire de 24 caractères (144 bits), le hache, révoque les sessions et autorisations de récupération précédentes, puis transmet email et mot de passe par Relayio. La réponse ne contient jamais le mot de passe. Une connexion avec ce mot de passe déclenche le changement obligatoire. Un délai de 60 secondes interdit les renouvellements répétés ; la route est aussi limitée par IP.

L’interface distingue l’acceptation de l’envoi par Relayio et l’absence de confirmation. Si l’envoi échoue, le compte et son nouveau mot de passe restent enregistrés ; vérifier Relayio puis renouveler à nouveau après le délai. Aucun compte n’est recréé.

Routes, réservées au garde GymDash existant (secret et JWT d’un administrateur autorisé) :

- `PATCH /api/v1/users/admin/:id/contact` : `{ gymId, telephone }`.
- `POST /api/v1/users/admin/:id/reset-password` : `{ gymId }`.

L’identifiant utilisateur est vérifié dans la salle indiquée. Les routes JWT ordinaires de profil/équipe refusent désormais les changements du numéro de récupération : un jeton volé ne suffit pas pour détourner la récupération vers un autre téléphone.

## GymPass : mot de passe oublié

1. Saisie et validation de l’email. Réponse publique identique pour un compte connu, inconnu, inactif ou sans téléphone utilisable.
2. OTP de six chiffres envoyé au téléphone enregistré via Relayio. La livraison est lancée après la réponse pour éviter que la latence Relayio indique l’existence du compte. En cas de redémarrage pendant cet envoi, l’utilisateur peut redemander un code après le délai.
3. Vérification effective du code côté backend avant d’afficher le nouveau mot de passe. Le code expire après 10 minutes et ne peut servir qu’une fois ; au plus 5 essais. Seul un HMAC du code est stocké en base.
4. Après vérification, une autorisation aléatoire de 256 bits, valable 5 minutes, permet uniquement de choisir le nouveau mot de passe. Seul son SHA-256 est stocké en base. Sa consommation est conditionnelle et atomique.
5. Deux saisies identiques : au moins 12 caractères, au plus 72 octets UTF-8 (limite bcrypt). Les espaces ne sont pas supprimés du mot de passe.
6. Nouveau mot de passe enregistré, anciennes sessions révoquées et nouvelle session renvoyée par le parcours normal d’émission des JWT. GymPass installe les jetons et ouvre l’application sans seconde saisie de connexion.

Renvoi : 60 secondes entre demandes, 5 demandes par heure et par compte, limites supplémentaires par IP sur les routes publiques. Les compteurs de compte et de tentatives persistent en base ; les limites IP utilisent le stockage local de Nest Throttler (une instance). En cas de plusieurs instances, utiliser un stockage partagé pour une limite IP globale. La configuration du reverse proxy doit conserver une adresse client fiable pour éviter de regrouper tous les utilisateurs derrière la même IP de proxy.

Routes publiques :

- `POST /api/v1/auth/forgot-password` : `{ email }`.
- `POST /api/v1/auth/verify-reset-otp` : `{ email, otp }` → `{ resetToken, expiresIn: 300 }`.
- `POST /api/v1/auth/reset-password` : `{ email, resetToken, newPassword, confirmPassword }` → session authentifiée.

L’ancien reset direct avec `otp` ne permet plus de contourner la vérification. Les réponses d’authentification et d’autorisation portent `Cache-Control: no-store`. Les listes de comptes et les logs des erreurs de compte ne divulguent ni hachages, ni OTP, ni autorisations, ni mots de passe.

## Sessions

`User.authVersion` est inclus dans les nouveaux JWT et comparé au compte à chaque validation/refresh. Chaque changement de mot de passe et déconnexion explicite incrémente cette version. Les jetons antérieurs à la migration restent compatibles à la version zéro, jusqu’au premier changement ou à leur expiration. Les nouveaux refresh tokens sont hachés intégralement avec SHA-256 pour éviter la troncature bcrypt à 72 octets ; l’ancien stockage bcrypt reste accepté seulement à la version zéro.

Les changements de mot de passe depuis les paramètres et à la première connexion renvoient également une nouvelle session, installée par GymPass. Une déconnexion explicite efface les jetons locaux et désactive la reconnexion biométrique pour cette session révoquée ; la restauration biométrique reste disponible pour les sessions encore actives.

## Migration et mise en service

Modifications locales, aucun déploiement ni envoi WhatsApp réel effectué pendant la validation.

1. Avec la connexion à la base cible configurée, lancer le précontrôle en lecture seule : `node scripts/audit-staff-phones.cjs` dans `gympass_backend`. La sortie contient uniquement les identifiants des comptes incomplets et des groupes en doublon, sans numéros ni mots de passe.
2. Corriger les vrais doublons avant d’appliquer la migration `20261020200000_staff_password_recovery`. Elle normalise les numéros sénégalais existants, conserve les comptes sans téléphone (`NULL`) et ajoute l’unicité `(gymId, telephone)`. Elle invalide les anciens OTP en clair. Toute collision arrête la transaction sans modifier les comptes. Aucun numéro fictif ni suppression automatique de compte.
3. Déployer backend, GymDash et GymPass ensemble : le contrat de récupération et les réponses de changement de mot de passe ont évolué. Les anciens clients de récupération doivent être mis à jour.
4. Compléter les numéros manquants depuis GymDash. La création exige déjà un numéro valide. Les anciens comptes incomplets peuvent se connecter avec leurs identifiants, mais ne peuvent récupérer un mot de passe par WhatsApp avant correction du contact.
5. Conserver les variables Relayio déjà utilisées : `RELAYIO_BASE_URL`, `RELAYIO_API_KEY`, `RELAYIO_SESSION_ID` ; `JWT_SECRET` reste obligatoire.

## Vérifications

Validation finale : 55 tests backend/HTTP, 1 test d’intégration PostgreSQL et 14 tests Flutter réussis. Build backend, vérification TypeScript GymDash et analyse Flutter ciblée réussis. PostgreSQL de test arrêté et supprimé après validation.

- Tests de service : réponse non révélatrice, hachage, délai de renvoi, limite horaire, limite d’essais, expiration, échec Relayio, confirmation, consommation unique et concurrence.
- Tests HTTP : gardes GymDash, refus d’un simple admin de salle ou d’un refresh token, contrôle de version JWT, DTO, refus du changement de contact par session ordinaire et limitation IP réelle.
- Test PostgreSQL isolé : unicité par salle, concurrence de vérification/réinitialisation, révocation des JWT et refresh tokens, renouvellement admin, mot de passe temporaire et changement obligatoire.
- Migration exécutée sur un ancien schéma dans PostgreSQL éphémère : doublon refusé avec rollback intégral et conservation des trois comptes fictifs, puis normalisation et création de l’index après correction du doublon fictif.
- Tests Flutter : email invalide, OTP invalide bloquant l’étape suivante, confirmation différente, reset avec autorisation et installation des jetons ; tests de scan existants conservés.

Référence consultée : [OWASP — Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html). La connexion automatique après reset est une demande explicite du produit ; elle passe par la consommation atomique de l’autorisation et l’émission habituelle d’une nouvelle session.
