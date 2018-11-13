#!/bin/sh

set -ex

cd docs/guide

pandoc -f markdown-implicit_figures \
    --self-contained \
    -o ../../dist/rsconnect-jupyter-${VERSION}.html \
    -H style.css \
    README.md

pandoc -f markdown-implicit_figures \
    -o ../../dist/rsconnect-jupyter-${VERSION}.pdf \
    README.md
