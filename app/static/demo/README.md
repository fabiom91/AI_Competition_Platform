# Static demo

A copy of the platform's own frontend, serving one frozen competition. The production
templates and JavaScript under `app/templates/` and `app/static/js/` are **not modified**:
they are copied here by `make_site.py`, which removes the Firebase SDK, firebaseui and
`myFirebase.js` script tags and inserts `js/demo-shim.js` in their place. The shim supplies a
`firebase` object that is never connected and answers every `$.post` from local data, which
is what lets the copied `main.js`, `dashboard.js` and `read_article.js` run unchanged. The
build refuses to finish if any copied page still references Firebase.

So the demo runs the platform's real frontend code, with the two things that reach outside —
Firebase and the Flask/Firestore endpoints — replaced. Sign-in, submission, commenting and
voting do nothing, because there is nothing behind them.

It exists for two reasons. The platform cannot be run without a Firebase project of your own,
so without this there is no way to see what it looked like; and the leaderboard numbers in the
paper are otherwise only assertions, whereas here they are recomputed in front of you from
the submissions.

## Viewing it

Start the platform with no credentials (`docker compose build && docker compose up`) and open
**`http://127.0.0.1:5001`**. With Firebase absent the server redirects its page routes here
automatically, so the demo *is* the site — `/`, `/dashboard.html`, `/about.html` and
`/read_article.html` all land in `/static/demo/`. The direct URL
`http://127.0.0.1:5001/static/demo/index.html` works too, and opening `index.html` from disk
works in most browsers, though some block iframe navigation between local files.

Supply credentials and the redirect stops: the real frontend is served again and the demo
stays available at its own URL.

## What is here

| | |
|---|---|
| `index.html` | The shell (copy of `main.html`). **Generated — do not edit by hand.** |
| `dashboard.html`, `read_article.html`, `about.html` | Copies of the matching templates. Generated. |
| `js/main.js`, `js/dashboard.js`, `js/read_article.js` | The platform's own frontend code, copied. Only asset paths differ. |
| `js/demo-shim.js` | Firebase stand-in and the offline `$.post`. Hand-written; the only new frontend code. |
| `js/demo-data.js` | The canned replies the shim serves, leaderboard included. Generated. |
| `article.md` | The competition article, as published on the platform. |
| `data/` | Ground truth and the four submissions. See `data/README.md`. |
| `resources/` | The files participants could download, wired to the Downloads table. See `resources/README.md`. |
| `build_demo.py`, `make_site.py` | Regenerate everything above. |
| `imgs/` | Local copies of the article's two figures. |

jQuery and Bootstrap are loaded from the copies already vendored in
`app/static/bower_components/`, rather than from a CDN, so the demo does not depend on those
staying up. Font Awesome, Google Fonts, jQuery UI and bootbox are still remote; they are
cosmetic or unused here, and the shim stubs the two that are actually called so a blocked CDN
degrades the look rather than stopping the page.

## Regenerating

```bash
docker-compose run --rm web python static/demo/build_demo.py   # easiest: the image has everything
python app/static/demo/build_demo.py                           # or locally, see below
```

Running it locally needs the application's own dependencies, not just the scientific stack:
the script imports `app/services/myFirebase.py` to score with it, which pulls in
`firebase-admin`, `pypandoc` and `retrying` alongside pandas, numpy and scikit-learn. It sets
`DEMO_MODE=1` first, so no Firebase credentials are needed. pandoc renders the article.

The leaderboard is not written by hand and is not scored by a copy of the metrics. The build
passes each submission file in `data/` to **`calculate_sub_scores()` from
`app/services/myFirebase.py`** — the same function the running platform called to score every
submission — exactly as the file is stored. The scores on the demo leaderboard were therefore
produced by the code that produced the real one, two-decimal rounding included, which is what
the live leaderboard displayed.

Every value is checked against Table 4 of the paper, to within the 0.005 the platform's own
rounding allows, and the build **fails** if any has drifted. All four rows currently agree.

Markdown is rendered with pandoc, which is what the platform used
(`pypandoc.convert_text(..., 'html', format='md')`), so the article renders here as it did on
the live site.

## What was changed from the published article

`article.md` is the article as served by the platform, with the contact address replaced with the `support@your_support_email.com` placeholder used elsewhere in this repository, so no working mailbox is published here.
