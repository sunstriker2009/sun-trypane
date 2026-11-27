package main

import (
	"bytes"
	"go/format"
	"go/parser"
	"go/scanner"
	"go/token"
	"syscall/js"
)

const (
	sourceLimit     = 8 * 1024
	previewLimit    = 64 * 1024
	diagnosticLimit = 20
)

func main() {
	input := js.Global().Get("trypaneInput").String()
	js.Global().Set("trypaneResult", check(input))
}

func failure(message string) map[string]any {
	return map[string]any{"failure": message}
}

func check(source string) map[string]any {
	if len(source) > sourceLimit {
		return failure("Use at most 8 KiB of Go source.")
	}

	files := token.NewFileSet()
	start := token.Pos(files.Base())
	file, err := parser.ParseFile(files, "main.go", source, parser.ParseComments|parser.SkipObjectResolution|parser.AllErrors)
	if err != nil {
		issues, ok := err.(scanner.ErrorList)
		if !ok {
			return failure("The Go parser could not read the source.")
		}
		diagnostics := make([]any, 0, min(len(issues), diagnosticLimit))
		position := files.File(start)
		for _, issue := range issues[:min(len(issues), diagnosticLimit)] {
			// Use physical positions so a //line directive cannot move the displayed error.
			physical := position.PositionFor(position.Pos(issue.Pos.Offset), false)
			diagnostics = append(diagnostics, map[string]any{
				"line": physical.Line, "column": physical.Column, "message": issue.Msg,
			})
		}
		return map[string]any{"diagnostics": diagnostics, "truncated": len(issues) > diagnosticLimit}
	}

	var formatted bytes.Buffer
	if err := format.Node(&formatted, files, file); err != nil {
		return failure("The Go formatter could not produce a preview.")
	}
	if formatted.Len() > previewLimit {
		return map[string]any{"previewOmitted": true}
	}
	return map[string]any{"output": formatted.String()}
}
