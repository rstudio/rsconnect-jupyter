#!/bin/sh

set -ex

TITLE='rsconnect-jupyter User Guide'

pandoc -f markdown-implicit_figures \
    --self-contained \
    -o docs/out/rsconnect_jupyter-${VERSION}.html \
    -H docs/images/style.fragment.html \
    -T "${TITLE}" \
    -M "title:${TITLE}" \
    README.md

pandoc -f markdown-implicit_figures \
    -o docs/out/rsconnect_jupyter-${VERSION}.pdf \
    -T "${TITLE}" \
    -M "title:${TITLE}" \
    README.md
