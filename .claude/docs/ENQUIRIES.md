# Enquiries — l'avant-réservation

> Conception arrêtée avec gui les 2026-08-13/14. **Rien n'est codé.** Ce document est à
> relire à froid et à corriger avant d'écrire la première ligne.
> Nom retenu pour l'UI : **Enquiries** (le mot de l'hôtellerie ; décrit ce que la chose est,
> pas ce que la personne vaut). En français on dit « demandes ».

## La règle qui tient tout

**Une demande ne touche ni l'argent, ni l'occupation.** Pas de chambre bloquée, pas de ligne
dans la compta, pas de document. Le jour où on réserve une chambre ou où on encaisse, ce
n'est plus une demande : c'est une réservation `provisional`.

Pourquoi c'est non négociable : `computeSeasonTotals` n'exclut que les réservations
**annulées**. Une `provisional` compte à 100 % dans le CA et dans l'encours. Dix prospects qui
ne viendront jamais et le résultat est faux de plusieurs milliers d'euros.

**Décision gui : une demande n'apparaît pas dans le planning.** À rediscuter un jour si le
besoin de poser des options se fait sentir ; ce n'est pas le cas aujourd'hui.

## Où ça vit

**L'onglet Submissions devient Enquiries.** Pas de 12ᵉ onglet : une soumission du formulaire
public n'est qu'une demande dont l'origine est le site. Sinon on cherche la même personne à
deux endroits selon qu'elle a écrit par le site ou par WhatsApp.

## Le modèle

Une demande porte : identité (nom, email, téléphone, langue), **origine** (la réponse libre à
« comment nous avez-vous trouvé ? »), le **message d'origine** en prose, et ce que gui
renseigne après lecture : combien de personnes, quand (mois approximatif suffit), ce qui les
intéresse (cours / location / hébergement), budget indicatif, statut, notes datées.

Points tranchés :
- **Budget** : un nombre optionnel, **pour le groupe entier**, jamais demandé sur le
  formulaire public (personne ne donne son budget à un inconnu, et ça fait fuir). Renseigné
  par gui après le premier échange — sa présence signale une conversation vraiment engagée.
- **Dates** : mois approximatif accepté, sans jour. La frise le rend tel quel.
- **Statuts** : nouveau → en discussion → attente d'eux → gagnée / perdue (+ raison en un mot).
  Cinq, pas douze. Chaque statut a **sa couleur**, et la couleur est un critère de tri et de
  filtre à part entière — c'est comme ça que gui retrouve ses fiches.
- **Silence** : jours depuis le dernier échange. Orange à **7 jours** (à réajuster à l'usage).
- **Origine** : « sa raison d'être, c'est la statistique » (gui). Donc **une liste déroulante**
  sur le formulaire public, **alimentée et modifiable par gui** — décision gui du 2026-08-14.
  Ce que ça implique :
  - La liste vit **en base**, pas dans le code (sinon chaque ajout demande un déploiement), et
    s'édite dans **Options** à côté de Pricing / Seasons / Shared Links.
  - ⚠️ **Trois libellés par entrée (FR/EN/ES)** : la liste s'affiche sur le formulaire public,
    qui est trilingue. Même gabarit que `document_templates` (jsonb par langue).
  - ⚠️ **On désactive, on ne supprime pas.** Une entrée effacée casserait les statistiques des
    demandes passées qui la référencent — même leçon que les tarifs verrouillés de
    Options → Pricing.
  - **Garder « Autre » avec une précision libre.** Sans ça, quelqu'un venu par un ami est
    forcé dans une case fausse : la statistique paraît nette et ment. « Autre » renseigné est
    plus honnête, et dit à gui quelle entrée ajouter à sa liste.
  Poser la question **à l'humain** vaut mieux que n'importe quel pistage technique : ça dit
  d'où viennent les gens qui viennent vraiment, pas seulement ceux qui cliquent.
- **Un seul utilisateur** (gui) : pas d'assignation, pas de « qui suit qui ».

## Les écrans

### L'écran de qualification — le cœur du dispositif

Le formulaire public ne capture que nom / email / origine (liste déroulante) / texte libre.
**La structure ne viendra donc jamais du visiteur** : le nombre, les dates, les envies sont
dans la prose.

D'où l'écran qui compte : le **message à gauche, quatre petits champs à droite** (combien,
quand, cours/loc, budget). On lit, on remplit, on referme — vingt secondes. Si qualifier
demande d'ouvrir une fiche puis de cliquer « modifier », personne ne le fera et le tableau
restera vide.

C'est le même écran que la **création à la main en 10 secondes** (WhatsApp, Instagram), sans
le message. Un seul écran à construire. **Un seul champ obligatoire : le nom.**

### Le tableau

Une ligne par demande, informations toujours à la même place :

| Qui | Quand | Ce qu'ils veulent | Budget | Statut | Silence |
|---|---|---|---|---|---|
| **Famille Muller** · 4 pers | ▓▓▓░░ *fév.* | 🪁 cours · 🎿 loc | 1 500 € | En discussion | **9 j** |

- **« Quand » est une mini-frise**, pas une date : en balayant la colonne on voit la saison se
  remplir et les mois creux. Une date écrite ne dira jamais ça.
- **« Silence »** est la colonne qui transforme la liste en outil de travail : elle dit qui
  relancer aujourd'hui. Tri par défaut, décroissant.
- **Une ligne non qualifiée ne montre pas des colonnes vides** — elle montre le début du
  message du client sur toute la largeur, avec une pastille « à qualifier ». Un tableau plein
  de tirets a l'air cassé ; ici l'absence d'information *est* l'information, et c'est la pile
  du jour.

Au-dessus : demandes ouvertes, personnes attendues, répartition par mois.

### Vieillissement — rien ne disparaît, tout se replie

- Vue par défaut = la liste de travail (ce qui est vivant), triée par silence.
- **Regroupement par mois d'arrivée**, passé replié, à venir déplié. **La ligne de groupe
  porte les totaux même repliée** : « Février — 6 demandes · 19 personnes · 3 gagnées ».
- **Archivage par saison**, en réutilisant la table `seasons` (`utils/seasonWindow.ts`).
- **Une gagnée quitte la liste de travail immédiatement** (décision gui) : elle est devenue une
  réservation, elle n'a plus rien à y faire. Elle part en archive **dans sa couleur**, et le
  tri/filtre par couleur la ramène en un clic. L'archive n'est pas un cimetière : c'est là
  qu'on lit le taux de transformation et l'origine réelle des clients en fin de saison.
- **Une seule barre de recherche** (noms, notes, email, téléphone). Si des résultats sont
  dans les saisons passées, une ligne discrète le dit — ni mélangés, ni cachés.
- **Raccourcis en un clic** plutôt qu'un constructeur de filtres : *À relancer*, *Nouvelles*,
  *Sans dates*, *Gagnées*.
- **Clôture de saison assumée** : « 14 demandes sans suite — clôturer ». gui décide, pas un
  compteur.
- Une demande d'un **client déjà venu** l'affiche (« déjà venu en 2026 »). L'information la
  plus utile commercialement de toute la liste, et elle est déjà en base.

## Rattacher une demande au vrai client

Deux chemins, dans cet ordre :

1. **Par construction** — depuis la fiche, gui génère un **lien personnalisé** vers le
   formulaire de réservation complet. Le lien porte l'identité de la demande, donc la
   soumission revient déjà rattachée. Rien à rapprocher. C'est le chemin normal, et il dit au
   passage qui a reçu le formulaire sans le remplir.
2. **Par rapprochement** — quelqu'un remplit le formulaire public sans passer par le lien.
   À l'arrivée, on cherche une demande candidate : **email identique** d'abord, sinon nom
   proche + dates compatibles. On **propose** le rattachement, on ne fusionne jamais tout
   seul : sur des données floues, une fusion erronée mélange les dossiers de deux personnes.
   Un bouton « c'est la même personne » / « non, nouvelle demande ».

La demande **survit** à la conversion : marquée gagnée, reliée à la réservation.

## Le contrat avec le projet « site web »

Le formulaire actuel (4 champs, visible d'emblée) est bon **et ne doit pas grossir** : c'est
ce qui le fait convertir. Il est **hébergé par l'app** et **embarqué en iframe** sur le site.

À prévoir des deux côtés :
- **Hauteur** : le cadre doit se redimensionner par échange de messages avec la page parente,
  sinon barre de défilement interne — le détail qui trahit un iframe.
- **Autorisation d'affichage** : n'autoriser que le domaine de gui, pas `*` (sinon n'importe
  qui encadre le formulaire et fait passer ses demandes pour les siennes).
- ⚠️ **Épingler PROD en dur.** La bascule PROD/TEST vit dans le `localStorage` : un visiteur
  arrive toujours avec un stockage vide, mais il ne faut pas s'appuyer dessus par accident.
- **Événement de succès** renvoyé à la page parente, sinon les stats de conversion du site ne
  voient rien.
- ⚠️ **Un secret dans le JS d'un site public n'est pas un secret.** Si le formulaire devait un
  jour vivre sur le site plutôt que dans l'iframe, la protection reposerait sur des droits
  d'écriture étroits + le honeypot existant, pas sur une clé.

## HubSpot / Brevo

**Mailchimp est abandonné** (facturation, 2026-08-14) : gui a exporté sa base en CSV et passe à
**Brevo**. À savoir : **Brevo n'est utilisé nulle part dans ce projet aujourd'hui.** Les emails
transactionnels de l'app partent par **Resend** (Edge Functions, `RESEND_API_KEY` en secret
Supabase). Brevo serait un ajout, pour le marketing uniquement.

Deux façons de l'alimenter, au choix :
- **Webhook base de données → Zapier → HubSpot + Brevo.** Le mécanisme qui déclenche déjà
  `notify-submission`. gui garde ses habitudes, rien de nouveau à maintenir.
- **Appel direct depuis l'Edge Function.** L'API contacts de Brevo est simple ; ça supprime la
  dépendance (et l'abonnement) Zapier, au prix d'une clé de plus à garder. Vu que c'est une
  facturation qui a fait quitter Mailchimp, l'option mérite d'être posée.

- ⚠️ **Ne PAS toucher à Resend.** Le transactionnel marche et sa configuration DNS a été
  douloureuse à obtenir. Brevo s'ajoute à côté, pour la newsletter — on ne consolide pas.
- ⚠️ **Brevo devra être authentifié dans la zone DNS de `bilenekite.com`** (son propre DKIM).
  `bilenekite.com` est en **DMARC `p=reject`** : un envoi non authentifié n'atterrit pas en
  spam, il est **rejeté**. C'est exactement le piège déjà vécu avec Resend en juillet
  (bounces « 550 rejected by DMARC policy »). Ajouter seulement — ne jamais toucher au SPF
  racine ni au MX Infomaniak.
- **Pas de case de consentement — décision gui (2026-08-14).** Toute demande part vers Brevo.
  Motif : une ou deux newsletters par an, les gens se désabonneront s'ils veulent.
  *Ce qui a été dit et écarté, pour que la décision ne soit pas rouverte à l'aveugle* : le
  RGPD suit la **résidence de la personne**, pas celle de l'entreprise — les clients sont
  majoritairement européens (formulaire en FR/EN/ES), donc « c'est le Mozambique » ne change
  pas l'exposition. Et le risque réel est la **délivrabilité** : Brevo surveille les plaintes,
  et `bilenekite.com` étant en DMARC `p=reject`, une réputation dégradée toucherait aussi les
  lettres de visa et confirmations envoyées par Resend depuis le même domaine.
  ➡️ Garde-fous retenus malgré tout : **lien de désinscription** (Brevo l'ajoute d'office, ne
  pas le retirer) et, si gui le veut un jour, une simple mention sous le bouton Envoyer —
  aucune friction, contrairement à une case.
- **La synchro ne bloque jamais et reste visible** : la demande est enregistrée d'abord.
  Témoin sur la fiche + bouton « renvoyer ». Une synchro qui échoue en silence est un client
  perdu sans le savoir.

## Plus tard, pas maintenant

Faire lire le paragraphe libre pour **pré-remplir les quatre champs en suggestion**
(« on dirait 4 personnes, février, cours »). Deux garde-fous : **suggestions à valider**,
jamais de remplissage silencieux — une erreur invisible sur un nombre ou des dates se propage
jusqu'à la planification ; et aucun blocage si ça échoue.

## Découpe proposée

✅ **Schéma complet appliqué TEST + PROD le 2026-08-14** (`2026-08-14a` puis `b`), vérifié par
curl anon sur les deux bases **et** connecté (semis, défauts, cascade des notes, et le `23503`
qui refuse de supprimer une origine utilisée).

0. ✅ **Liste des origines** — Options → 📣 Sources. Trilingue, retirable jamais supprimable.
1. ✅ **Onglet Enquiries** (2026-08-14) — liste de travail triée par silence, écran de
   qualification (message à gauche, les quatre champs à droite), création manuelle, notes
   datées qui remettent le silence à zéro, compteurs *Open / People expected / To chase*.
   Une fiche non qualifiée affiche son message et une pastille « to qualify » au lieu de
   colonnes vides. Vérifié au navigateur bout-en-bout sur TEST.
   ⚠️ **L'onglet Submissions vit encore à côté** — il se replie dans ce pipeline à l'étape 4,
   et la barre de navigation revient alors à une seule entrée.
2. ✅ **Le tableau qui se lit en balayant** (2026-08-14) — pleine largeur, la qualification
   passe en surimpression (c'est un geste qui demande de la concentration). Groupes par mois
   d'arrivée, **passés repliés**, en-tête portant ses totaux **même fermé**, groupe « No dates
   yet » toujours en tête et jamais replié. Frise d'arrivée commune à toutes les lignes,
   **construite sur les données et non sur la table `seasons`** : une arrivée hors saison
   configurée tomberait d'une frise calée sur la saison, et c'est justement celui qui demande
   pour décembre prochain qui ne doit pas disparaître (plafonnée à 14 cases). Recherche unique
   (noms, message, notes, contacts) **insensible aux accents** — « fevrier » trouve « février ».
   Pastilles *To chase / New / No dates* et **filtre par couleur de statut**. Vérifié au
   navigateur avec 9 fiches. **262 tests.**
3. ✅ **Formulaire léger + iframe + emails** (2026-08-14) — page publique servie par un lien
   `enquiry_form`, quatre champs, honeypot + délai de 3 s hérités du formulaire de résa.
   **Langue** : `?lang=` passé par le site (lui seul sait quelle page il sert), repli sur le
   navigateur, plus trois drapeaux pour le visiteur que les deux premiers ont mal deviné.
   **Iframe** : hauteur transmise en continu (sinon barre de défilement interne, le détail qui
   trahit) et événement de succès (sinon les stats du site ne voient aucune conversion).
   **Emails** : nouvelle fonction `notify-enquiry` — séparée de `notify-submission` exprès, dont
   les textes sont ceux de gui et qui n'a pas à être redéployée pour ça. Trigger pg_net
   déclenché **seulement** sur `channel='form'`.
   ⬜ **Reste à gui** : déployer la fonction, passer la migration `c` (2 valeurs à remplacer),
   créer le lien dans Options → Shared Links, et transmettre `ENQUIRY_FORM_EMBED.md` au projet
   site web. **268 tests.**
2. Le tableau (frise, silence, couleurs, groupes, recherche).
3. Le formulaire léger hébergé + iframe + contrat avec le projet site web.
4. Rattachement : lien personnalisé, puis rapprochement à l'arrivée.
5. Webhook Zapier → HubSpot (+ Mailchimp si la case existe).
6. Archivage / clôture de saison / statistiques d'origine.

## Restes à trancher

Rien de bloquant à ce stade. Les deux questions ouvertes (sort d'une demande gagnée,
traitement de l'origine) ont été tranchées le 2026-08-14 et sont intégrées ci-dessus.
