import { checkLocalEditor } from '../local-editor-smoke.mjs';

await checkLocalEditor({
  serve: './go/serve.mjs',
  sourceLabel: 'Go source',
  invalidSource: 'package main\nfunc main() { _ = "é😀"; missing() }',
  invalidToken: 'missing',
  diagnostic: /undefined: missing/,
  diagnosticButton: /Line 2, column \d+ · undefined: missing/,
  loop: `
package main
import ("fmt"; "io"; "os"; "time")
func main() {
    data, _ := io.ReadAll(os.Stdin)
    fmt.Println(string(data))
    time.Sleep(time.Hour)
}`.trim(),
  readInput: `
package main
import ("fmt"; "io"; "os"; "strings")
func main() {
    data, _ := io.ReadAll(os.Stdin)
    fmt.Println(strings.ReplaceAll(string(data), "\\n", " / "))
    fmt.Println("EOF")
}`.trim(),
});
