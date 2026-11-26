using System;
using System.Diagnostics.CodeAnalysis;
using System.Globalization;
using System.IO;
using System.Reflection;
using System.Text;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text.Json.Serialization;

public static partial class SnippetCompiler
{
    [JSImport("entered", "execution-probe")]
    private static partial void Entered();

    // This file is excluded from the public compiler build.
    [JSExport]
    [UnconditionalSuppressMessage("Trimming", "IL2026",
        Justification = "The fixed probe uses only Console and LINQ, which this build roots.")]
    public static string RunFixedProbe(string scenario)
    {
        var source = scenario switch
        {
            "console" => """
            var name = Console.ReadLine();
            Console.WriteLine($"Hello, {name}. Sum: {Enumerable.Range(1, 5).Sum()}.");
            Console.Error.WriteLine("Probe diagnostic.");
            return Console.ReadLine() is null ? 7 : 1;
            """,
            "output" => """Console.Write(new string('x', 6000)); Console.Error.Write(new string('y', 6000)); return 0;""",
            "memory" => """
                var retained = new byte[20][];
                try
                {
                    for (int i = 0; i < retained.Length; i++)
                        retained[i] = new byte[16 * 1024 * 1024];
                }
                catch (OutOfMemoryException)
                {
                    Console.WriteLine("Allocation stopped at the memory limit.");
                    return 8;
                }
                finally
                {
                    GC.KeepAlive(retained);
                }
                return 1;
                """,
            "loop" => """while (true) { }""",
            _ => throw new ArgumentException("Unknown fixed probe."),
        };
        using var image = new MemoryStream();
        var result = CreateCompilation(source).Emit(image);
        if (!result.Success)
            throw new InvalidOperationException(string.Join(Environment.NewLine, result.Diagnostics));

        var entryPoint = Assembly.Load(image.ToArray()).EntryPoint
            ?? throw new InvalidOperationException("The probe has no entry point.");
        // Browser WASM does not provide a default stdin. This one-shot worker
        // installs all three streams and is discarded after reporting the result.
        using var stdin = new StringReader("Ada");
        using var stdout = new CappedWriter(4096);
        using var stderr = new CappedWriter(4096);
        Console.SetIn(stdin);
        Console.SetOut(stdout);
        Console.SetError(stderr);
        Entered();
        var value = entryPoint.Invoke(null, [Array.Empty<string>()]);
        var exitCode = value is int code ? code : 0;
        return JsonSerializer.Serialize(
            new ExecutionProbeResult(exitCode, stdout.Text, stderr.Text, stdout.Truncated || stderr.Truncated),
            ExecutionProbeJson.Default.ExecutionProbeResult);
    }
}

internal sealed record ExecutionProbeResult(int ExitCode, string Stdout, string Stderr, bool Truncated);

internal sealed class CappedWriter(int limit) : TextWriter(CultureInfo.InvariantCulture)
{
    private readonly StringBuilder buffer = new(limit);
    public override Encoding Encoding => Encoding.UTF8;
    public string Text => buffer.ToString();
    public bool Truncated { get; private set; }

    public override void Write(char value)
    {
        if (buffer.Length < limit)
            buffer.Append(value);
        else
            Truncated = true;
    }
}

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(ExecutionProbeResult))]
internal partial class ExecutionProbeJson : JsonSerializerContext { }
