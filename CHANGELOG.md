# Changelog

All notable changes to this repository. Versions follow [semantic versioning](https://semver.org/).

## [2.0.0] — 2026-09-13

The archival release: self-contained, so that a copy of this repository can be built and read
without depending on anything fetched at build time. This is the version the paper cites.

A major version because an existing deployment cannot be upgraded in place without changes:
Traefik's certificate store moved from a bind-mounted file to a directory at a different
path, the `web` service lost a volume, the base image moved from Python 3.10 to 3.11, and the
page routes now behave differently when Firebase is absent. v1.0.0, tagged the day before,
does not build at all.

### Changed

- **The weighted MCC is now vendored rather than cloned.** `app/Dockerfile` previously ran
  `git clone https://github.com/fabiom91/MCC_Weighted.git` while building the image, which
  meant the scoring metric could differ between two builds of the same source and could not
  be recovered from an archived snapshot at all. The module now lives in the repository at
  `app/services/MCC_Weighted/`, vendored from upstream tag `v1.0.0`
  (commit `ed55752f5af1bf704d11b7159904fa7a55857227`), with its BSD 3-Clause licence and a
  provenance note. The build no longer needs network access for it.
- **`requirements.txt` no longer fails to install.** It declared `sklearn >= 0.0`; the
  `sklearn` package on PyPI has raised an error on install since 1 December 2023 and exists
  only to reserve the name, so `pip install -r requirements.txt` — and therefore
  `docker-compose build` — could not complete. It is now `scikit-learn`, which is what the
  code imports. Unused declarations for `firebase` and `pandoc` were removed (neither is
  imported anywhere; the application uses `firebase-admin` and `pypandoc`), and precautionary
  upper bounds were added to the remaining requirements.
- **Traefik's ACME storage is now a git-ignored directory.** The bind mount pointed at
  `/traefik/acme.json` while the resolver stored certificates at `/acme.json`, and no such
  file existed in the repository, so Docker created a directory of that name on first start
  and no certificate state persisted. The resolver now writes to `/letsencrypt/acme.json`,
  backed by `traefik/letsencrypt/`, which is mounted as a directory and excluded from version
  control — Traefik writes an ACME **account private key** into it at runtime, and that must
  never be committed or archived.
- **Removed the `./app:/main` bind mount** from the `web` service. The container's working
  directory is `/app`, so the mount had no effect. A commented-out example now shows how to
  persist `comp_folder` instead, which is the volume a real deployment needs.
- **Firebase is now optional at startup.** `app/services/myFirebase.py` initialised Firebase
  at import time and raised `FileNotFoundError` when the service-account key was absent, so
  the container could not start at all without credentials and sat in a restart loop. It now
  reports the missing configuration and continues with `FIREBASE_AVAILABLE = False`; the
  application serves its pages, and `app/main.py` refuses Firebase-backed endpoints with
  `503 firebase_not_configured` rather than letting them sit in their `@retry` loops.
  `update_container()` skips the search-archive rebuild in that state. `DEMO_MODE=1` forces
  it even when credentials are present, and `FIREBASE_STORAGE_BUCKET` supplies the bucket
  name that `initialize_app()` never set. Nothing in the scoring path was touched.
- **The base image is Python 3.11 rather than 3.10.** The competition ran on 3.10.4, which is
  what the paper reports; `google-api-core` stops supporting 3.10 in new releases from
  4 October 2026, which would eventually make a 3.10 image unbuildable. The README states the
  trade-off and how to rebuild on 3.10.4 if you need the original environment.
- Corrected the README's local URL from `http://127.0.0.1` to `http://127.0.0.1:5001`: the
  Traefik catch-all redirects port 80 to HTTPS, where no router matches on a local host.
- Moved `main.ini` to `deploy/legacy-uwsgi/`. It configures the earlier nginx + uWSGI
  deployment and is not used by the Docker setup; at the repository root it read as the live
  configuration.
- Renamed the empty `app/comp_folder/init.py` to `.gitkeep`, which is what it was for.
- Dropped the obsolete `version:` key from `docker-compose.yml`.
- Replaced the `XXX` redaction placeholders that users could read in the frontend with `***`,
  renamed the navigation link "XXX Website" to "Website", and replaced the `XXX_logo` alt
  text. Element `id` attributes are unchanged. Every contact address in the frontend is the
  `support@your_support_email.com` placeholder.
- **Fixed the leaderboard radar charts, a bug found while building the static demo.** Each
  participant's chart is drawn separately, and `generate_chart()` in
  `app/static/js/read_article.js` passed no scale options, so Chart.js scaled every radar to
  its own data with `beginAtZero` defaulting to false. The four charts ended up with four
  different axis minimums (0.75, 0.70, 0.65 and 0.40), which plotted a weighted MCC of 0.68
  at 12% of the radius while 0.76 on the chart beside it sat at 7%: a lower score drawn
  further from the centre than a higher one. The shapes were not comparable between
  participants and could invert the ranking to the eye.

  A commented-out `scale: {ticks: {beginAtZero: true, max: max_value}}` block shows the
  author had seen it. It could not work, because `max_value` came from
  `Object.keys(...)` — the metric names, not the numbers — so `Math.max` returned `NaN`.
  Changing that to `Object.values(...)` and enabling the block gives every chart a fixed
  0–1 axis, since all the displayed metrics are bounded by 1. Plotted radius now tracks the
  score. The data points were correct throughout; only the axes were wrong.
- Rewrote `README.md`: what has to be supplied before the application will run, how
  submissions were scored and ranked, the deployment status, and known limitations.

### Added

- **A static demo at `app/static/demo/`, served automatically when Firebase is absent.** The
  page routes redirect into it, so `http://127.0.0.1:5001` shows the demo rather than a
  frontend that cannot load anything; supply credentials and the redirect stops. The demo is
  a copy of the platform's own frontend, generated from `app/templates/` and
  `app/static/js/` by `make_site.py` — those are not modified — with the Firebase SDK,
  firebaseui and `myFirebase.js` tags removed and `js/demo-shim.js` inserted in their place.
  The shim provides a `firebase` object that never connects and answers every `$.post` from
  local data, so the copied application JavaScript runs unchanged. jQuery and Bootstrap come
  from the copies already vendored in `bower_components/` rather than a CDN. It shows the HIE
  competition frozen as published, which is the only way to see the interface now that the
  deployment is offline.

  Its leaderboard is neither hardcoded nor scored by a second implementation of the metrics:
  `build_demo.py` passes each submission in `demo/data/` to `calculate_sub_scores()` from
  `app/services/myFirebase.py` — the function the running platform used to score every
  submission — and refuses to build if any value differs from Table 4 of the paper by more
  than the 0.005 the platform's own two-decimal rounding allows. All four rows agree.

  `demo/resources/` carries the files participants could download — `training_set.csv`,
  `validation_set.csv` and the Terms and Conditions — wired to the article's Downloads table.
  The answer key the platform kept server-side is not among them: it was never downloadable.
  Only public-dataset material is included; the hidden validation set is governed by the ANSeR
  data-sharing agreements and reproducing Table 5 would have required it.

  The Terms and Conditions are a redacted re-rendering: the original names a working mailbox
  six times, replaced here with the `support@your_support_email.com` placeholder used
  throughout the repository. A note was appended recording that the clause excluding INFANT
  members from participating was, in practice, applied more narrowly — entrants with access
  to the ANSeR recordings or grades were not eligible to win the prize, verified for the
  prize-winning entry during manual validation rather than for every submission.
  The article's two figures, originally hot-linked to an external image host, are served from
  `demo/imgs/`, so the page needs no network access.
- `CITATION.cff` and `.zenodo.json` so the repository can be archived on Zenodo with a DOI
  and cited alongside the paper, with ORCID identifiers.
- `CHANGELOG.md` (this file).
- `LICENSE` — BSD 3-Clause.

### Removed

- Eight `.DS_Store` files, and a stale markdown draft left in `app/temp/` from 2020.
  `.DS_Store` is now in `.gitignore`.

### Notes

- Upstream `MCC_Weighted v1.0.0` is byte-identical to the copy used to produce the results in
  the paper apart from a removed `print(self.Cm)` debug statement. The metric is unchanged, so
  this release reproduces the published leaderboard values: the vendored copy was checked
  against Table 5 and gives the XGBoost weighted MCC of 0.311 exactly.
- `.gitignore` excludes `*.json` and `*.csv`; exceptions were added for `.zenodo.json`, the
  demo's `leaderboard.json` and the demo's data files. `traefik/letsencrypt/` is ignored
  outright.
- Two pre-existing frontend faults are also known and deliberately left unchanged:
  `app/static/js/myFirebase.js` imports its configuration with `assert { type: 'JSON' }`,
  which current Chrome no longer accepts, and `app/static/js/main.js` is a classic script
  that executes before that deferred module and so calls `firebase.auth()` before the app is
  initialised. The single-page application therefore does not work out of the box; the
  server, the pages and the scoring path do — which is what the static demo works around.
- Two pre-existing bugs in `app/services/myFirebase.py` are known and deliberately left
  unchanged, so that this release remains the code that ran the competition: in
  `calculate_sub_scores()`, `class_num` is assigned only in the numeric branch but tested
  unconditionally, so a competition with string labels fails silently through the bare
  `except`; and at line 1021 `recalculate_leaderscore2` appears without call parentheses and
  is a no-op. Neither is reachable in the competition reported in the paper, whose grades are
  numeric.

## [1.0.0] — 2026-09-12

First tagged release: the platform as it stood at the end of the competition. It does not
build — `requirements.txt` declared `sklearn`, which cannot be installed (see 2.0.0 above) —
and it is superseded. Cite 2.0.0.
