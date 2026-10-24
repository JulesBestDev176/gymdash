# Import APK — correction du 24 octobre 2026

Le dashboard utilisait un budget d'import de cinq minutes, mais la configuration Traefik de production ne définissait aucun `respondingTimeouts.readTimeout`. Sa valeur par défaut de 60 secondes pouvait donc interrompre une réception plus lente. Cela explique un arrêt à un pourcentage variable, selon la vitesse du transfert ; les journaux applicatifs consultés ne prouvent pas la durée d'une tentative particulière.

Deux paramètres ont été ajoutés à la configuration existante, pour HTTP et HTTPS : délai de réception de 300 secondes. Le proxy a été redémarré via l'API Coolify. Le contrôle a confirmé un état `running`, une configuration sauvegardée effectivement appliquée, et deux délais configurés à 300 secondes. Dashboard `/login`, API `/api/v1/health` et site public répondent 200 après application. La configuration précédente est sauvegardée localement dans `.tmp/apk-proxy-before.yml` au niveau du workspace.

Le dashboard protège désormais les départs de page pendant un import, affiche les transferts momentanément sans progression et conserve les métadonnées d'un import non confirmé après actualisation. Il distingue le transfert du fichier de son analyse. La récupération ne renvoie jamais l'APK et ne prétend pas reprendre des octets perdus : l'historique doit être vérifié avant toute nouvelle sélection du fichier.

Aucun APK réel n'a été importé ou publié pendant la correction. Les tests de navigateur utilisent exclusivement des fixtures, y compris la nouvelle tentative manuelle après actualisation. Les contrôles de droits plateforme, les limites de taille et la publication explicite restent actifs.

Référence du délai Traefik : [documentation officielle](https://doc.traefik.io/traefik/v3.0/migration/v2/#entrypointtransportrespondingtimeoutsreadtimeout).
