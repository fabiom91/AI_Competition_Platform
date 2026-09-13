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

## Status and disclaimer

> This repository is a minimum viable product written by a single developer to run one
> competition. It works for that purpose, but it has not been hardened, audited or
> maintained as a production service, and correct behaviour outside that use is not
> guaranteed. Anyone deploying it will have to adapt the code to their own infrastructure.
> Treat it as research software.

The platform ran at `infantresearchcommunity.ucc.ie` during and after the competition. That
domain **no longer resolves**, so any link to it will fail. The code is kept here so the
competition can be inspected and, if wanted, re-run elsewhere.

## What you have to supply

Several files are deliberately absent. `.gitignore` excludes `*.json` and `*.csv`, and the
deployment configuration has been sanitised with `XXX` placeholders. The application will
not start, or will fail on the first page that touches data, until you provide:

| What | Where | Notes |
|---|---|---|
| Firebase service-account key | `app/firebase_private_key/firebase-adminsdk.json` | Exact filename; loaded at import time by `app/services/myFirebase.py`. |
| `secrets.csv` | `app/firebase_private_key/secrets.csv` | Read at import time; the module raises on startup if it is missing. |
| Firebase web configuration | `app/static/js/firebase_config.json` | Imported by `app/static/js/myFirebase.js` as a JSON module. |
| Flask secret key | `app/main.py`, `app.secret_key` | Currently the placeholder `b'XXXXXXX'`. Replace it before any deployment. |
| Traefik host rule and ACME e-mail | `docker-compose.yml` | Currently `XXX.com` and `XXX@XXX.com`. |

`firebase_admin.initialize_app(cred)` is called without a `storageBucket` option, so
`storage.bucket()` will need one supplied — either as an option there or as an explicit
bucket name — before Firebase Storage works.

There is no local or file-backed database mode: **Firebase is required**, using
Authentication, Firestore and Storage.

`app/services/myFirebase.py` imports `MCC_Weighted.weighted_metrics`, which lives in a
separate repository: https://github.com/fabiom91/MCC_Weighted. It is not vendored here;
`app/Dockerfile` clones it into `services/MCC_Weighted` while building the image, so
`docker-compose build` picks it up automatically. Running the app outside Docker means
putting it on the import path yourself.

## Usage

The application is meant to be deployed on a remote server, but it is containerised and can
also be run on a local machine with Docker.

1. Clone the repository:
   `git clone https://github.com/fabiom91/AI_Competition_Platform.git`
2. `cd AI_Competition_Platform`
3. Add the files listed under *What you have to supply* above.
4. `docker-compose build && docker-compose up -d`
   (If this fails, check Docker is installed: https://www.docker.com/get-started)
5. Open `http://127.0.0.1` in a browser. Traefik serves the site on ports 80 and 443; the
   Flask container itself listens on 5001.

Without step 3 the containers will start, but registration, login, article and competition
pages will fail.

`docker-compose.yml` also carries a Let's Encrypt resolver and an HTTP-to-HTTPS redirect.
For a local run they are inert; for a new deployment, set the host rule and the ACME e-mail
address.

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
[`MCC_Weighted/weighted_metrics.py`](https://github.com/fabiom91/MCC_Weighted). Note that
`Weighted_metrics._weighted_cm()` prints the confusion matrix on every call, so do not call
it inside a resampling loop.

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
- `app/Dockerfile` — python:3.10.4-bullseye, installs pandoc and `requirements.txt`, clones
  `MCC_Weighted`.
- `traefik/Dockerfile` — Traefik 2.6 with an `acme.json` created at build time.
- `app/wsgi.py` — the WSGI entry point; turns off `DEBUG`.
- `main.ini` — uWSGI configuration (processes, `harakiri` timeout, socket, and a log path of
  `/var/log/uwsgi/main.log`). This is from the earlier, non-containerised deployment behind
  nginx and uWSGI. The Docker setup does not use it; it is kept for anyone deploying that
  way.
- `.gitignore` — excludes `__pycache__`, `*.json`, `*.csv` and `*.zip`. Worth reading before
  a force-pull on a server: nothing listed there is backed up.

### Backend files

- `app/main.py` — the core of the Flask app: routing, page serving and request handling. All
  Firebase interaction is delegated to `app/services/myFirebase.py`.
- `app/services/myFirebase.py` — every Firebase interaction (Authentication, Storage,
  Firestore), submission scoring and leaderboard recalculation.
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
  is reset on every rebuild; on a server deployment it persists. Files here are **not**
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

- **`MCC_Weighted` is cloned at build time from its default branch, unpinned.** Two builds at
  different dates can embed different versions of the scoring metric. Pinning a tag or commit
  would make the leaderboard reproducible from the image alone.
- **Submissions are matched to the ground truth by row order**, not by identifier (see
  *How submissions were scored*).
- **Firebase is required**; there is no local database mode.
- **No automated tests.** The repository history is the only version reference.
- **MVP scope**, and the deployment is offline and no longer maintained.

## Licence

BSD 3-Clause. See [`LICENSE`](LICENSE).

## Citation

If you use this platform, please cite the paper above. If you use the competition data,
please cite the Scientific Data descriptor and the Zenodo record.
