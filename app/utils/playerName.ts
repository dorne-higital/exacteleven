// Lowercase surname "connector" words that belong attached to the following
// word rather than being treated as a surname on their own — e.g. "Kevin De
// Bruyne" should shorten to "K. De Bruyne", not "K. Bruyne". Matched
// case-insensitively.
const SURNAME_CONNECTORS = new Set([
    'de', 'da', 'do', 'dos', 'das', 'van', 'von', 'al', 'bin', 'el',
    'der', 'den', 'la', 'le', 'du', 'ter',
]);

// Shortens a full player name to "first initial + surname" for the cramped
// filled-pitch-slot display — e.g. "Erling Haaland" -> "E. Haaland",
// "Kevin De Bruyne" -> "K. De Bruyne". Only used there: the choice dialog,
// the result recap, and aria-labels all have room for full names and read
// better with them.
export function shortenPlayerName(fullName: string): string {
    const parts = fullName.trim().split(/\s+/);

    if (parts.length <= 1) {
        return fullName;
    }

    const firstInitial = parts[0]!.charAt(0).toUpperCase();

    let surnameStart = parts.length - 1;

    while (surnameStart > 1 && SURNAME_CONNECTORS.has(parts[surnameStart - 1]!.toLowerCase())) {
        surnameStart -= 1;
    }

    return `${firstInitial}. ${parts.slice(surnameStart).join(' ')}`;
}
