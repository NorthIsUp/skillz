# /// script
# requires-python = ">=3.12"
# dependencies = ["pyjwt[crypto]>=2.8", "requests>=2.32", "pydantic>=2.7"]
# ///
"""Create a store provisioning profile (POST /v1/profiles) and write the .mobileprovision.

The profile name is what PROVISIONING_PROFILE_SPECIFIER and ExportOptions.plist refer to.
"""

from __future__ import annotations

import argparse
import base64
import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

from asc import AscError, Client, ProfileOne


class Ref(BaseModel):
    type: str
    id: str


class ProfileCreate(BaseModel):
    class Data(BaseModel):
        class Attributes(BaseModel):
            name: str
            profileType: Literal["IOS_APP_STORE", "MAC_APP_STORE", "TVOS_APP_STORE"]

        class Relationships(BaseModel):
            class One(BaseModel):
                data: Ref

            class Many(BaseModel):
                data: list[Ref]

            bundleId: One
            certificates: Many

        type: Literal["profiles"] = "profiles"
        attributes: Attributes
        relationships: Relationships

    data: Data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    Client.add_args(parser)
    parser.add_argument("identifier", help="bundle id, e.g. com.northisup.pixkidz")
    parser.add_argument("--name", required=True, help='e.g. "PixKidz App Store"')
    parser.add_argument(
        "--cert-id",
        action="append",
        required=True,
        help="DISTRIBUTION certificate id (make_cert.sh writes <dir>/dist.id)",
    )
    parser.add_argument(
        "--type",
        choices=["IOS_APP_STORE", "MAC_APP_STORE", "TVOS_APP_STORE"],
        default="IOS_APP_STORE",
    )
    parser.add_argument(
        "--out", type=Path, required=True, help="where to write the .mobileprovision"
    )
    args = parser.parse_args()
    client = Client.from_args(args)

    try:
        bundles = client.bundle_ids(args.identifier)
        if not bundles:
            print(
                f"bundle id {args.identifier} not registered: run register_bundle.py",
                file=sys.stderr,
            )
            return 1
        R = ProfileCreate.Data.Relationships
        body = ProfileCreate(
            data=ProfileCreate.Data(
                attributes=ProfileCreate.Data.Attributes(
                    name=args.name, profileType=args.type
                ),
                relationships=R(
                    bundleId=R.One(data=Ref(type="bundleIds", id=bundles[0].id)),
                    certificates=R.Many(
                        data=[Ref(type="certificates", id=c) for c in args.cert_id]
                    ),
                ),
            )
        )
        profile = ProfileOne.model_validate_json(
            client.request("POST", "/v1/profiles", body=body)
        ).data
    except AscError as e:
        print(e, file=sys.stderr)
        return 1

    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(base64.b64decode(profile.attributes.profileContent))
    args.out.chmod(0o600)
    print(
        f"{profile.attributes.name} ({profile.attributes.uuid}) -> {args.out}",
        file=sys.stderr,
    )
    print(profile.id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
