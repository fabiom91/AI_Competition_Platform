# MCC_Weighted — vendored component

The weighted Matthews correlation coefficient used to rank both competition leaderboards.
`app/services/myFirebase.py` imports it as `from MCC_Weighted.weighted_metrics import
Weighted_metrics`.

## Provenance

| | |
|---|---|
| Upstream | https://github.com/fabiom91/MCC_Weighted |
| Tag | `v1.0.0` |
| Commit | `ed55752f5af1bf704d11b7159904fa7a55857227` |
| Vendored on | 2026-09-13 |
| Licence | BSD 3-Clause (see `LICENSE` in this directory) |

Earlier versions of the platform cloned this repository at image build time from its default
branch. It is now vendored so that the scoring metric travels with the platform and cannot
change between builds — which is what makes the archived release self-contained.

Upstream `v1.0.0` is byte-identical to the copy used to produce the results in the paper,
apart from one removed `print(self.Cm)` debug statement in `_weighted_cm()`. The metric
itself is unchanged.

If upstream is ever updated, re-vendor deliberately: copy the new `weighted_metrics.py` and
`LICENSE` here, update the table above, and record the change in the repository `CHANGELOG.md`.

## What it computes

The confusion matrix **C** is multiplied elementwise (Hadamard product) by a weight matrix
**W**, and the standard multi-class MCC formula is then applied to the result. The default
**W** is the one used for the competition:

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
and 3 for an error of three. Errors of one grade are left at face value and are penalised
exactly as an unweighted MCC would penalise them; only larger errors are amplified. When no
prediction is off by more than one grade, the weighted MCC equals the unweighted MCC exactly.

## Usage

```python
import numpy as np
from MCC_Weighted.weighted_metrics import Weighted_metrics

wm = Weighted_metrics(y_true, y_pred)        # default weights as above
wm.cm()                                       # unweighted confusion matrix
wm.weighted_cm()                              # weighted confusion matrix
wm.weighted_matthews_corcoef()                # the score
```

All four grades must be present in `y_true ∪ y_pred`, otherwise the 4×4 weight matrix is not
conformable with the confusion matrix and the multiplication fails. Pass your own matrix as
`Weighted_metrics(y_true, y_pred, weights=W)` for a different number of classes.
