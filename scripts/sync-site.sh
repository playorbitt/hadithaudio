#!/bin/sh
# The site's data (collection JSON, gloss pools, translations, recitation
# timings) lives only in R2: hadith-audio/hadithaudio/site/. Git holds the code.
#   sh scripts/sync-site.sh pull   # download data from R2 into public/
#   sh scripts/sync-site.sh push   # upload public/ to R2 (goes live immediately)
#   then: npx wrangler deploy      # only when worker/ changed
set -e
cd "$(dirname "$0")/.."
R2=r2:hadith-audio/hadithaudio/site
case "$1" in
  pull) rclone copy "$R2" public --transfers 32 ;;
  push) rclone copy public "$R2" --exclude "/gloss-lazy/**" --exclude "/darimi/**" --transfers 32 --s3-no-check-bucket ;;
  *) echo "usage: $0 pull|push"; exit 1 ;;
esac
