FROM python:3.12-slim
WORKDIR /app
COPY server.py /app/server.py
COPY public /app/public
RUN useradd --create-home trip && mkdir -p /data && chown trip:trip /data
ENV TRIP_HOST=0.0.0.0 TRIP_DATA_DIR=/data PORT=8765
USER trip
EXPOSE 8765
VOLUME ["/data"]
CMD ["python", "server.py"]
