# Demo data

The files the static demo uses to reproduce the competition's public leaderboard. Nothing
here is fetched at runtime and nothing touches Firebase.

## Ground truth

`public_test_set_labels.csv` — the grades for the 64 one-hour epochs of the public test set,
as two columns, `ID` (the competition's epoch identifier) and `class` (grade 1–4). These are
the labels that were withheld from participants during the competition and released with the
public dataset:

> O'Toole JM et al. *Neonatal EEG graded for severity of background abnormalities in
> hypoxic-ischaemic encephalopathy.* Scientific Data 10, 129 (2023).
> https://doi.org/10.1038/s41597-023-02002-8

The original file also carried a `file_ID` column mapping each epoch to its identifier in the
published dataset. It is dropped here because the leaderboard does not need it.

**The hidden validation set is not here.** Those recordings include newborns from centres
other than Cork University Maternity Hospital, are governed by the ANSeR study's
data-sharing agreements, and cannot be redistributed. The demo therefore reproduces Table 4
of the paper (public test set) and not Table 5.

## Submissions

One file per method, under its original submitted filename so it can be traced back:

| Method | File |
|---|---|
| XGBoost with qEEG features | `submissions/XGBoost/public_6.csv` |
| CNN | `submissions/CNN/my_submission.csv` |
| ConvNeXt | `submissions/ConvNeXt/preds_public.csv` |
| SVM with qEEG features | `submissions/SVM/public_ResultsWithID.csv` |

Each file holds two columns, `ID` and `class`, with one row per test-set epoch in the test
set's own order and grades 1–4. That is the format the platform required:
`calculate_sub_scores()` in `app/services/myFirebase.py` pairs a submission with the ground
truth by row position and reads the target column by the name `class`, which the competition
article told participants not to rename.

## Rebuilding the leaderboard

```bash
python app/static/demo/build_demo.py
```

It scores each submission by passing the file to `calculate_sub_scores()` from
`app/services/myFirebase.py` — the platform's own scoring function — and writes the result
into `../js/demo-data.js`. It compares every value against Table 4 of the paper and fails if
any has drifted beyond the 0.005 the platform's two-decimal rounding allows. All four rows
currently agree.
