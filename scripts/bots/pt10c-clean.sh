#!/bin/sh
# Reviewer C: close every game window in my own Edge (port 9731)
for t in $(curl -s localhost:9731/json/list | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>JSON.parse(s).filter(t=>t.type==='page'&&t.url.includes('8731')).forEach(t=>console.log(t.id)))"); do curl -s localhost:9731/json/close/$t >/dev/null; done
