#!/usr/bin/env python3
"""Generate the demo's copy of the frontend from the live templates and JavaScript.

Called by build_demo.py. The production frontend under app/templates/ and app/static/js/ is
never modified — it is copied here and three classes of change are applied, all of them
mechanical and listed below so the copy can be audited against its source:

  1. Jinja blocks are removed. The originals are Flask templates; these are plain files.
  2. Asset paths and the two download-link builders are rewritten. The originals are served from "/" and reference
     "../static/x"; the copies are served from "/static/demo/" and reference "../x".
     Application JavaScript is repointed at the copies in demo/js/.
  3. The Firebase SDK, firebaseui and myFirebase.js script tags are removed, and
     demo-shim.js + demo-data.js are inserted in their place. The shim supplies a Firebase
     object that is never connected and answers every $.post from local data, which is what
     lets the copied application JavaScript run without modification.

The application JavaScript itself is copied byte-for-byte apart from the asset-path rewrite
in rule 2, so what runs in the demo is the platform's own frontend code.
"""

import os
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.abspath(os.path.join(HERE, "..", ".."))
TEMPLATES = os.path.join(APP, "templates")
JS_SRC = os.path.join(APP, "static", "js")

PAGES = ["main.html", "dashboard.html", "read_article.html", "about.html"]
SCRIPTS = ["main.js", "dashboard.js", "read_article.js"]

# Script/link tags dropped from the copied pages: the Firebase SDK, firebaseui, and the
# module that initialises Firebase from a config file that is not in this repository.
DROP_TAG_MARKERS = (
    "gstatic.com/firebasejs",
    "cdn.firebase.com/libs/firebaseui",
    "js/myFirebase.js",
)

# Libraries the repository already vendors, so the demo does not depend on a CDN staying up.
# (bootstrap.bundle includes popper, so the separate popper tag is dropped.)
LOCAL_LIBS = {
    "https://ajax.googleapis.com/ajax/libs/jquery/3.4.1/jquery.min.js":
        "../bower_components/jquery/dist/jquery.min.js",
    "https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/js/bootstrap.min.js":
        "../bower_components/bootstrap/dist/js/bootstrap.bundle.min.js",
    "https://stackpath.bootstrapcdn.com/bootstrap/4.4.1/css/bootstrap.min.css":
        "../bower_components/bootstrap/dist/css/bootstrap.min.css",
}
DROP_LIB_MARKERS = ("popper.js@1.16.0",)

SHIM_TAGS = (
    '    <!-- Static demo: Firebase and the server are replaced by these two files. -->\n'
    '    <script src="js/demo-shim.js" charset="utf-8"></script>\n'
    '    <script src="js/demo-data.js" charset="utf-8"></script>\n'
)


def strip_jinja(text):
    text = re.sub(r"\{%\s*with\b.*?\{%\s*endwith\s*%\}", "", text, flags=re.S)
    text = re.sub(r"\{%.*?%\}", "", text, flags=re.S)
    text = re.sub(r"\{\{.*?\}\}", "", text, flags=re.S)
    return text


def drop_tags(text):
    kept = [ln for ln in text.splitlines(keepends=True)
            if not any(marker in ln
                       for marker in DROP_TAG_MARKERS + DROP_LIB_MARKERS)]
    return "".join(kept)


def use_vendored_libs(text):
    for remote, local in LOCAL_LIBS.items():
        text = text.replace(remote, local)
    # Integrity hashes belong to the CDN copies and would now reject the local files.
    text = re.sub(r'\s+integrity="[^"]*"', "", text)
    text = re.sub(r'\s+crossorigin="anonymous"(?=[^>]*bower_components)', "", text)
    return text


def rewrite_paths(text):
    # Application scripts come from the demo's own copies…
    for name in SCRIPTS:
        text = text.replace("../static/js/%s" % name, "js/%s" % name)
    # …everything else (styles, images, bower_components) from the real static tree, which
    # is one level up from demo/.
    text = text.replace("../static/", "../")
    text = text.replace('src="static/', 'src="../')
    text = text.replace("src='static/", "src='../")
    return text


def insert_shim(text):
    # Before the first application script, so firebase and $.post are already replaced.
    anchor = '<script src="js/main.js"'
    if anchor in text:
        return text.replace(anchor, SHIM_TAGS + "    " + anchor, 1)
    for name in SCRIPTS[1:]:
        anchor = '<script src="js/%s"' % name
        if anchor in text:
            return text.replace(anchor, SHIM_TAGS + "    " + anchor, 1)
    return text.replace("</head>", SHIM_TAGS + "  </head>", 1)


def build():
    js_dir = os.path.join(HERE, "js")
    os.makedirs(js_dir, exist_ok=True)

    written = []
    for page in PAGES:
        src = os.path.join(TEMPLATES, page)
        if not os.path.exists(src):
            continue
        with open(src, encoding="utf-8") as fh:
            text = fh.read()
        text = insert_shim(rewrite_paths(use_vendored_libs(drop_tags(strip_jinja(text)))))
        # main.html is the shell the whole thing is loaded into.
        dest_name = "index.html" if page == "main.html" else page
        dest = os.path.join(HERE, dest_name)
        with open(dest, "w", encoding="utf-8") as fh:
            fh.write(text)
        written.append(dest_name)

    for script in SCRIPTS:
        src = os.path.join(JS_SRC, script)
        if not os.path.exists(src):
            continue
        with open(src, encoding="utf-8") as fh:
            text = fh.read()
        # Asset paths: read_article.js builds an iframe srcdoc referencing ../static/styles/…,
        # which resolves against the demo page's own URL.
        text = text.replace("../static/", "../")
        # Download links: the originals point at the Flask routes that stream a competition's
        # files out of comp_folder. In the demo the same files sit in resources/, so the two
        # href builders are repointed there. Nothing else in the file changes.
        text = text.replace('/download_file/"+AID+"/"+name', 'resources/"+name')
        text = text.replace("'/download_all_files/'+AID", "'resources/comp_resources.zip'")
        with open(os.path.join(js_dir, script), "w", encoding="utf-8") as fh:
            fh.write(text)
        written.append("js/" + script)

    return written


def check_no_firebase():
    """Fail loudly if a copied page still pulls Firebase from the network."""
    offenders = []
    for name in os.listdir(HERE):
        if not name.endswith(".html"):
            continue
        with open(os.path.join(HERE, name), encoding="utf-8") as fh:
            text = fh.read()
        for marker in DROP_TAG_MARKERS:
            if marker in text:
                offenders.append("%s still references %s" % (name, marker))
    return offenders


if __name__ == "__main__":
    for name in build():
        print("  wrote", name)
    for problem in check_no_firebase():
        print("  PROBLEM:", problem)
