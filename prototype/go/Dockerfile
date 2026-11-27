FROM golang:1.26-bookworm

ENV HOME=/work GOCACHE=/work/cache GOENV=off GOTELEMETRY=off \
    GOTOOLCHAIN=local GOPROXY=off GOSUMDB=off GO111MODULE=off CGO_ENABLED=0

COPY execute.sh /opt/trypane/
WORKDIR /work
USER 65532:65532
ENTRYPOINT ["/bin/sh", "/opt/trypane/execute.sh"]
