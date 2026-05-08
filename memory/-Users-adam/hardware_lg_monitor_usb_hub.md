---
name: LG 32U990A USB hub needs LG Switch app + accessory-allow
description: For USB cameras to work through the LG UltraFine 32U990A TB5 hub on Apple Silicon, install LG Switch.app and set "Allow accessories to connect" to Always
type: project
originSessionId: 0257aa82-8de1-4414-b661-d78931ce03d0
---
User has an LG UltraFine evo 32U990A (32" 6K, Thunderbolt 5) plugged into a MacBook Pro (Apple Silicon) as the primary dock, with a TB5 cable from LG. Getting USB cameras (specifically Insta360 Link 2) working through the monitor's downstream USB-C 3.2 Gen 2 ports required two things:

1. **System Settings → Privacy & Security → Allow accessories to connect → Always.** Without this, the entire USB hub branch is blocked while display (DP Alt) keeps working. Symptom: the device doesn't enumerate at all.

2. **Install LG Switch.app** (LG's monitor management/driver app for the 32U990A — replaces the older OnScreen Control). Without it, the Link 2 enumerated and control transfers worked (gimbal pan/tilt responded) but the UVC video iso stream dropped the device the moment a viewer tried to pull frames. Installing LG Switch fixed video streaming through the hub.

**How to apply:** When the user reports any USB device misbehaving through the LG monitor on this rig, both pieces should already be in place — but if a future fresh install / new user / new Mac shows similar symptoms, check for LG Switch.app in /Applications and the accessory-allow setting before troubleshooting further. If a USB camera works direct-to-Mac but not through the LG monitor, this pair is the first thing to verify.
