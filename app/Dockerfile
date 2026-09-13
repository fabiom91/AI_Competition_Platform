# The competition was run on Python 3.10.4. This image pins 3.11 instead, because
# google-api-core (a firebase-admin dependency) stops supporting Python 3.10 in new
# releases from 4 October 2026, which would eventually make a 3.10 image unbuildable.
# See the README for what that means for reproducing the published results.
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --upgrade pip
RUN apt-get -y update && apt-get install -y pandoc
RUN pip install --no-cache-dir --upgrade -r requirements.txt

EXPOSE 5001

# The weighted MCC used to score submissions is vendored at services/MCC_Weighted
# (BSD 3-Clause; see that directory's README for provenance), so the image is
# self-contained and the scoring metric cannot change between builds.
COPY . .
