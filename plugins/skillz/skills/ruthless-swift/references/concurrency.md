# Concurrency

Depth on Rules 1 and 2 of `ruthless-swift`. Read when choosing where
code is isolated or fixing a Swift 6 concurrency error.

## Where code is isolated

| Code                                              | Isolation                                              |
| ------------------------------------------------- | ------------------------------------------------------ |
| App model, view models                            | `@Observable @MainActor final class`                   |
| Engine package whose callers are all main-actor   | `swiftSettings: [.defaultIsolation(MainActor.self)]`   |
| Pure value types used from several isolations     | `nonisolated` + `Sendable`                             |
| Work that must leave the main actor (decode, I/O) | A `nonisolated` async function or an actor, not a lock |

Main-actor default is the simple choice when the UI drives everything:
no annotations to thread through, no locks. Its price is test
parallelism (Rule 6 and `testing.md`), which sharding buys back.

## Swift 6 errors PixKidz hit

| Error                                                      | Cause                                                 | Fix                                                                                 |
| ---------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Main actor-isolated default value in a nonisolated context | A stored property's default reads a main-actor static | Mark the static `nonisolated` (it must be `Sendable`), or the consumer `@MainActor` |
| `URLSchemeHandler` init off the main actor                 | Constructed from nonisolated code                     | Create it on the main actor                                                         |
| Display link never deallocates its owner                   | `CADisplayLink` retains its target strongly           | Weak proxy target; invalidate in `isolated deinit` (below)                          |
| A `Mutex` per pixel in nonisolated engine code             | Isolation guessed instead of read from the callers    | Every caller was main-actor: make the code main-actor and drop the lock             |

## `CADisplayLink` without a retain cycle

The link retains its target, so a link targeting `self` keeps `self`
alive until someone remembers to invalidate it. Target a proxy that
holds the owner weakly, and invalidate from the owner's deinit:

```swift
private final class WeakTarget: NSObject {
    weak var owner: Animator?
    init(_ owner: Animator) { self.owner = owner }

    @objc func tick(_ link: CADisplayLink) {
        MainActor.assumeIsolated { owner?.step(link) }
    }
}

@MainActor final class Animator {
    private var link: CADisplayLink?

    func start() {
        let link = CADisplayLink(target: WeakTarget(self), selector: #selector(WeakTarget.tick))
        link.add(to: .main, forMode: .common)
        self.link = link
    }

    func step(_ link: CADisplayLink) { /* advance one frame */ }

    isolated deinit { link?.invalidate() }
}
```

`isolated deinit` runs on the main actor, so it can touch `link`
without a hop; a plain deinit on a main-actor class can't.
