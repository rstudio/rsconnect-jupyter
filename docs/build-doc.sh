#!/bin/sh

set -ex

TITLE='rsconnect-jupyter User Guide'

pandoc -f markdown-implicit_figures \
    --self-contained \
    -o dist/rsconnect_jupyter-${VERSION}.html \
    -H docs/images/style.css \
    -T "${TITLE}" \
    -M "title:${TITLE}" \
    README.md

pandoc -f markdown-implicit_figures \
    -o dist/rsconnect_jupyter-${VERSION}.pdf \
    -T "${TITLE}" \
    -M "title:${TITLE}" \
    README.md
