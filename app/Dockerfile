FROM python:3.10.4-bullseye

WORKDIR /app

COPY requirements.txt requirements.txt
RUN pip install --upgrade pip
RUN apt-get -y update && apt-get install -y pandoc
RUN pip install --no-cache-dir --upgrade -r requirements.txt
RUN git clone https://github.com/fabiom91/MCC_Weighted.git ./services/MCC_Weighted

EXPOSE 5001

COPY . .
