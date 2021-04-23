#!/usr/bin/env bash

set -euo pipefail

docker build -t gigantti-gpu-alert-lambda-build --pull .

container_id="$(docker create --entrypoint='sleep 1d' gigantti-gpu-alert-lambda-build:latest)"

docker cp "${container_id}:/opt/app/lambda.zip" dist/

docker rm -f "${container_id}" > /dev/null
