# EviMesh local web fonts

EviMesh v2.1 serves its interface fonts locally. No page contacts a font CDN at runtime.

| Family | File | Source | License |
|---|---|---|---|
| Inter Tight | `inter-tight-latin-variable.woff2` | Google Fonts `fonts.gstatic.com`, v9 latin variable | SIL Open Font License 1.1 (`licenses/Inter-Tight-OFL.txt`) |
| Source Serif 4 | `source-serif-4-latin-variable.woff2` | Google Fonts `fonts.gstatic.com`, v14 latin variable | SIL Open Font License 1.1 (`licenses/Source-Serif-4-OFL.txt`) |
| IBM Plex Mono | `ibm-plex-mono-latin-{400,600,700}.woff2` | Google Fonts `fonts.gstatic.com`, v20 latin static | SIL Open Font License 1.1 (`licenses/IBM-Plex-Mono-OFL.txt`) |

The corresponding Google Fonts repository snapshot used to verify upstream metadata was commit `ade3d1533e06b2b1462ffcde8e08b129627ca360`.

Upstream binary URLs:

- Inter Tight: `https://fonts.gstatic.com/s/intertight/v9/NGSwv5HMAFg6IuGlBNMjxLsH8ag.woff2`
- Source Serif 4: `https://fonts.gstatic.com/s/sourceserif4/v14/vEFI2_tTDB4M7-auWDN0ahZJW1gb8tc.woff2`
- IBM Plex Mono 400: `https://fonts.gstatic.com/s/ibmplexmono/v20/-F63fjptAgt5VM-kVkqdyU8n1i8q1w.woff2`
- IBM Plex Mono 600: `https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3vAOwlBFgg.woff2`
- IBM Plex Mono 700: `https://fonts.gstatic.com/s/ibmplexmono/v20/-F6qfjptAgt5VM-kVkqdyU8n3pQPwlBFgg.woff2`

Historical prototypes carried their own font copies; production serves the files in this directory.
