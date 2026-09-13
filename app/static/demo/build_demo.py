#!/usr/bin/env python3
"""Regenerate the static demo.

The demo is a copy of the platform's own frontend serving one frozen competition. This
script produces the two generated pieces:

  * js/demo-data.js — the canned replies the demo shim serves in place of the Flask
    endpoints, including the competition's leaderboard;
  * the copied pages and JavaScript, via make_site.py.

The leaderboard is **not** written by hand and is **not** scored by a reimplementation of
the metrics. Each submission in demo/data/ is passed to `calculate_sub_scores()` from
`app/services/myFirebase.py` — the same function the running platform called to score every
submission — exactly as the file is stored. So the numbers on the demo leaderboard were
computed by the code that computed the real one, including its rounding to two decimals,
which is what the live leaderboard displayed.

Every value is checked against Table 4 of the paper, to within the 0.005 that the platform's
two-decimal rounding allows. The build fails if any has drifted, so the demo cannot quietly
stop matching what was published.

Run from anywhere:

    python app/static/demo/build_demo.py
    docker-compose run --rm web python static/demo/build_demo.py

Only the public dataset is involved. The hidden validation set is governed by the ANSeR
data-sharing agreements and is not in this repository, so the demo reproduces Table 4 and
not Table 5.
"""

import contextlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")
SERVICES = os.path.abspath(os.path.join(HERE, "..", "..", "services"))

# Import the platform's scoring code. DEMO_MODE keeps myFirebase from trying to initialise
# Firebase: calculate_sub_scores touches neither Firestore nor Storage.
os.environ.setdefault("DEMO_MODE", "1")
sys.path.insert(0, SERVICES)
import myFirebase  # noqa: E402

ARTICLE_ID = "1653976153518u6nlid2quyi"
ARTICLE_TITLE = "Classification of Abnormal EEG Background Activity in Newborn Infants"
ARTICLE_AUTHOR = "INFANT Research Centre"
ARTICLE_DATE = "31/05/2022"
ARTICLE_PREVIEW = ("A machine-learning competition to grade the severity of EEG background "
                   "abnormalities in newborns with hypoxic-ischaemic encephalopathy. "
                   "Closed 30 August 2022.")

# The files participants could download, as they are in demo/resources/. Sizes are read from
# the files at build time so the table cannot go stale. The answer key the platform kept
# server-side is deliberately not there; see resources/README.md.
COMP_RESOURCES = [
    ("training_set.csv", "csv", "105 epochs, 31 newborns, graded"),
    ("validation_set.csv", "csv", "64 epochs, 22 newborns, grades blank"),
    ("Terms_And_Conditions_-_Infant_Competition.pdf", "pdf", "redacted copy"),
]

# method -> submission file, under demo/data/
SUBMISSIONS = {
    "XGBoost with qEEG features": "submissions/XGBoost/public_6.csv",
    "CNN": "submissions/CNN/my_submission.csv",
    "ConvNeXt": "submissions/ConvNeXt/preds_public.csv",
    "SVM with qEEG features": "submissions/SVM/public_ResultsWithID.csv",
}

# Table 4 of the paper, at three decimals: MCC (weighted), accuracy, F1, precision, recall.
PUBLISHED = {
    "XGBoost with qEEG features": (0.761, 0.891, 0.843, 0.873, 0.825),
    "CNN": (0.713, 0.859, 0.768, 0.767, 0.813),
    "ConvNeXt": (0.677, 0.859, 0.807, 0.862, 0.775),
    "SVM with qEEG features": (0.437, 0.750, 0.568, 0.821, 0.557),
}

# The platform rounds every displayed metric to two decimals, so this is the most agreement
# that is available between it and the paper's three-decimal table.
TOLERANCE = 0.0051
METRIC_KEYS = ("MCC", "Accuracy", "F1-Measure", "Precision", "Recall")


def comp_files():
    out = []
    for name, fmt, dims in COMP_RESOURCES:
        path = os.path.join(HERE, "resources", name)
        size = "-"
        if os.path.exists(path):
            n = os.path.getsize(path)
            size = "%.1f kB" % (n / 1000.0) if n < 1_000_000 else "%.1f MB" % (n / 1e6)
        out.append({"name": name, "format": fmt, "size": size, "dimensions": dims})
    return out


# --------------------------------------------------------------------------- leaderboard

def load_truth():
    return pd.read_csv(os.path.join(DATA, "public_test_set_labels.csv"))[["ID", "class"]]


@contextlib.contextmanager
def platform_workspace(truth):
    """A directory laid out the way calculate_sub_scores expects to find things.

    The function reads comp_folder/<aid>/private/validation_set_private.csv relative to the
    working directory, which on the server was the application root.
    """
    tmp = tempfile.mkdtemp(prefix="demo_scoring_")
    private = os.path.join(tmp, "comp_folder", ARTICLE_ID, "private")
    os.makedirs(private)
    truth.to_csv(os.path.join(private, "validation_set_private.csv"), index=False)
    cwd = os.getcwd()
    try:
        os.chdir(tmp)
        yield tmp
    finally:
        os.chdir(cwd)
        shutil.rmtree(tmp, ignore_errors=True)


def build_leaderboard():
    truth = load_truth()
    rows, problems = [], []

    with platform_workspace(truth):
        for method, path in SUBMISSIONS.items():
            sub_path = os.path.join(DATA, path)
            scores = myFirebase.calculate_sub_scores(sub_path, ARTICLE_ID, "classification")
            if not scores or "Error" in scores:
                raise SystemExit("%s: the platform refused the submission (%s)"
                                 % (method, scores))

            for key, published in zip(METRIC_KEYS, PUBLISHED[method]):
                if abs(scores[key] - published) > TOLERANCE:
                    problems.append("%s %s: platform %.3f, published %.3f"
                                    % (method, key, scores[key], published))

            rows.append({"method": method, "submission_file": path, "scores": scores})
            print("%-28s " % method
                  + "  ".join("%s %.2f" % (k, scores[k]) for k in METRIC_KEYS))

    if problems:
        raise SystemExit("The platform's scores differ from the published Table 4:\n  "
                         + "\n  ".join(problems))

    rows.sort(key=lambda r: r["scores"]["MCC"], reverse=True)
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    print("\nAll four rows match Table 4 to within the platform's two-decimal rounding.")
    return rows


# --------------------------------------------------------------------------------- data

def markdown_to_html(text):
    # pandoc with its default markdown reader, which is what the platform used
    # (pypandoc.convert_text(..., 'html', format='md') in myFirebase.py), so the article
    # renders here exactly as it did on the live site — including its quirks.
    if shutil.which("pandoc"):
        return subprocess.run(["pandoc", "-f", "markdown", "-t", "html"],
                              input=text, capture_output=True, text=True,
                              check=True).stdout
    import markdown
    return markdown.markdown(text, extensions=["extra"])


def localise_images(page_html):
    """Point <img> at imgs/<name> for any remote image saved into demo/imgs/.

    The article's two figures were hot-linked to an external image host. Save them as
    demo/imgs/<original filename>, re-run this script, and the page stops depending on that
    host; leave them out and the remote URLs are kept.
    """
    imgs_dir = os.path.join(HERE, "imgs")
    if not os.path.isdir(imgs_dir):
        return page_html, []
    localised = []
    for match in sorted(set(re.findall(r'src="(https?://[^"]+)"', page_html))):
        name = os.path.basename(match.split("?")[0])
        if name and os.path.exists(os.path.join(imgs_dir, name)):
            page_html = page_html.replace('src="%s"' % match, 'src="imgs/%s"' % name)
            localised.append(name)
    return page_html, localised


def build_demo_data(rows, article_html):
    """Write js/demo-data.js: the canned replies the shim answers $.post with.

    The shapes match what the Flask endpoints returned, so the copied frontend needs no
    changes. Participants are identified by their method rather than by name: the demo has
    no reason to publish anyone's profile.
    """
    submissions, sub_profiles = [], {}
    for r in rows:
        key = r["method"]
        sub_profiles[key] = {"profile": {"img": "../imgs/noAvatar.png",
                                         "name": r["method"], "surname": ""}}
        submissions.append({
            "submission_%d" % r["rank"]: {
                "author": key,
                # The live leaderboard ranked on a weighted sum of the displayed measures,
                # with the weights held in Firestore per competition. This competition
                # ranked on the weighted MCC, so that is what orders the demo.
                "weighted_score": int(round(r["scores"]["MCC"] * 1000)),
                "scores": r["scores"],
                "code_link": "",
            }
        })

    data = {
        "articles": [{
            "articleID": ARTICLE_ID, "title": ARTICLE_TITLE,
            "text": ARTICLE_PREVIEW, "author": ARTICLE_AUTHOR,
            "authorImg": "../imgs/noAvatar.png",
            "date": ARTICLE_DATE, "time": "12:00:00", "timestamp": ARTICLE_ID,
            "competition": True, "competition_closed": True, "pending": False,
        }],
        "full_article": {
            "main": {
                "articleID": ARTICLE_ID, "authorID": "infant", "title": ARTICLE_TITLE,
                "full_text": article_html, "date": ARTICLE_DATE,
                "competition": True, "competition_closed": True, "pending": False,
            },
            "comp_files": comp_files(),
            "submissions": submissions,
            "sub_profiles": sub_profiles,
            "comments": [], "com_profiles": {},
        },
        "author": {"authorID": "infant", "full_name": ARTICLE_AUTHOR,
                   "qualifications": "INFANT Research Centre, University College Cork",
                   "email": "", "phone": "", "img": "../imgs/noAvatar.png"},
        "resources": {}, "article_download": [""], "search_archive": [],
    }

    dest = os.path.join(HERE, "js", "demo-data.js")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write("/* Generated by build_demo.py. Do not edit by hand.\n"
                 " * Canned replies for the demo shim, in the shapes the Flask endpoints\n"
                 " * returned. The scores were produced by calculate_sub_scores() in\n"
                 " * app/services/myFirebase.py — the platform's own scoring function.\n"
                 " * Nothing here is fetched at runtime. */\n")
        fh.write("window.DEMO_DATA = ")
        json.dump(data, fh, indent=2)
        fh.write(";\n")
    print("Written %s" % dest)


def main():
    rows = build_leaderboard()

    with open(os.path.join(HERE, "article.md"), encoding="utf-8") as fh:
        article_html = markdown_to_html(fh.read())
    article_html, localised = localise_images(article_html)
    if localised:
        print("Images served locally: %s" % ", ".join(localised))
    else:
        print("No local copies in imgs/: the article's figures stay hot-linked to their "
              "original host and will not render offline.")

    print("\nCopying the frontend:")
    import make_site
    for name in make_site.build():
        print("  wrote", name)
    problems = make_site.check_no_firebase()
    if problems:
        raise SystemExit("Firebase was not fully removed from the demo copy:\n  "
                         + "\n  ".join(problems))
    print("  checked: no page references the Firebase SDK, firebaseui or myFirebase.js")

    build_demo_data(rows, article_html)


if __name__ == "__main__":
    main()
