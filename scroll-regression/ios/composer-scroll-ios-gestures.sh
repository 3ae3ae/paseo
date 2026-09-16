#!/bin/bash
set -euo pipefail
dir=/Volumes/devbox/workspace/composer-scroll-ios-evidence
ad(){ agent-device "$@" --session composer-scroll-ios; }
ad snapshot --raw --json > "$dir/gesture-target.json"
target=$(node -e 'const n=require(process.argv[1]).data.nodes.find(n=>n.type==="TextView" && n.label?.startsWith("Message agent")); console.log("@"+n.ref)' "$dir/gesture-target.json")
ad press "$target" --settle
ad snapshot --raw --json > "$dir/chat-gesture-open.json"
ad screenshot "$dir/chat-gesture-open.png"
ad gesture pan 200 210 0 160 1000
sleep 1
ad snapshot --raw --json > "$dir/chat-slow-down.json"
ad screenshot "$dir/chat-slow-down.png"
ad gesture fling down 200 180 230
sleep 1
ad snapshot --raw --json > "$dir/chat-flick.json"
ad screenshot "$dir/chat-flick.png"
node - "$dir" <<'JS'
const dir=process.argv[2];
const ns=name=>require(`${dir}/${name}.json`).data.nodes;
const keyboard=name=>ns(name).some(n=>n.type==='Keyboard'&&n.rect.y<874);
for(const name of ['chat-gesture-open','chat-slow-down']) if(!keyboard(name)) throw Error(`${name}: keyboard dismissed`);
const h=name=>ns(name).find(n=>n.type==='TextView'&&n.label?.startsWith('Message agent')).rect.height;
console.log(`Slow scroll retained keyboard; flick keyboard visible=${keyboard('chat-flick')}; input heights=${h('chat-gesture-open')},${h('chat-slow-down')},${h('chat-flick')}`);
if(Math.abs(h('chat-gesture-open')-h('chat-flick'))>1/3)throw Error('Flick changed input height');
JS
