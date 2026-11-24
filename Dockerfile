# Multi-stage: compile a static Go binary, ship it on distroless static.
# linux/amd64 per the flightdeck contract; the final image has no shell or
# package manager, so the Trivy image scan has almost no surface to flag.

FROM --platform=linux/amd64 golang:1.26-alpine AS build
WORKDIR /src
# No dependencies yet, so there's no go.sum and nothing to download. Once the
# server needs one (S3 saves will), copy go.sum and run `go mod download`
# here, before COPY . ., so module downloads cache separately from source.
COPY go.mod ./
COPY . .
# CGO off => fully static binary that runs on distroless static.
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /range-rat .

# Distroless static: no shell, no apk/apt, ships a built-in nonroot user.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /range-rat /range-rat

# Explicit non-root USER (Trivy DS002 reads the Dockerfile, not the base image).
USER nonroot
EXPOSE 8080
ENTRYPOINT ["/range-rat"]
