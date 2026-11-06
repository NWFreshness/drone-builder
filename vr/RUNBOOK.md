# Drone Lab VR on a Meta Quest 3

The VR app is a static web page. Nothing is installed on the headset and there is no store
review: the Quest Browser loads it over USB-forwarded localhost.

## One-time setup

1. Install the Android platform tools (this machine has none yet):

       sudo pacman -S android-tools        # provides adb

2. Enable Developer Mode for the headset: Meta Horizon phone app -> your headset -> Settings ->
   Developer Mode -> on. This also adds "Developer settings" inside the headset.
3. Plug the headset in over USB-C. A prompt appears inside the headset ("Allow USB debugging") —
   accept it, and tick "always allow from this computer".

       adb devices        # should list the headset as 'device', not 'unauthorized'

## Every session

WebXR needs a **secure context**. `http://192.168.x.x:8000` is not one, so a plain LAN address
will load the page but `navigator.xr` will be undefined and no Enter VR button will appear.
`http://localhost` *is* a secure context, so forward the port over USB instead:

    # terminal 1, from the repo root
    python3 -m http.server 8000

    # terminal 2
    adb reverse tcp:8000 tcp:8000

Then in Quest Browser: `http://localhost:8000/vr/?d=freestyle&done=all`

`adb reverse` survives until the cable is unplugged or the headset reboots; re-run it after either.

## Debugging

- **Desktop mirror:** `chrome://inspect` on this machine with the headset attached lists the
  Quest Browser tabs; click inspect for a full DevTools session against the headset.
- **Crashes / compositor:** `adb logcat | grep -i chrom` — WebXR session failures and GPU
  warnings land here, not in the page console.
- **Flat render first.** The same scene renders in the desktop browser without XR; a geometry or
  shading fault shows up there and is far cheaper to iterate on. On-device is for scale, stereo
  comfort, text legibility and framerate.

## Typing is the bottleneck

Do not iterate by typing URLs in the headset. Use the query presets:

    ?d=<drone id>      freestyle | cinewhoop | mini | octo | hexa | race | longrange |
                       whoop | attack | bolt | ghost
    &done=<n|all>      build progress (all = the fast full-build state)
    &xr=0..1           see-through reveal
    &demo=<key>        flight-demo attitude
    &ink=<px>          ink line width in device pixels

Update the page from the desktop and reload in the headset; only the address needs typing once.

## Sharing with someone else's headset

Host the repo over HTTPS — Cloudflare Pages, GitHub Pages, or a tunnel — and open the `https://`
URL. Do not use a self-signed certificate: the Quest Browser will refuse the WebXR session or the
page entirely. `vr/vendor/` is committed, so there is no build step and no network dependency.

## Comfort defaults that matter

- Seated or standing, model at table scale in front of you. Do not put the pilot at 1:1 in the
  air for long sessions; vection is what makes people put the headset down.
- Snap turn only, never smooth yaw.
- If a session makes the horizon move, it is the camera rig, not the model: the rig is placed
  once at session start and the model is not parented to the head.

## Known gaps

- The XR session needs a real headset: this machine can verify the flat render, the geometry,
  the palette and the part counts, but not stereo comfort, IPD scale or compositor framerate.
- Hand tracking is requested as an optional feature but the interactions are controller-first.
