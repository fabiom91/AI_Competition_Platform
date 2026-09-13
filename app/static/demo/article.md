# Classification of Abnormal EEG Background Activity in Newborn Infants

## Context
A lack of blood flow or oxygen delivery around the time of birth can cause brain injury.
This injury, known as hypoxic-ischaemic encephalopathy (HIE), is the leading cause of
death and disability for neonates.  HIE can cause neonatal death or significant
neurological and neurodevelopmental impairment such as cerebral palsy, epilepsy, or
learning disabilities.  Early brain monitoring can aid stratification of at-risk infants
to optimise neuroprotective treatments.

EEG can play an important role in continuous brain monitoring at the cot side.  However,
interpretation of this complex data-stream requires specialised expertise.  Automated EEG
review would allow for a long-term continuous assessment of EEG which could be easily
scaled to monitor many infants at once.

## The Challenge

The challenge is to develop a classifier that can distinguish 4 different grades of EEG
abnormalities.  These grades are based on the severity of abnormal activity in the
background pattern of the EEG.  The dataset consists of 169 epochs from 53 term newborns
with HIE.  Each epoch is exactly 1 hour in duration with 9 EEG channels.  And each epoch
is associated with 1 of the 4 grades. Further details on the fully-anonymised dataset is
described in [https://arxiv.org/abs/2206.04420](https://arxiv.org/abs/2206.04420) and the
dataset is available to download at
[ZENODO](https://zenodo.org/record/6587973#.YpSB_C8Rq4J).

![](https://i.ibb.co/F6xzYqD/Microsoft-Teams-image.png)

We hope that this challenge will allow for many differing approaches to the neonatal EEG
classification problem and will provide some insight into best practices.  A condition of
entry is the all solutions will be published as open-source code.  The competition will
run for a minimum of 6 weeks from its publication on this platform.  To encourage participation, we will award a **cash prize of €2,000** to
the winning solution.


## How to enter

1. Please read and accept the **Terms and Conditions** attached to this article. 
2. Please also read **How to join a Competition** and **How to use this platform** here:
   [Dashboard](https://infantresearchcommunity.ucc.ie)
3. Download the EEG dataset from here [ZENODO](https://zenodo.org/record/6587973#.YpSB_C8Rq4J)
4. Design and build your solution and get instant feedback from the leaderboard by testing on
   unlabelled data.
5. After the competition closes, all methods will be tested on a private, held-out data
   set. The winner will be selected based on classification performance of this dataset.
6. Make your methods available using an open-source licence.

## Deadline
The competition will close at 23.59 Central European Time on the 30th of August 2022.

## Downloads and Testing

In the downloads section at the bottom of this article, there are 2 `.csv` files and 1 `.pdf` available:

- **public.csv** : which contains the names of 105 EEG files (from 31 infants) and their EEG
  grades
- **solution.csv** : which contains the names of the remaining 64 EEG files (from 22 infants)
  and a blank column for the grades. This columns needs to be filled with the output of
  your solution and uploaded for submission.
- **Terms_and_Conditions_-_Infant_Competition.pdf** : which contains the list of Terms and Conditions to participate in the competition.

**NB:** you may find that the HIE grades column in each file is called **"Class"**. This
is a special key-word used by our automated evaluation system to identify the target
feature (or class) to be evaluated. **Please do not rename it in your submission**.

No more than 5 submissions per participant, per day will be accepted.


## Contact Us
This competition is run by the [Irish Centre for Maternal and Child Health
Research](https://infantcentre.ie), located at [University College
Cork](https://www.ucc.ie/en/), Ireland.

Please address all quieres to XXXresearchcommunity@gmail.com.

## Acknowledgements
This work was supported by an Innovator Award from the Wellcome Trust (209325/Z/17/Z). The
medical-device trial which recorded the EEG was supported by a Strategic Translational
Award also from the Wellcome Trust (098983). The challenge is based upon work by the COST
Action __AI-4-NICU__ (CA20214), supported by COST (European Cooperation in Science and
Technology, [https://www.cost.eu/](https://www.cost.eu/)).

![](https://i.ibb.co/KzBN2xp/cost-logos-gray.png)
