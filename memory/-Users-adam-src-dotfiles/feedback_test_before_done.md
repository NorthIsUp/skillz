---
name: agents must test before claiming done
description: Code/feature work isn't complete until tests have been written and run successfully — applies to any project, any language
type: feedback
originSessionId: ffe2c465-fe66-43a5-9f74-4c948334dc1c
---
Don't claim work is done until you have tested it. For non-trivial code changes that means writing tests (unit or integration) AND running them with green output. A successful build is not enough — exercising the actual behavior is required.

**Why:** Adam has been burned multiple times by agents declaring tasks complete based on "it compiles" or smoke tests that didn't cover the failure paths. Tests are the only durable evidence that the code does what it claims.

**How to apply:** When implementing or porting code, default to writing an integration/unit test alongside the change and running it before reporting completion. If you cannot run tests in the environment, say so explicitly rather than claiming success. The "verification-before-completion" superpower captures the same rule — follow it.
