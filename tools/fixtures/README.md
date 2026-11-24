# Dev fixtures

Saves for quick venue testing, loaded by the dev route (only when `RR_DEV` is set; 404 otherwise).

    RR_DEV=1 node server/server.mjs
    curl -s -XPOST localhost:8080/api/dev/crew -H 'Content-Type: application/json' -d '{"fixture":"stadium","name":"Perf"}'
    # -> {code, p, k}: join that code from the lobby ("Join a crew"), then add ?perf to the URL

`GET /api/dev/fixtures` lists them. A save body can also be posted directly: `{"save": {...}}`.
Fixture files are plain saves (see `toSave()` in `server/crew.mjs`); the server cleans every field.
