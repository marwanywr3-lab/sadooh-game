# Round-one presentation rollback

Baseline source commit: b5e344a417a209a092919281d7cb549a9276dc03
Baseline source tree: 20b713ffd5c453c575ec1f3d093f8e0f96f857be
Baseline site commit: d48996d6f5c4245c4d7b2f08ef6257593edb18c8
Baseline site tree: 67c5955c4371e052e3609e8c1ca446f37446f027
Baseline sadooh-api: version 18, exact deployed backup ../sadooh-api-before-first19.json
Restore frontend and Edge together using normal new commits/deployments; do not delete data or force-push.

Overlap20 supersedes the sequential first19 presentation: one 4.5s music cue covers an overlapping logo exit, round-one words and number. First-turn time starts after this single cue. Opening animation starts automatically; audio is attempted only within its opening window and remains subject to browser autoplay policy. No delayed audio replay is queued after user interaction.
