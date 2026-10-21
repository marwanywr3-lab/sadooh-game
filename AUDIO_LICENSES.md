# Sadooh feedback audio

All clips are original Kenney recordings/designs, distributed under CC0. No generative audio or background music is used. Kenney's publisher page declares “No generative AI was used”: https://kenney.itch.io/kenney-game-assets . Individual free packs were downloaded; the paid bundle was not purchased.

| App file | Original recording | Pack |
| --- | --- | --- |
| whoosh.wav | Audio/card-slide-4.ogg | Casino Audio 1.1 |
| pop.wav | Audio/pluck_001.ogg | Interface Sounds 1.0 |
| turn.wav | Audio/select_001.ogg | Interface Sounds 1.0 |
| flip.wav | Audio/card-shove-1.ogg | Casino Audio 1.1 |
| reveal.wav | Audio/confirmation_001.ogg | Interface Sounds 1.0 |
| victory.wav | Audio/Pizzicato jingles/jingles_PIZZI01.ogg | Music Jingles |

Sources:
- https://kenney.nl/assets/interface-sounds
- https://kenney.nl/assets/casino-audio
- https://kenney.nl/assets/music-jingles
- License: https://creativecommons.org/publicdomain/zero/1.0/

Original pack license texts are preserved under public/assets/audio/. sources.json records original filenames, output durations and SHA-256 hashes. Processing: mono conversion, WAV PCM16 encoding and 8 ms boundary fades; flip shortened to 0.5 seconds. No synthesis. WAV ensures playback on older iOS versions as well as desktop browsers. The victory cue is one-shot, approximately one second, without looping.

Audio is an optional enhancement: browsers can block playback until a trusted gesture; failed loading never blocks gameplay. Assets are cached on first successful playback/fetch, not required for the offline shell to install. First offline use before audio has been fetched remains silent.
