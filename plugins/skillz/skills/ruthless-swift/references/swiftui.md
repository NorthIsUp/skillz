# SwiftUI

Depth on Rule 12 of `ruthless-swift`. Read when laying out a screen,
scaling pixel art, or building a paging scroll view.

## Pixel art

Scale nearest-neighbour, by a whole number of device pixels per art
pixel. A fractional scale makes some art pixels one device pixel wider
than their neighbours, which reads as shimmer.

```swift
@Environment(\.displayScale) private var displayScale

func side(for available: CGFloat, artPixels: Int) -> CGFloat {
    let k = max(1, (available * displayScale / CGFloat(artPixels)).rounded(.down)) // device px per art px
    return CGFloat(artPixels) * k / displayScale                                   // points
}

Image(uiImage: sprite)
    .interpolation(.none)
    .resizable()
    .frame(width: side(for: width, artPixels: 32), height: side(for: width, artPixels: 32))
```

## Fits or scrolls

`ViewThatFits` picks the first child that fits, so the plain layout
comes first and the scrolling fallback second. No `GeometryReader`
arithmetic to decide it:

```swift
ViewThatFits(in: .vertical) {
    palette
    ScrollView { palette }
}
```

## Paging scroll views

```swift
ScrollView(.horizontal) {
    LazyHStack(spacing: 0) {
        ForEach(pages) { page in
            PageView(page).containerRelativeFrame(.horizontal)
        }
    }
    .scrollTargetLayout()
}
.scrollTargetBehavior(.paging) // or .viewAligned for item snapping
.scrollPosition(id: $visiblePage)
.onScrollPhaseChange { old, new in
    if new == .idle, old == .interacting || old == .decelerating {
        model.select(visiblePage) // commit once, when a user swipe settles
    }
}
```

- Commit app state in `onScrollPhaseChange` when a user swipe settles,
  not on every `scrollPosition` change: mid-swipe values and
  programmatic scrolls (`.animating`) would otherwise commit too.
- Live indicators (page dots, a highlighted tab) read `visiblePage`,
  the scroll position, not the committed state, so they track the finger.

## Safe area

Content respects the safe area; only the background ignores it:

```swift
content
    .background { Color.paper.ignoresSafeArea() }
```

`.ignoresSafeArea()` on the content puts controls under the notch and
home indicator.
