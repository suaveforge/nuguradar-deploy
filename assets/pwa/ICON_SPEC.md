# NUGU RADAR PWA icon set

Approved artwork is now wired into the PWA shell.

Active files:
- icon-192.png — 192×192 PNG, standard manifest icon
- icon-512.png — 512×512 PNG, standard manifest icon
- maskable-512.png — 512×512 PNG, maskable manifest icon
- apple-touch-icon.png — 180×180 PNG, iOS home-screen icon

The manifest owns the standard/maskable entries, and every main app page links the Apple touch icon.
If the brand artwork changes later, replace all four from the same approved master and bump the service-worker cache version so installed apps refresh cleanly.
