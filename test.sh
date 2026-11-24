#!/bin/sh
# App tests (make test runs this; app-owned, survives make upgrade).
# Needs Node 20+ on the host. Zero npm dependencies: node's own test runner.
set -e
node --test test/
