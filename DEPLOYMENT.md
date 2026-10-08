# Publishing the playable website

The production game is a static website: `dist/index.html` contains its JavaScript, styles, artwork and fonts. No backend, player account, or paid service is needed for the current single-player game.

## GitHub Pages

`.github/workflows/pages.yml` installs locked dependencies, runs the simulation tests, builds the game, and publishes `dist` when `main` is updated. It can also be started manually in Actions.

Before the first deployment, enable **Settings → Pages → Source → GitHub Actions** in the repository. The authenticated GitHub API can enable this with:

```sh
gh api --method POST repos/lsdxo/xoxo/pages -f build_type=workflow
```

If a Pages site already exists, inspect its settings and use PATCH only if switching it to workflow deployment is intended. Do not reset or force-push an existing remote branch.

After publishing the source to `main`, wait for the workflow to finish successfully. Read the real URL from the Pages API or deployment output. Confirm the website returns the game document, then playtest the deployed URL:

```sh
GAME_URL="<actual published URL>" npm run test:browser
```

A passing local build or a prepared workflow is not proof of a published site. Report a live link only after publication succeeds and the link is verified.

## Cloud environment networking

The existing Git proxy provides repository access. Deployment additionally needs `api.github.com` for Pages settings, workflow results and deployment metadata, and `lsdxo.github.io` to verify this repository's published site. These domains must be allowed in the environment network settings. Existing authentication should be tested after network access is available before asking for any new credential. Never paste tokens into chat or commit them.

## Other static hosts

Upload the **contents of `dist`**, including `THIRD_PARTY_NOTICES.txt`, to the user's chosen static host. The build has no runtime environment variables and works under a repository subpath without additional asset routing. Keep publishing credentials outside the repository.
