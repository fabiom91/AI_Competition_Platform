"""Weighted Matthews correlation coefficient — vendored component.

Vendored from https://github.com/fabiom91/MCC_Weighted at tag v1.0.0
(commit ed55752f5af1bf704d11b7159904fa7a55857227). See README.md in this
directory for provenance and licence.
"""

from .weighted_metrics import Weighted_metrics, weights  # noqa: F401

__all__ = ["Weighted_metrics", "weights"]
__version__ = "1.0.0"
