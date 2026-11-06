---
name: incident-map
description: >-
  Reading and driving the 3D incident map: what the user sees (fire, replay
  time, tab, layers, camera, selection) and how to change it with update-map or
  navigate. Use when the user says "show me", "go to", "zoom", "play", "turn on",
  or refers to what is on screen.
---

# Incident map

The map and the agent share state through application state:

- The map writes `incident-map` (per browser tab) whenever what it shows changes. `<current-screen>` carries it every turn; `view-screen` reads it fresh and adds fire size and weather at the replay time.
- `update-map` writes a one-shot `map-command`; the map applies it within a second or two and deletes it. Verify with `view-screen` when it matters.

## update-map fields (combine freely)

| Field | Effect |
|---|---|
| `flyTo: {lon, lat, zoom?}` | Eases the camera there. Zoom 8 = region, 12 = whole fire, 14 = neighborhood, 16 = street. |
| `time` | Replay time, UTC ISO-8601, clamped to the fire's window (`map.window`). |
| `showLayers` / `hideLayers` | Layer ids below. |
| `tab` | `incident` (replay), `drones` (footage and the live detector), `risk` (debris flows). |
| `railTab` | `Layers`, `Analysis`, `Evidence`, `Swarm`, `Briefs` (incident tab's right rail). |
| `viewMode` | `2d` or `3d`. |
| `highlight: {lon, lat, label?}` | A labelled pin; `null` clears it. |
| `playing` | Start or pause the replay (2 fire-hours per second at 1×). |

Layers: `terrain`, `burnScar`, `fireSpread` (interpolated progression), `perimeters` (mapped), `ignition` (model estimate), `spine` (spread path), `wind`, `structures` (damage inspections), `roads`, `labels`, `debrisFlow`, `forecast` (+1 h spread forecast), `liveHits` (drone detections).

## The picked spot

Clicking bare terrain opens a menu that sends the spot to you, and `map.picked` holds it until the camera moves. "Here" and "this spot" mean `map.picked`; if it is null, fall back to the highlight or the camera center and say which you used.

## Switching fires

`navigate` with `{view: "incident", fireId: "palisades"}`. The map reloads for the other fire, so send `update-map` after the switch, not with it.

## Recipes

- "Show me Altadena at 4 AM": `find-place` → `update-map {flyTo: {..., zoom: 14}, time: "2025-01-08T12:00:00Z", highlight: {..., label: "Altadena"}}`.
- "Where was the damage worst?": `count-structures-near` at a few candidate points → `update-map {showLayers: ["structures"], flyTo, highlight}`.
- "Debris-flow risk": `update-map {tab: "risk", showLayers: ["debrisFlow"]}`.
