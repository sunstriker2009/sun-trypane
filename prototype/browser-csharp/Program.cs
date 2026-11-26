using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;

[SupportedOSPlatform("browser")]
public static partial class SnippetCompiler
{
    private const int DiagnosticLimit = 50;

    private static readonly MetadataReference[] References =
    [
        LoadReference("System.Runtime.dll"),
        LoadReference("System.Console.dll"),
        LoadReference("System.Linq.dll"),
        LoadReference("System.Collections.dll"),
    ];

    private static MetadataReference LoadReference(string name)
    {
        using var resource = typeof(SnippetCompiler).Assembly.GetManifestResourceStream("CompilerReference." + name)
            ?? throw new InvalidOperationException("Missing C# reference: " + name);
        using var image = new MemoryStream();
        resource.CopyTo(image);
        return MetadataReference.CreateFromImage(image.ToArray(), filePath: name);
    }

    public static void Main() { }

    private static CSharpCompilation CreateCompilation(string source)
    {
        var usings = CSharpSyntaxTree.ParseText("global using System; global using System.Linq; global using System.Collections.Generic;");
        var snippet = CSharpSyntaxTree.ParseText(source, path: "Snippet.cs");
        return CSharpCompilation.Create(
            "Snippet", [usings, snippet], References,
            new CSharpCompilationOptions(OutputKind.ConsoleApplication, concurrentBuild: false));
    }

    [JSExport]
    public static string Check(string source)
    {
        if (source.Length > 8192)
            throw new ArgumentException("Use at most 8,192 characters.");

        using var output = new MemoryStream();
        var emitted = CreateCompilation(source).Emit(output);
        var diagnostics = new List<CompilerDiagnostic>();
        var truncated = false;
        foreach (var diagnostic in emitted.Diagnostics)
        {
            if (diagnostic.Severity is not (DiagnosticSeverity.Error or DiagnosticSeverity.Warning))
                continue;
            if (diagnostics.Count == DiagnosticLimit)
            {
                truncated = true;
                break;
            }

            var span = diagnostic.Location.GetLineSpan();
            diagnostics.Add(new CompilerDiagnostic(
                diagnostic.Id,
                diagnostic.Severity == DiagnosticSeverity.Error ? "error" : "warning",
                diagnostic.GetMessage(CultureInfo.InvariantCulture),
                span.IsValid ? span.StartLinePosition.Line + 1 : null,
                span.IsValid ? span.StartLinePosition.Character + 1 : null));
        }

        return JsonSerializer.Serialize(
            new CheckResult(emitted.Success, diagnostics, truncated), CheckJson.Default.CheckResult);
    }
}

internal sealed record CompilerDiagnostic(string Id, string Severity, string Message, int? Line, int? Column);
internal sealed record CheckResult(bool Success, List<CompilerDiagnostic> Diagnostics, bool Truncated);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(CheckResult))]
internal partial class CheckJson : JsonSerializerContext { }
