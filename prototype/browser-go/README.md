# Browser Go demo

The [Go JSON compactor](https://sunstriker2009.github.io/sun-trypane/demo/go-json.html) runs Go’s standard library JSON compactor in a disposable WebAssembly worker. The page accepts JSON text. The JSON is processed on-device, and the public demo uses a precompiled program. Use the [local Go editor](../go/README.md#local-browser-editor) for editable Go.

Build locally with Node.js 24, Go 1.26, and Python 3:

```sh
npm ci
npm run build
bash prototype/browser-go/build.sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/demo/go-json.html>. The build copies the JavaScript runtime from the same Go SDK that compiles the module. GitHub Pages CI tests both from the staged site.
