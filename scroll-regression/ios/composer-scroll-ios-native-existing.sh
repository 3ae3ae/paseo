#!/bin/bash
set -euo pipefail
host="$1"
dir=/Volumes/devbox/workspace/composer-scroll-ios-evidence
ad(){ agent-device "$@" --session composer-scroll-ios; }
snap(){ ad snapshot --raw --json > "$dir/$host-$1.json"; }
ad press 398 118
sleep 5
ad screenshot "$dir/$host-native-submitted.png"
ad gesture fling down 200 200 300
sleep 2
ad screenshot "$dir/$host-native-after-submit.png"
for i in 1 2 3 4 5 6; do ad gesture fling up 200 650 450; done
sleep 5
ad screenshot "$dir/$host-native-bottom-idle.png"
ad gesture fling down 200 200 300
sleep 2
ad screenshot "$dir/$host-native-after-idle.png"
snap native-finished
