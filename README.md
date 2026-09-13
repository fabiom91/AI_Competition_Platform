# INFANT — AI Competition Platform

A **social network** and **machine-learning competition platform** for clinicians and
researchers in paediatrics and neonatology, built at the
[INFANT Research Centre](https://www.infantcentre.ie/), University College Cork, as part of
its Open Science work.

The platform was used to run a competition to grade the severity of EEG background
abnormalities in newborns with hypoxic-ischaemic encephalopathy (HIE). That competition is
described in:

> Magarelli F, Boylan GB, Montazeri S, O'Sullivan F, Lightbody D, Ashoori M, Skoric T,
> O'Toole JM. *Machine-learning competition to grade EEG background patterns in newborns
> with hypoxic-ischaemic encephalopathy.* PLOS Digital Health (under review).

The competition dataset is published separately and is **not** in this repository:

> O'Toole JM et al. *Neonatal EEG graded for severity of background abnormalities in
> hypoxic-ischaemic encephalopathy.* Scientific Data 10, 129 (2023).
> https://doi.org/10.1038/s41597-023-02002-8 — data on Zenodo, CC-BY.

## Version and archive

The archival release is **v2.0.0**. Cite or clone that tag rather than the default branch:

```bash
git clone --branch v2.0.0 https://github.com/fabiom91/AI_Competition_Platform.git
```

It is deposited on Zenodo with a DOI — see `CITATION.cff` for how to cite it, and
`CHANGELOG.md` for what changed since v1.0.0, which does not build and should not be used.

The release is **self-contained**: the weighted MCC used to rank the leaderboards is vendored
into the repository at
[`app/services/MCC_Weighted/`](app/services/MCC_Weighted/), from upstream tag `v1.0.0`
(commit `ed55752`) of https://github.com/fabiom91/MCC_Weighted, under its own BSD 3-Clause
licence. Earlier builds cloned that repository while building the Docker image; they no
longer do, so the scoring metric travels with the code, needs no network access at build
time, and cannot change between two builds of the same source.

## Status and disclaimer

> This repository is a minimum viable product written by a single developer to run one
> competition. It works for that purpose, but it has not been hardened, audited or
> maintained as a production service, and correct behaviour outside that use is not
> guaranteed. Anyone deploying it will have to adapt the code to their own infrastructure.
> Treat it as research software.

The platform ran at `infantresearchcommunity.ucc.ie` during and after the competition. That
domain **no longer resolves**, so any link to it will fail. The code is kept here so the
competition can be inspected and, if wanted, re-run elsewhere.

## Python version

The competition was run on **Python 3.10.4**, and that is the version the paper reports. This
release pins **3.11** instead. The reason is dependency lifetime rather than anything about
the code: `google-api-core`, which `firebase-admin` depends on, stops supporting Python 3.10
in new releases from **4 October 2026**, so a 3.10 image would sooner or later stop building
and the archive would rot.

The trade-off is worth stating plainly. Nothing in the scoring path is version-sensitive —
the weighted MCC is vendored, and it is arithmetic on a confusion matrix — but the code has
not been re-validated end to end on 3.11, and library behaviour can drift between versions.
If you are reproducing the published leaderboard values exactly, either check them against
the vendored metric directly (see *Reproducing a leaderboard score*) or change the
`FROM` line in `app/Dockerfile` to a Python 3.10 image; 3.10.4 is the patch release that
actually ran.

## What you have to supply

Several files are deliberately absent. `.gitignore` excludes `*.json` and `*.csv`, and the
deployment configuration has been sanitised with `XXX` placeholders.

**The application starts without any of them.** With no credentials present it serves its
pages and refuses every Firebase-backed request with `503 firebase_not_configured` — enough
to look around the interface, not enough to use it. See *Running without Firebase* below. For
a working instance you need:

| What | Where | Notes |
|---|---|---|
| Firebase service-account key | `app/firebase_private_key/firebase-adminsdk.json` | Exact filename; loaded at import time by `app/services/myFirebase.py`. |
| `secrets.csv` | `app/firebase_private_key/secrets.csv` | Read at import time; the module raises on startup if it is missing. |
| Firebase web configuration | `app/static/js/firebase_config.json` | Imported by `app/static/js/myFirebase.js` as a JSON module. |
| Flask secret key | `app/main.py`, `app.secret_key` | Currently the placeholder `b'XXXXXXX'`. Replace it before any deployment. |
| Traefik host rule and ACME e-mail | `docker-compose.yml` | Currently `XXX.com` and `XXX@XXX.com`. |

Firebase Storage additionally needs a bucket name. Set the environment variable
`FIREBASE_STORAGE_BUCKET` (for example `my-project.appspot.com`); `docker-compose.yml` has a
commented-out line for it. Without it, `storage.bucket()` raises and the application falls
back to serving pages only, saying so in the container log.

There is no local or file-backed database mode: for anything beyond the pages themselves,
**Firebase is required**, using Authentication, Firestore and Storage.

### Running without Firebase

`docker-compose build && docker-compose up` works with an empty `app/firebase_private_key/`.
The application logs why it is degraded and carries on:

```
[platform] firebase_private_key/firebase-adminsdk.json not found: starting without Firebase.
Pages are served; login, articles, competitions and submissions are disabled.
```

In this state every page route renders and every Firebase-backed endpoint returns `503` with
`{"error": "firebase_not_configured"}` immediately, rather than sitting in a ten-second retry
loop. Set `DEMO_MODE=1` to force the same state even when credentials are present.

**In this state the site serves a static demo instead.** Visit `http://127.0.0.1:5001` and
the page routes redirect into [`app/static/demo/`](app/static/demo/README.md): a copy of this
frontend, generated from the same templates and JavaScript, with the Firebase SDK and the
server calls replaced by a local shim. It shows the HIE competition frozen as it was
published — the article, and the public leaderboard underneath it. Sign-in, submission and
commenting do nothing, because there is nothing behind them.

The leaderboard there is not typed in, and it is not scored by a second implementation of the
metrics. `app/static/demo/build_demo.py` passes each of the four submission files in
`app/static/demo/data/` to `calculate_sub_scores()` from `app/services/myFirebase.py` — the
function the running platform used to score every submission — and fails the build if any
value differs from Table 4 of the paper by more than the 0.005 the platform's own
two-decimal rounding allows.

Supply credentials and the redirect stops: the real frontend is served again, and the demo
remains at `/static/demo/index.html`.

Note that the **real** frontend does not work out of the box even with credentials, for two
reasons that predate this release — see *Known limitations*. That is what the demo exists to
work around.

The scoring metric is **not** something you have to supply: `app/services/myFirebase.py`
imports `MCC_Weighted.weighted_metrics`, and that module is in the repository at
`app/services/MCC_Weighted/`. Nothing is fetched at build time. See
[`app/services/MCC_Weighted/README.md`](app/services/MCC_Weighted/README.md) for its
provenance and for how to re-vendor it if upstream changes.

## Usage

The application is meant to be deployed on a remote server, but it is containerised and can
also be run on a local machine with Docker.

1. Clone the repository at the tagged release:
   `git clone --branch v2.0.0 https://github.com/fabiom91/AI_Competition_Platform.git`
2. `cd AI_Competition_Platform`
3. Optionally add the files listed under *What you have to supply* above. Skip this to start
   in the pages-only state described under *Running without Firebase*.
4. `docker-compose build && docker-compose up -d`
   (If this fails, check Docker is installed: https://www.docker.com/get-started)
5. Open **`http://127.0.0.1:5001`** in a browser.

Use `:5001` locally, not port 80. Traefik redirects all port-80 traffic to HTTPS and its
`web` router only matches the host set in `docker-compose.yml`, so on a local machine port 80
gives a certificate warning and then a 404. Port 5001 is published straight from the Flask
container and bypasses Traefik, which only becomes useful once you set a real host rule.

`docker-compose.yml` also carries a Let's Encrypt resolver and an HTTP-to-HTTPS redirect.
For a local run they are inert; for a new deployment, set the host rule and the ACME e-mail
address.

Traefik stores its ACME state in `traefik/letsencrypt/`, which is mounted as a directory and
is git-ignored. It writes an **account private key** into `acme.json` there the first time it
runs. That file must never be committed or included in an archive.

Note that competition files and submissions are written to `comp_folder` inside the
container, which is rebuilt with the image, so **they do not survive `docker-compose build`**.
`docker-compose.yml` carries a commented-out volume showing how to persist them; a real
deployment needs it.

## How submissions were scored

Participants uploaded a CSV of predicted grades for the unlabelled test epochs. For each
submission the platform computed a set of metrics and displayed them on the leaderboard. For
a multi-class competition these are accuracy, F1, precision and recall (all macro-averaged)
and a column labelled *MCC*; for a binary one, AUC is added and the averaging is dropped.
All displayed values are rounded to two decimals. The regression path reports MAE, MSE, RMSE
and R².

In the multi-class case the *MCC* column is not the ordinary Matthews correlation
coefficient but a **weighted MCC**, which multiplies the confusion matrix **C** elementwise
(Hadamard product) by a weight matrix **W** and then applies the standard multi-class MCC
formula to the result:

```
        predicted
         1  2  3  4
    1 [  1  1  2  3 ]
t   2 [  1  1  1  2 ]
r   3 [  2  1  1  1 ]
u   4 [  3  2  1  1 ]
e
```

W is 1 on the diagonal **and** on the adjacent off-diagonals, 2 for an error of two grades
and 3 for an error of three. Errors of one grade are therefore left at face value and are
penalised exactly as an unweighted MCC would penalise them; only larger errors are amplified.
A consequence worth knowing: when no prediction is off by more than one grade, the weighted
MCC equals the unweighted MCC exactly.

The implementation is in
[`app/services/MCC_Weighted/weighted_metrics.py`](app/services/MCC_Weighted/weighted_metrics.py),
vendored from upstream tag `v1.0.0`. Earlier copies of that file printed the confusion matrix
on every construction; `v1.0.0` does not, so it is safe to call inside a resampling loop.

Ranking is separate from display. Each competition stores a `weighted_evas` dictionary — a
weight per evaluation measure, chosen when the competition is created — and a submission's
leaderboard score is the weighted sum of its metrics (error measures entering with a
negative sign), scaled by 1000. A user's best submission determines their position. For the
HIE competition the ranking followed the weighted MCC; participants were not told which of
the displayed metrics determined their rank.

Two implementation details that matter if you re-run anything:

- **Submissions are aligned by row order, not by ID.** `calculate_sub_scores()` concatenates
  the submission's prediction column with the private validation set's `class` column
  positionally, so a submission sorted differently from the validation file will be scored
  against the wrong rows.
- **There is a limit of five submissions per user per day.**

The scoring entry points are `calculate_sub_scores()` and `submit_comp_results()` in
`app/services/myFirebase.py`. The live leaderboard rounded to two decimals; the values
published in the paper were recomputed offline at three decimals.

### Reproducing a leaderboard score

You do not need the platform to check a score. With the public dataset from Zenodo and a
submission file:

```python
import pandas as pd
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
# from the repository root: sys.path.insert(0, "app/services")
from MCC_Weighted.weighted_metrics import Weighted_metrics

truth = pd.read_csv("validation_set_private.csv")     # columns: class, file_ID, ID
sub   = pd.read_csv("my_submission.csv")              # columns: ID, preds

df = truth.merge(sub, on="ID")
y_true = df["class"].round().astype(int).tolist()
y_pred = df["preds"].round().astype(int).tolist()
if 0 in y_pred:                       # some submissions used 0-based grades
    y_pred = [p + 1 for p in y_pred]

print("Accuracy ", accuracy_score(y_true, y_pred))
print("F1       ", f1_score(y_true, y_pred, average="macro"))
print("Precision", precision_score(y_true, y_pred, average="macro"))
print("Recall   ", recall_score(y_true, y_pred, average="macro"))
print("wMCC     ", Weighted_metrics(y_true, y_pred).weighted_matthews_corcoef())
```

All four grades must be present in the data, otherwise the 4×4 weight matrix is not
conformable with the confusion matrix and the multiplication fails.

## Web app structure

A Flask application in a Docker container, served by gunicorn behind Traefik, with Firebase
(Authentication, Firestore, Storage) as the backend store. The frontend is HTML5, CSS3 and
JavaScript with Bootstrap/MDBootstrap, AJAX and jQuery.

### Deployment files

- `docker-compose.yml` — the two services, `traefik` and `web`, TLS and routing labels. The
  `web` service runs `update_container()` from `myFirebase.py` and then
  `gunicorn --config gunicorn_config.py wsgi:app`.
- `app/gunicorn_config.py` — bind address, 4 workers × 4 threads, 120 s timeout, log level
  `critical`.
- `app/Dockerfile` — python:3.11-slim, installs pandoc and `requirements.txt`.
- `traefik/Dockerfile`, `traefik/letsencrypt/` — Traefik 2.6 and the mounted directory where
  it keeps its Let's Encrypt state. Git-ignored: it holds an account private key at runtime.
- `app/wsgi.py` — the WSGI entry point; turns off `DEBUG`.
- `deploy/legacy-uwsgi/main.ini` — uWSGI configuration (processes, `harakiri` timeout, socket,
  and a log path of `/var/log/uwsgi/main.log`) from the earlier, non-containerised deployment
  behind nginx and uWSGI. The Docker setup does not use it; it is kept for anyone deploying
  that way, and note it expects to sit beside `wsgi.py`.
- `.gitignore` — excludes `__pycache__`, `.DS_Store`, `*.json`, `*.csv` and `*.zip`, with
  exceptions for `.zenodo.json` and the static demo's own data files. `traefik/letsencrypt/`
  is ignored outright, because Traefik writes an account private key into it. Worth reading
  before a force-pull on a server: nothing ignored is backed up.
- `CITATION.cff`, `.zenodo.json`, `CHANGELOG.md` — citation and archival metadata.

### Backend files

- `app/main.py` — the core of the Flask app: routing, page serving and request handling. All
  Firebase interaction is delegated to `app/services/myFirebase.py`.
- `app/services/myFirebase.py` — every Firebase interaction (Authentication, Storage,
  Firestore), submission scoring and leaderboard recalculation.
- `app/services/MCC_Weighted/` — the vendored weighted MCC, with its own licence and
  provenance note.
- `app/firebase_private_key/` — the service-account key and `secrets.csv`. **Not committed**;
  supply your own.

### Frontend files

Templates are in `app/templates/` (`main`, `dashboard`, `create_article`, `read_article`,
`profile_view`, `admin`, `about`, `landing`, `verify_email`); JavaScript, CSS and images in
`app/static/` (`js`, `styles`, `imgs`).

The frontend is a single-page application with two elements: a top navigation bar and a
frame into which the other pages are loaded dynamically with JavaScript and jQuery. The main
page (`main.html`, `main.js`) stays loaded, serves the other pages into the frame, handles
login and registration, and watches for changes in authentication state. E-mail verification
and an MFA validation step have their own routes.

- **Dashboard** — all approved articles and competitions, newest first, as preview cards.
  Uses pandoc to render markdown articles as HTML.
- **Create_article** — a markdown editor (see *Other files*) that lets a user write an
  article without knowing markdown, an attachment uploader, and the **Make Competition**
  dialogue.
- **About** — FAQs on using the platform.
- **Profile_view** — a user's public profile, and the landing page after registration where
  the mandatory first and last name are completed.
- **Read_article** — renders the selected article. Where the article hosts a competition,
  this is also where a user joins it and submits results.
- **Admin** — lists all articles (including pending) and all registered users. From here an
  admin or moderator can approve an article, delete one (unless it is a competition with at
  least one submission), edit an article, edit or remove a comment, ban and unban users, and
  promote a user to moderator. Full administration is done from the Firebase Console.

### Other files

- `app/search_archive/archive.csv` — rebuilt whenever an article or user is created or
  modified and when the server starts. Holds basic information about users, articles and
  competitions to feed the dashboard search bar. Not committed (`*.csv` is ignored).
- `app/static/bower_components/…` — third-party markdown editor and interpreter:
  https://github.com/kartik-v/krajee-markdown-editor
- `app/temp/…` — staging area for files on their way to Firebase Storage, so the user does
  not wait for the upload; each file is removed once the upload succeeds.
- `app/comp_folder/` — per-competition files and every user submission. In the container this
  is reset on every rebuild unless you add the volume described under *Usage*; on the old
  server deployment it persisted. Files here are **not**
  deleted automatically when a competition is deleted and may still be referenced from the
  database, so check before removing anything. To delete a competition, remove the article
  hosting it from Firestore and Firebase Storage first, then delete the competition folder.

## Logs

With the Docker setup, gunicorn runs at log level `critical` and its output goes to the
container log: `docker logs --follow <container name or id>`. On the older uWSGI deployment,
backend activity and errors were written to `/var/log/uwsgi/main.log`, with nginx logs in
`/var/log/nginx/`.

## Known limitations

Recorded so that anyone re-running the platform knows what to expect.

- **Python dependencies are ranges, not pins.** `app/requirements.txt` gives a floor and a
  precautionary major-version cap for each library, so two builds can still resolve different
  versions within a range. The scoring metric is vendored and therefore fixed; the libraries
  around it are not. For an exactly reproducible environment, `pip freeze` inside a working
  build and commit the result.
- **The image is built on Python 3.11, but the competition ran on 3.10.4** (see *Python
  version*). The code has not been re-validated end to end on 3.11.
- **The frontend single-page application does not work out of the box.** Two faults predate
  this release: `app/static/js/myFirebase.js` imports its configuration with
  `assert { type: 'JSON' }`, a syntax current Chrome no longer accepts, and `main.js` is a
  classic script that runs before that deferred module, so it calls `firebase.auth()` before
  the app is initialised. Both are left as they are, so this release remains the code that
  ran the competition; a redeployment would need to fix them.
- **Submissions are matched to the ground truth by row order**, not by identifier (see
  *How submissions were scored*).
- **Firebase is required**; there is no local database mode.
- **No automated tests.**
- **MVP scope**, and the deployment is offline and no longer maintained.

## Licence

BSD 3-Clause. See [`LICENSE`](LICENSE).

## Citation

If you use this platform, please cite the paper above and the software release you used —
`CITATION.cff` gives both, and GitHub's *Cite this repository* button will format either. If
you use the competition data, please cite the Scientific Data descriptor and its Zenodo
record.
