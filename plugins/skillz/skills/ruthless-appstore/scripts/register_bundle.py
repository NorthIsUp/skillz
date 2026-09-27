# /// script
# requires-python = ">=3.12"
# dependencies = ["pyjwt[crypto]>=2.8", "requests>=2.32", "pydantic>=2.7"]
# ///
"""Register an explicit bundle id (POST /v1/bundleIds). Idempotent: an existing id is reported, not re-created.

Prints the bundle id resource id, which make_profile.py takes.
"""

from __future__ import annotations

import argparse
import sys
from typing import Literal

from pydantic import BaseModel

from asc import AscError, BundleIdOne, Client

type Platform = Literal["IOS", "MAC_OS", "UNIVERSAL"]


class BundleIdCreate(BaseModel):
    class Data(BaseModel):
        class Attributes(BaseModel):
            identifier: str
            name: str
            platform: Platform

        type: Literal["bundleIds"] = "bundleIds"
        attributes: Attributes

    data: Data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    Client.add_args(parser)
    parser.add_argument("identifier", help="e.g. com.northisup.pixkidz")
    parser.add_argument(
        "--name",
        required=True,
        help="display name in the developer portal (no dots or special chars)",
    )
    parser.add_argument(
        "--platform", choices=["IOS", "MAC_OS", "UNIVERSAL"], default="IOS"
    )
    args = parser.parse_args()
    client = Client.from_args(args)

    try:
        if existing := client.bundle_ids(args.identifier):
            b = existing[0]
            print(
                f"exists: {b.id} {b.attributes.identifier} {b.attributes.platform} team {b.attributes.seedId}",
                file=sys.stderr,
            )
            print(b.id)
            return 0
        body = BundleIdCreate(
            data=BundleIdCreate.Data(
                attributes=BundleIdCreate.Data.Attributes(
                    identifier=args.identifier, name=args.name, platform=args.platform
                )
            )
        )
        created = BundleIdOne.model_validate_json(
            client.request("POST", "/v1/bundleIds", body=body)
        ).data
    except AscError as e:
        print(e, file=sys.stderr)
        return 1
    # MAC_OS registrations come back as UNIVERSAL; that is expected.
    print(
        f"registered: {created.id} {created.attributes.identifier} {created.attributes.platform}",
        file=sys.stderr,
    )
    print(created.id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
