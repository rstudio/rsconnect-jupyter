#!/bin/sh

set -ex

mkdir -p dist/html
cd docs/guide

sed s/RSCONNECT_VERSION/${VERSION}/g < README.md > ../../build/docs-README.md

pandoc -f markdown-implicit_figures \
    --self-contained \
    -o ../../dist/rsconnect-jupyter-${VERSION}.html \
    -H style.css \
    ../../build/docs-README.md

pandoc -f markdown-implicit_figures \
    -o ../../dist/rsconnect-jupyter-${VERSION}.pdf \
    ../../build/docs-README.md
