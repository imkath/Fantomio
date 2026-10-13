# Fonts

Self-hosted and subset to what a Spanish site uses (Basic Latin, Latin-1, Latin Extended-A,
punctuation, quotes, €, arrows). The Google versions are Japanese fonts split into ~120 slices
per weight, and next/font preloaded every slice: about 360 font files and 5 MB on each page.

Built from the OFL sources in github.com/google/fonts with:

    pyftsubset <font>.ttf --flavor=woff2 \
      --unicodes="U+0020-007E,U+00A0-00FF,U+0100-017F,U+0218-021B,U+02C6,U+02DA,U+02DC,U+2010-2027,U+2030-203A,U+2044,U+20AC,U+2122,U+2190-2193,U+2212,U+2713" \
      --layout-features='kern,liga,calt,palt,ccmp,locl,mark,mkmk'

Zen Kaku Gothic New and Dela Gothic One are under the SIL Open Font License (see OFL-*.txt).
