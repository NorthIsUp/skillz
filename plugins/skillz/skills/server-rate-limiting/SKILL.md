---
name: server-rate-limiting
description: when the claude api server has rate limiting
---

# server side time outs

whenever there is rate limiting you try again in 1 second. If it still fails not the current time, then retry every 10 seconds until you either succeed or have been trying for minutes
