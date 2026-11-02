# App Store screenshots — active pair

Two opaque **1440 × 900** SVG sources, with visible pagination **1 / 2** and
**2 / 2**. Filenames 02 and 04 preserve the two concepts selected by the user.
The other concepts have been deleted and are no longer generated.

- **02 — Your feed. Your rules.** A deep violet gradient, mint headline and
  dimensional light popup make the three independent filters immediately clear.
  The real popup includes the default collapsed **Settings** footer action.
  Normal YouTube videos are explicitly described as remaining available.
- **04 — We’ll guide you. One step at a time.** A bright mint scene shows the
  actual Safari-settings and checkbox stages of the in-app wizard. The copy
  clearly separates app guidance from user actions: the app opens settings;
  the user enables the extension and grants website access when Safari asks.

Product UI is a vector reconstruction of the current repository; editorial
shadows, background shapes and card layering are presentation only. The second
frame shows two successive wizard screens, not two simultaneous app windows.
There are no platform logos, invented metrics or automatic-permission claims.

## Rendering and editing

Resolve relative image references from this directory. Both SVGs use the master
icon at `../../icon/ShortVideoBlocker-icon.png`.

```sh
python3 marketing/screenshots/source/build_sources.py
```

`copy.en.json` owns editorial captions and intentional line breaks. SVG text has
stable `data-copy-key` attributes. Product labels come from
`localization/catalog.json`. The source generator writes only the two selected
SVGs; it does not change the app, catalogs, rendered PNGs or remote screenshots.

This English pair can serve as the initial screenshot fallback for the fifteen
localized storefront listings. App and metadata localization are separate. To
translate the screenshots later, copy the manifest and set `locale` to a catalog
locale, then pass `--copy path/to/copy.locale.json`. Review every translated
headline, tight UI wrap and RTL composition before export; several reconstructed
UI line breaks are intentionally English in this initial pair.
