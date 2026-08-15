# Formulaire de demande — contrat d'intégration

> **À transmettre au projet « site web ».** Ce document se suffit à lui-même :
> il ne suppose aucune connaissance de l'app de gestion.

Le formulaire est **hébergé par l'app** et s'affiche dans un **iframe** sur le site. Rien à
coder côté site à part le cadre : pas d'API, pas de clé, pas d'anti-spam à réécrire. Les
demandes arrivent directement dans la base et déclenchent les emails.

## L'URL

```
https://<domaine-de-l-app>/?share=<TOKEN>&lang=fr
```

- `<TOKEN>` : créé dans l'app, **Options → Shared Links**, type *Website Enquiry Form*.
  Un seul token suffit pour tout le site.
- `lang` : `fr`, `en` ou `es`. **C'est le site qui décide**, parce qu'il est le seul à savoir
  quelle page il sert : un francophone qui lit la page espagnole doit voir le formulaire en
  espagnol. Sans le paramètre, le formulaire suit la langue du navigateur ; le visiteur garde
  trois petits drapeaux pour corriger.

## Le cadre

```html
<iframe id="bkc-enquiry"
        src="https://<domaine-de-l-app>/?share=<TOKEN>&lang=fr"
        title="Nous contacter"
        style="width:100%;border:0;display:block;height:560px"
        loading="lazy"></iframe>
```

## Les deux messages à écouter

Le formulaire parle à la page parente via `postMessage`. Sans ce petit script, l'intégration
marche quand même — mais avec une barre de défilement **à l'intérieur** du cadre, ce qui est
précisément le détail qui trahit un iframe.

```html
<script>
  window.addEventListener('message', function (e) {
    // ⚠️ N'accepter que l'origine de l'app : sans ce test, n'importe quelle
    // page ouverte ailleurs pourrait redimensionner ce cadre.
    if (e.origin !== 'https://<domaine-de-l-app>') return;
    var d = e.data || {};

    // 1. Hauteur — le formulaire change de taille (erreur affichée, champ
    //    « Autre » qui apparaît, écran de succès).
    if (d.type === 'bkc:height' && d.height) {
      document.getElementById('bkc-enquiry').style.height = d.height + 'px';
    }

    // 2. Succès — le message est parti. L'URL de la page parente ne change
    //    jamais, donc sans cet événement les statistiques du site ne verront
    //    aucune conversion.
    if (d.type === 'bkc:enquiry-sent') {
      // gtag('event', 'generate_lead') ou l'équivalent
    }
  });
</script>
```

## Ce que le formulaire demande

Quatre champs, visibles d'emblée — c'est ce qui le fait convertir, et **il ne doit pas
grossir** : email, nom (seul champ obligatoire), « comment nous avez-vous trouvés ? » (liste
déroulante alimentée depuis l'app, + « Autre » avec précision libre), et un texte libre.

Le nombre de personnes, les dates et les envies ne sont **pas** demandés : ils vivent dans le
texte libre, et sont renseignés côté app à la lecture. Les demander ici ferait fuir.

## Côté app, ce qui se déclenche

1. La demande est enregistrée (statut *new*, canal *form*).
2. Un email part à `contact@bilenekite.com` avec le message complet.
3. Un accusé de réception part au visiteur, dans sa langue, s'il a laissé un email.

## Qui a le droit d'encadrer le formulaire — **fait le 2026-08-15**

`client/vercel.json` pose l'en-tête sur **toutes** les réponses de l'app :

```
Content-Security-Policy: frame-ancestors 'self' https://bilenekite.com https://www.bilenekite.com
```

Le navigateur du visiteur refuse alors d'afficher l'app dans un cadre servi par un autre
domaine. Cela vaut aussi pour l'app d'administration, ce qui est souhaitable : rien ici n'a
vocation à être encadré ailleurs.

⚠️ **Les deux domaines sont listés exprès** (apex *et* www). Si le site répond sur les deux et
qu'un seul est déclaré, le formulaire devient une page blanche sur l'autre — la protection
casserait ce qu'elle est censée protéger.

⚠️ **Ne pas y ajouter `X-Frame-Options: DENY`**, qui bloquerait tout, y compris le site.

**Ce que ça protège, et ce que ça ne protège pas.** Ça évite que le formulaire s'affiche sur un
site tiers — un intérêt d'image. Ça ne protège **pas** les demandes : quelqu'un qui encadre le
formulaire n'en détourne aucune, elles arrivent chez gui de toute façon. Et ça ne change rien
au fait que la clé anon est publique : créer des demandes en tapant l'API directement reste
possible, honeypot et délai de 3 s ne valant que pour l'interface. Si un jour il faut se
défendre du spam, c'est là qu'il faudra agir, pas ici.

⚠️ **Le serveur de développement Vite n'envoie pas cet en-tête** : en local, l'encadrement
marche depuis n'importe où. La vérification n'a de sens que sur le déploiement Vercel.

## Points de vigilance

- **Le formulaire est épinglé sur la base de production.** Ne pas le tester en le pointant
  ailleurs : une vraie demande envoyée dans la base de test n'arriverait jamais.
- **Pas de secret dans le JavaScript du site.** Il n'y en a pas besoin ici, et il ne faut pas
  en introduire : tout ce qui est dans le JS d'un site public est lisible par tous. La
  protection tient aux droits d'écriture très étroits côté base — le formulaire peut créer une
  demande, et rien d'autre : ni la relire, ni fixer un budget, ni marquer une demande gagnée.
- **Anti-spam déjà en place** : champ piège invisible + refus des envois en moins de 3
  secondes. Les deux tombent sur l'écran de succès, donc un robot n'apprend rien.
- **`loading="lazy"`** si le formulaire est bas de page ; à retirer s'il est visible d'emblée.

## Vérifié le 2026-08-14

Formulaire ouvert dans un iframe : hauteur transmise (543 px), `?lang=fr` respecté à
l'intérieur du cadre, envoi depuis l'iframe → événement `bkc:enquiry-sent` reçu par la page
parente, ligne créée en base avec la bonne langue et la bonne origine. Et par curl : un
visiteur peut créer une demande, mais `budget_eur`, `status`, `channel` et `party_size` sont
refusés en 42501, et toute lecture aussi.
