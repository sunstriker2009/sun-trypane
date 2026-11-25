using System;
using System.Collections.Generic;
using System.Globalization;
using System.Runtime.InteropServices.JavaScript;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

[SupportedOSPlatform("browser")]
public static partial class RegexRunner
{
    public static void Main() { }

    [JSExport]
    public static string? Validate(string pattern)
    {
        try
        {
            _ = new Regex(pattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(250));
            return null;
        }
        catch (ArgumentException error)
        {
            return error.Message;
        }
    }

    [JSExport]
    public static string Test(string pattern, string input, int limit)
    {
        try
        {
            var regex = new Regex(pattern, RegexOptions.CultureInvariant, TimeSpan.FromMilliseconds(250));
            var match = regex.Match(input);
            if (!match.Success) return "{\"status\":\"no-match\"}";

            var numbers = regex.GetGroupNumbers()[1..];
            var namedGroups = new List<(int Number, string Name)>();
            foreach (var number in numbers)
            {
                var name = regex.GroupNameFromNumber(number);
                if (name != number.ToString(CultureInfo.InvariantCulture))
                    namedGroups.Add((number, name));
            }

            var matches = new List<RegexMatch>();
            while (match.Success)
            {
                var groups = new string?[numbers.Length];
                for (var i = 0; i < numbers.Length; i++)
                    groups[i] = CaptureValue(match.Groups[numbers[i]]);

                var named = new RegexNamedCapture[namedGroups.Count];
                for (var i = 0; i < namedGroups.Count; i++)
                {
                    var (number, name) = namedGroups[i];
                    named[i] = new RegexNamedCapture(name, CaptureValue(match.Groups[number]));
                }

                matches.Add(new RegexMatch(match.Value, match.Index, groups, named));
                if (matches.Count == limit) break;
                match = match.NextMatch();
            }

            return JsonSerializer.Serialize(new RegexResult("match", matches, numbers),
                RegexJsonContext.Default.RegexResult);
        }
        catch (RegexMatchTimeoutException)
        {
            return "{\"status\":\"timeout\"}";
        }
        catch (ArgumentException error)
        {
            return JsonSerializer.Serialize(new RegexError("invalid", error.Message),
                RegexJsonContext.Default.RegexError);
        }
    }

    private static string? CaptureValue(Group group) => group.Success ? group.Value : null;
}

internal sealed record RegexResult(string Status, List<RegexMatch> Matches, int[] GroupNumbers);
internal sealed record RegexMatch(string Text, int Index, string?[] Groups, RegexNamedCapture[] Named);
internal sealed record RegexNamedCapture(string Name, string? Value);

internal sealed record RegexError(string Status, string Message);

[JsonSourceGenerationOptions(PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase)]
[JsonSerializable(typeof(RegexResult))]
[JsonSerializable(typeof(RegexError))]
internal partial class RegexJsonContext : JsonSerializerContext { }
