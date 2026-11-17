"""Free Microsoft Edge neural TTS with word timings.

Reads a JSON request on stdin: {"text", "voice", "rate", "audio", "words"}
Writes the MP3 to `audio` and a JSON list of {word, start, end} (seconds) to `words`.
Install once with:  pip install edge-tts
"""
import asyncio
import json
import sys

try:
    import edge_tts
except ImportError:  # pragma: no cover - reported to the Node side
    sys.stderr.write("edge-tts is not installed. Run: pip install edge-tts\n")
    sys.exit(3)


async def synthesize(req):
    kwargs = {"rate": req.get("rate") or "+0%"}
    if req.get("pitch"):
        kwargs["pitch"] = req["pitch"]
    try:
        communicate = edge_tts.Communicate(req["text"], req["voice"], boundary="WordBoundary", **kwargs)
    except TypeError:  # edge-tts < 7 always emits word boundaries
        communicate = edge_tts.Communicate(req["text"], req["voice"], **kwargs)
    words = []
    with open(req["audio"], "wb") as out:
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                out.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                start = chunk["offset"] / 1e7
                words.append({"word": chunk["text"], "start": start, "end": start + chunk["duration"] / 1e7})
    with open(req["words"], "w", encoding="utf-8") as out:
        json.dump(words, out)


if __name__ == "__main__":
    asyncio.run(synthesize(json.load(sys.stdin)))
