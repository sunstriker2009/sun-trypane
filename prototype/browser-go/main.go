package main

import (
	"bytes"
	"encoding/json"
	"syscall/js"
)

func main() {
	input := js.Global().Get("trypaneInput").String()
	if len(input) > 32*1024 {
		js.Global().Set("trypaneResult", map[string]any{"error": "Use at most 32 KiB of JSON."})
		return
	}

	var compact bytes.Buffer
	if err := json.Compact(&compact, []byte(input)); err != nil {
		js.Global().Set("trypaneResult", map[string]any{"error": err.Error()})
		return
	}
	js.Global().Set("trypaneResult", map[string]any{"output": compact.String()})
}
