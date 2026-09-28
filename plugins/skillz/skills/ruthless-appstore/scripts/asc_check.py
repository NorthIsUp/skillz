#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["pyjwt[crypto]>=2.8", "requests>=2.32", "pydantic>=2.7"]
# ///
"""Prove an ASC key belongs to the team you think, and that the app record exists.

Exit 0: key works (and the record exists, if --bundle-id). Exit 1: record or team mismatch.
Read-only: GET /v1/apps and GET /v1/bundleIds.
"""

from __future__ import annotations

import argparse
import sys

from asc import AscError, Client


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    Client.add_args(parser)
    parser.add_argument(
        "--bundle-id", help="require an App Store Connect app record for this bundle id"
    )
    parser.add_argument(
        "--team",
        help="require this team id as the seedId of the key's registered bundle ids",
    )
    args = parser.parse_args()
    client = Client.from_args(args)

    try:
        apps = client.apps()
        bundles = client.bundle_ids()
    except AscError as e:
        print(e, file=sys.stderr)
        return 2

    teams = sorted({b.attributes.seedId for b in bundles})
    print(
        f"key {args.key_id}: {len(apps)} apps, {len(bundles)} bundle ids, team {', '.join(teams) or '?'}"
    )
    for app in apps:
        print(f"  {app.attributes.bundleId:<40} {app.attributes.name}")

    ok = True
    if args.team and teams != [args.team]:
        print(
            f"team mismatch: want {args.team}, key sees {teams or 'no bundle ids'}",
            file=sys.stderr,
        )
        ok = False
    if args.bundle_id:
        if not any(b.attributes.identifier == args.bundle_id for b in bundles):
            print(
                f"bundle id {args.bundle_id} not registered: run register_bundle.py",
                file=sys.stderr,
            )
            ok = False
        if not any(a.attributes.bundleId == args.bundle_id for a in apps):
            # There is no create-app endpoint (POST /v1/apps is 403 for every key role).
            print(
                f"no app record for {args.bundle_id}: create it once in the ASC web UI (Apps > + > New App)",
                file=sys.stderr,
            )
            ok = False
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
