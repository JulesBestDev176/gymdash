# Emails de connexion des comptes de salle

Les adhérents (`Member`) ne demandent déjà aucun email. Cette modification concerne les comptes d’équipe (`User`) créés dans GymDash et GymPass.

## Comportement

La création ne demande plus de champ `email`. Le backend prend le nom réel de la salle en base, normalise les accents et caractères spéciaux et génère `prenom.nom@nom-de-la-salle.sn`. Les espaces des noms sont retirés ; ceux du nom de salle deviennent des tirets. Exemple : Moussa Diop dans Gym Dakar Plateau → `moussa.diop@gym-dakar-plateau.sn`.

En cas d’adresse déjà prise, y compris avec une casse différente, il essaie `moussa.diop1@…`, puis `moussa.diop2@…`. La vérification couvre tous les comptes et une collision d’unicité à l’insertion déclenche un nouvel essai. Les tailles maximales des parties de l’adresse sont respectées. Les adresses existantes sont conservées. La contrainte de téléphone par salle et le parcours de récupération sont documentés dans staff-password-recovery-2026-10-20.md.

L’email envoyé par un ancien client est ignoré. Le téléphone WhatsApp sénégalais est obligatoire à la création, y compris dans les deux formulaires GymDash. Le backend normalise le numéro et transmet automatiquement l’adresse générée, le prénom et le mot de passe temporaire à Relayio après création du compte. Aucun modal d’envoi manuel ni ouverture de WhatsApp n’est nécessaire.

La réponse de création contient `whatsapp.status`. GymDash affiche l’acceptation par Relayio ou l’absence de confirmation de l’envoi ; une acceptation ne prouve pas la réception sur le téléphone. En cas d’échec d’envoi, le compte créé est conservé. Les vérifications automatisées n’envoient aucun message réel.

Le texte « L’email de connexion sera généré automatiquement avec le nom de la salle. » est retiré des deux formulaires.

## Fichiers concernés

- Backend : DTO de création, `UsersService`, helpers `staff-email.ts`, tests `users-email.test.cjs`.
- GymDash : formulaire et modal de création dans les pages de salle ; retrait de la saisie d’email.
- GymPass : écran d’équipe ; suppression du domaine fixé à `gymdakarplateau`, de la génération locale et de l’email envoyé à la création. Affichage de l’adresse réellement retournée par le serveur, avec son suffixe éventuel.

## Vérification

- Douze tests backend réussis : contrat sans email, génération, accents, nom de salle, doublons, casse, concurrence et collisions à l’insertion, compatibilité d’anciens clients, erreurs non liées et limites de longueur.
- Build backend réussi.
- Vérification TypeScript GymDash (`tsc --noEmit`) réussie.
- Analyse Flutter ciblée sur l’écran d’équipe.
- ESLint GymDash bloqué avant analyse par une dépendance locale manquante : `es-abstract/2024/AddEntriesFromIterable`, requise par `object.fromentries` / `eslint-plugin-react`. Aucun résultat de lint n’est revendiqué.

Modifications locales ; aucun déploiement ni création de compte sur le serveur de production.
