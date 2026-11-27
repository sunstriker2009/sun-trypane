using System;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices.JavaScript;
using System.Text.Json;
using System.Text.Json.Serialization;

public static partial class SnippetCompiler
{
    [JSExport]
    public static string RunEditableRehearsal(string source, string input)
    {
        if (source.Length > SourceLimit || input.Length > 4096)
            throw new ArgumentException("The source or input exceeds the rehearsal limit.");

        using var image = new MemoryStream();
        var compilation = DescribeCompilation(CreateCompilation(source).Emit(image));
        if (!compilation.Success)
            return Serialize(new EditableRunResult(compilation, null, null));

        try
        {
            return Serialize(new EditableRunResult(compilation, Invoke(image, input), null));
        }
        catch (TargetInvocationException)
        {
            return Serialize(new EditableRunResult(compilation, null, "The snippet threw an exception."));
        }
    }

    private static string Serialize(EditableRunResult result) =>
        JsonSerializer.Serialize(result, EditableRunJson.Default.EditableRunResult);
}

internal sealed record EditableRunResult(CheckResult Compilation, ExecutionProbeResult? Execution, string? Error);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(EditableRunResult))]
internal partial class EditableRunJson : JsonSerializerContext { }
