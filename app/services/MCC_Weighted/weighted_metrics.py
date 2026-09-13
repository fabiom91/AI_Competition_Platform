import numpy as np
from sklearn.metrics import confusion_matrix
from sklearn.utils.validation import check_consistent_length, column_or_1d
from sklearn.utils.multiclass import type_of_target
from sklearn.preprocessing import LabelEncoder
from scipy.sparse import csr_matrix

weights = np.array([
    [1,1,2,3],
    [1,1,1,2],
    [2,1,1,1],
    [3,2,1,1]
])

class Weighted_metrics():
    ''' This class use a weighted confusion matrix by multiplying the confusion matrix by a
    matrix of weights given by the user.
    
    EXAMPLE:
    ---------------------------------------------------------------------
    weights = np.array([
        [1,1,2,3],
        [1,1,1,2],
        [2,1,1,1],
        [3,2,1,1]
    ])

    wm = Weighted_metrics(y_true,y_pred,weights)
    wm.weighted_matthews_corcoef()
    ---------------------------------------------------------------------
    '''
    
    def __init__(self,y_true,y_pred,weights=weights):
        self.weights = weights
        self.y_true = y_true
        self.y_pred = y_pred
        
        self._cm()
        self._weighted_cm()
        
    def _cm(self):
        self.Cm = confusion_matrix(self.y_true, self.y_pred)
    
    def cm(self):
        return self.Cm
        
    def _weighted_cm(self):
        self.WCm = np.multiply(self.Cm,self.weights)
        
    def weighted_cm(self):
        return self.WCm
    
    def _check_targets(self):
        ''' This function from https://github.com/scikit-learn/scikit-learn
        '''
        y_true = self.y_true
        y_pred = self.y_pred
        check_consistent_length(y_true, y_pred)
        type_true = type_of_target(y_true)
        type_pred = type_of_target(y_pred)

        y_type = {type_true, type_pred}
        if y_type == {"binary", "multiclass"}:
            y_type = {"multiclass"}

        if len(y_type) > 1:
            raise ValueError(
                "Classification metrics can't handle a mix of {0} and {1} targets".format(
                    type_true, type_pred
                )
            )

        # We can't have more than one value on y_type => The set is no more needed
        y_type = y_type.pop()

        # No metrics support "multiclass-multioutput" format
        if y_type not in ["binary", "multiclass", "multilabel-indicator"]:
            raise ValueError("{0} is not supported".format(y_type))

        if y_type in ["binary", "multiclass"]:
            y_true = column_or_1d(y_true)
            y_pred = column_or_1d(y_pred)
            if y_type == "binary":
                try:
                    unique_values = np.union1d(y_true, y_pred)
                except TypeError as e:
                    # We expect y_true and y_pred to be of the same data type.
                    # If `y_true` was provided to the classifier as strings,
                    # `y_pred` given by the classifier will also be encoded with
                    # strings. So we raise a meaningful error
                    raise TypeError(
                        "Labels in y_true and y_pred should be of the same type. "
                        f"Got y_true={np.unique(y_true)} and "
                        f"y_pred={np.unique(y_pred)}. Make sure that the "
                        "predictions provided by the classifier coincides with "
                        "the true labels."
                    ) from e
                if len(unique_values) > 2:
                    y_type = "multiclass"

        if y_type.startswith("multilabel"):
            y_true = csr_matrix(y_true)
            y_pred = csr_matrix(y_pred)
            y_type = "multilabel-indicator"

        return y_type, y_true, y_pred
    
    def weighted_matthews_corcoef(self):
        y_type, y_true, y_pred = self._check_targets()
        check_consistent_length(y_true, y_pred)
        if y_type not in {"binary", "multiclass"}:
            raise ValueError("%s is not supported" % y_type)

        lb = LabelEncoder()
        lb.fit(np.hstack([y_true, y_pred]))
        y_true = lb.transform(y_true)
        y_pred = lb.transform(y_pred)

        t_sum = self.WCm.sum(axis=1, dtype=np.float64)
        p_sum = self.WCm.sum(axis=0, dtype=np.float64)
        n_correct = np.trace(self.WCm, dtype=np.float64)
        n_samples = p_sum.sum()
        cov_ytyp = n_correct * n_samples - np.dot(t_sum, p_sum)
        cov_ypyp = n_samples**2 - np.dot(p_sum, p_sum)
        cov_ytyt = n_samples**2 - np.dot(t_sum, t_sum)

        if cov_ypyp * cov_ytyt == 0:
            return 0.0
        else:
            return cov_ytyp / np.sqrt(cov_ytyt * cov_ypyp)
    
        
