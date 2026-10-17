# Abonnements des salles

Dans GymDash, ouvrir **Abonnements salles → Paramètres** pour renseigner le tarif mensuel, le délai de grâce et le nom/coordonnées de l’émetteur des factures. Le tarif commence vide ; aucune valeur commerciale n’est inventée. Chaque salle peut hériter du tarif global ou avoir son tarif spécifique dans **Configurer**.

Les salles existantes sont « Non configuré » et restent accessibles. Activer leur contrôle ou émettre une première facture démarre leur facturation. Une facture impayée ne prolonge pas l’accès : le délai de grâce peut commencer. Une salle exemptée est accessible. Le délai de grâce s’applique immédiatement aux échéances existantes quand il est modifié. Un tarif modifié concerne seulement les nouvelles factures.

Depuis **Salles → Facturer**, choisir de1 à120mois et indiquer si le paiement a déjà été reçu intégralement. Sinon, la facture est à payer ; **Factures → Encaisser** permet un ou plusieurs règlements partiels. Seul le solde intégral accorde la durée. Les renouvellements anticipés prolongent la date déjà payée. Après expiration, la nouvelle période commence au moment du règlement enregistré. Le jour d’anniversaire est conservé malgré les mois courts.

Les factures ont un numéro annuel, des informations client/émetteur figées et un PDF téléchargeable. Les montants émis ne sont pas modifiables. Seules les factures sans aucun règlement peuvent être annulées avec un motif ; leur PDF ne présente plus de montant dû. Les paiements sont conservés au journal.

Une demande financière dont la réponse est incertaine garde son identifiant et ses champs dans l’onglet du navigateur, même après rechargement. **Reprendre** confirme cette même demande. Modifier les champs signifie une nouvelle opération. Après confirmation, l’identifiant est libéré. Les paiements en ligne, remboursements et avoirs ne font pas partie de cette première version.

Le contrôle de l’abonnement bloque les opérations de la salle après le délai de grâce, même pour une session déjà connectée. Il ne change pas le statut manuel de la salle. Le compte admin plateforme conserve l’accès au renouvellement. Les utilisateurs GymBro indépendants ne sont pas concernés. Le backend réserve les routes GymDash au JWT du compte ADMIN autorisé dans `GYMDASH_BILLING_ADMIN_EMAILS`, plus le secret de serveur.

Le compte « Super Admin GymDash » est créé par le seed avec `GYMDASH_ADMIN_EMAIL` (par défaut `admin@gympass.sn`). Il utilise le rôle technique `ADMIN`, comme les propriétaires de salle ; seul son compte doit figurer dans `GYMDASH_BILLING_ADMIN_EMAILS`. Le compte propriétaire de `TEST_CREDENTIALS.md` ne doit pas recevoir cet accès.

Vérification sans création de facture réelle : définir `GYMDASH_VERIFICATION_TOKEN` dans l’environnement du processus avec un jeton actif du super admin, puis exécuter `powershell -ExecutionPolicy Bypass -File scripts/verify-billing.ps1`, et la même commande avec `-BaseUrl https://dash.gympass.minifootapp.com`. Le script n’affiche pas le jeton et envoie uniquement une demande vide volontairement invalide pour vérifier400.
