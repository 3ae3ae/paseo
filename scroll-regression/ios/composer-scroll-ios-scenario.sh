#!/bin/bash
set -euo pipefail
host="$1"
dir=/Volumes/devbox/workspace/composer-scroll-ios-evidence
mkdir -p "$dir"
ad() { agent-device "$@" --session composer-scroll-ios; }
snap() { ad snapshot --raw --json > "$dir/$host-$1.json"; }
clear_editor() {
  # XCTest's fill can leave the offscreen tail; use the actual delete key.
  snap target
  target=$(node -e 'const n=require(process.argv[1]).data.nodes.find(n=>n.type==="TextView" && n.label?.startsWith("Message agent")); console.log("@"+n.ref)' "$dir/$host-target.json")
  ad fill "$target" x || true
  snap clearing
  read -r x y < <(node -e 'const n=require(process.argv[1]).data.nodes.find(n=>n.type==="TextView" && n.label?.startsWith("Message agent")); console.log(n.rect.x+n.rect.width-3,n.rect.y+n.rect.height-8)' "$dir/$host-clearing.json")
  ad press "$x" "$y"
  ad longpress 376 720 12000
  snap cleared
  node -e 'const n=require(process.argv[1]).data.nodes.find(n=>n.type==="TextView" && n.label?.startsWith("Message agent")); if(n.value) throw Error("Draft not empty: "+n.value)' "$dir/$host-cleared.json"
}
clear_editor
snap empty-open
ad press 4 370
snap content-dismissed
snap target
target=$(node -e 'const n=require(process.argv[1]).data.nodes.find(n=>n.type==="TextView" && n.label?.startsWith("Message agent")); console.log("@"+n.ref)' "$dir/$host-target.json")
ad fill "$target" $'one\ntwo\nthree\nfour\nfive\nsix\nseven\neight\nnine\nten\neleven\ntwelve\nthirteen\nfourteen\nfifteen\nsixteen\nseventeen\neighteen\nnineteen\ntwenty'
snap cap-open
ad screenshot "$dir/$host-cap-open.png"
ad press 398 118
snap header-dismissed
ad screenshot "$dir/$host-header-dismissed.png"
snap target
target=$(node -e 'const n=require(process.argv[1]).data.nodes.find(n=>n.type==="TextView" && n.label?.startsWith("Message agent")); console.log("@"+n.ref)' "$dir/$host-target.json")
ad press "$target"
snap reopened
clear_editor
node /Volumes/devbox/workspace/composer-dock-ios-assert.cjs "$dir" "$host"
