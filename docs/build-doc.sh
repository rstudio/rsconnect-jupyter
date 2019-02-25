#!/bin/sh

set -ex

pandoc -f markdown-implicit_figures \
    --self-contained \
    -o dist/rsconnect_jupyter-${VERSION}.html \
    -H docs/images/style.css \
    README.md

pandoc -f markdown-implicit_figures \
    -o dist/rsconnect_jupyter-${VERSION}.pdf \
    README.md
