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

## À faire une fois côté hébergement

⚠️ **Autoriser l'encadrement uniquement depuis le domaine du site.** Par défaut la réponse
peut être refusée par le navigateur, ou au contraire ouverte à tous — et « ouverte à tous »
signifie que n'importe qui peut encadrer ce formulaire sur son propre site et faire passer ses
demandes pour les vôtres. Sur Vercel, un en-tête sur la réponse :

```
Content-Security-Policy: frame-ancestors 'self' https://www.bilenekite.com https://bilenekite.com
```

(et **pas** `X-Frame-Options: DENY`, qui bloquerait tout).

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
