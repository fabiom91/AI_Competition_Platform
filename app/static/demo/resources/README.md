# Competition resources

The files participants could download from the competition article, reproduced here so the
demo's Downloads table works. These are the originals as served by the platform, except for
the Terms and Conditions — see below.

| File | What it is |
|---|---|
| `training_set.csv` | 105 one-hour epochs from 31 newborns, with grades. Columns: `class`, `file_ID`, `ID`. |
| `validation_set.csv` | 64 epochs from 22 newborns, `class` column deliberately blank. This is the file participants filled in and submitted. |
| `Terms_And_Conditions_-_Infant_Competition.pdf` | The competition terms. **Redacted copy** — see below. |
| `comp_resources.zip` | The three files above, for the *Download all* button. |

## What is deliberately not here

The platform kept the answer key for `validation_set.csv` server-side, at
`comp_folder/<competition>/private/validation_set_private.csv`. It was never downloadable and
it is not in this folder.

Those same 64 labels **are** in `../data/public_test_set_labels.csv`, where they are used to
recompute the leaderboard. That is a different thing and is clearly labelled: the grades were
released with the public dataset after the competition
([Scientific Data 10, 129](https://doi.org/10.1038/s41597-023-02002-8)), so publishing them
now discloses nothing, but putting them in the participant download would misrepresent what
participants could see.

The hidden validation set — the one the models were tested on after being frozen — is not in
this repository at all. Those recordings are governed by the ANSeR study's data-sharing
agreements.

## The Terms and Conditions are a redacted re-rendering

The original PDF names a working contact mailbox six times. This repository replaces every
address with the `support@your_support_email.com` placeholder, so the PDF here was
re-rendered from the original text with that substitution and nothing else changed. It is
typeset differently from the document participants received; the wording is theirs.

## The eligibility clause

The Terms exclude "current and past members of the INFANT Research Centre" from participating.
The paper describes a narrower rule: entrants with current or previous access to the ANSeR
recordings or grades were not eligible to win the prize, verified for the prize-winning entry
during manual validation rather than for every submission. The competition was administered by
a single host and checking the broader condition against every registration was not practical.
A note recording this has been added to the redacted PDF; it was not in the document issued to
participants.

## Consistency with the article

The article text calls the two CSVs **public.csv** and **solution.csv**. The files actually
distributed are named `training_set.csv` and `validation_set.csv`, which is also what the
About page refers to. The filenames here are the ones that were served.

## Checks

Counts were verified against the paper:

- 105 + 64 = **169 epochs** from **53 newborns**, matching the public dataset as described.
- 105/169 = 62%, 64/169 = 38%, matching the reported train/test split.
- **No newborn appears in both files**, which is what the paper means by a 60:40 split over
  newborns rather than epochs, to avoid leakage.
- The labels in the withheld answer key are identical to `../data/public_test_set_labels.csv`.
