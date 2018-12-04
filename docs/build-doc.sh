#!/bin/sh

set -ex

OUT=../../dist

cd docs/guide

sed s/RSCONNECT_VERSION/${VERSION}/g < README.md > ../../build/docs-README.md

pandoc -f markdown-implicit_figures \
    --self-contained \
    -o ${OUT}/rsconnect_jupyter-${VERSION}.html \
    -H style.css \
    ../../build/docs-README.md

pandoc -f markdown-implicit_figures \
    -o ${OUT}/rsconnect_jupyter-${VERSION}.pdf \
    ../../build/docs-README.md
