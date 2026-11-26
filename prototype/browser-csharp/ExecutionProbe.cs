using System;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text.Json.Serialization;

public static partial class SnippetCompiler
{
    // This file is excluded from the public compiler build.
    [JSExport]
    [UnconditionalSuppressMessage("Trimming", "IL2026",
        Justification = "The fixed probe uses only Console and LINQ, which this build roots.")]
    public static string RunFixedProbe()
    {
        const string source = """
            var name = Console.ReadLine();
            Console.WriteLine($"Hello, {name}. Sum: {Enumerable.Range(1, 5).Sum()}.");
            Console.Error.WriteLine("Probe diagnostic.");
            return Console.ReadLine() is null ? 7 : 1;
            """;
        using var image = new MemoryStream();
        var result = CreateCompilation(source).Emit(image);
        if (!result.Success)
            throw new InvalidOperationException(string.Join(Environment.NewLine, result.Diagnostics));

        var entryPoint = Assembly.Load(image.ToArray()).EntryPoint
            ?? throw new InvalidOperationException("The probe has no entry point.");
        var oldIn = Console.In;
        var oldOut = Console.Out;
        var oldError = Console.Error;
        using var stdin = new StringReader("Ada");
        using var stdout = new StringWriter(CultureInfo.InvariantCulture);
        using var stderr = new StringWriter(CultureInfo.InvariantCulture);
        try
        {
            Console.SetIn(stdin);
            Console.SetOut(stdout);
            Console.SetError(stderr);
            var exitCode = (int)(entryPoint.Invoke(null, [Array.Empty<string>()])
                ?? throw new InvalidOperationException("The probe did not return an exit code."));
            return JsonSerializer.Serialize(
                new ExecutionProbeResult(exitCode, stdout.ToString(), stderr.ToString()),
                ExecutionProbeJson.Default.ExecutionProbeResult);
        }
        finally
        {
            Console.SetIn(oldIn);
            Console.SetOut(oldOut);
            Console.SetError(oldError);
        }
    }
}

internal sealed record ExecutionProbeResult(int ExitCode, string Stdout, string Stderr);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ExecutionProbeResult))]
internal partial class ExecutionProbeJson : JsonSerializerContext { }
