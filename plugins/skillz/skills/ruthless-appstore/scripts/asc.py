#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.12"
# dependencies = ["pyjwt[crypto]>=2.8", "requests>=2.32", "pydantic>=2.7"]
# ///
"""App Store Connect API client shared by the sibling scripts.

Run directly to print a bearer token for curl: `uv run asc.py --key-id K --issuer I`.
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import jwt
import requests
from pydantic import BaseModel, ConfigDict

API = "https://api.appstoreconnect.apple.com"
KEY_DIR = Path.home() / ".appstoreconnect" / "private_keys"
# Apple rejects tokens that live longer than 20 minutes.
TOKEN_TTL_SECONDS = 19 * 60


class Resource(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str
    type: str


class App(Resource):
    class Attributes(BaseModel):
        name: str
        bundleId: str

    attributes: Attributes


class BundleId(Resource):
    class Attributes(BaseModel):
        identifier: str
        name: str
        platform: str
        # The App ID prefix, which is the team ID for every modern team.
        seedId: str

    attributes: Attributes


class Profile(Resource):
    class Attributes(BaseModel):
        name: str
        profileType: str
        uuid: str
        profileContent: str

    attributes: Attributes


class AppList(BaseModel):
    data: list[App]


class BundleIdList(BaseModel):
    data: list[BundleId]


class BundleIdOne(BaseModel):
    data: BundleId


class ProfileOne(BaseModel):
    data: Profile


class AscError(Exception):
    def __init__(self, response: requests.Response) -> None:
        super().__init__(
            f"{response.request.method} {response.url} -> {response.status_code}\n{response.text}"
        )
        self.status = response.status_code


class Client:
    def __init__(self, key_id: str, issuer: str, key_path: Path | None = None) -> None:
        self.key_id = key_id
        self.issuer = issuer
        self.key_path = key_path or KEY_DIR / f"AuthKey_{key_id}.p8"
        self.session = requests.Session()

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> Client:
        return cls(args.key_id, args.issuer, args.key_path)

    @staticmethod
    def add_args(parser: argparse.ArgumentParser) -> None:
        parser.add_argument(
            "--key-id",
            default=os.environ.get("ASC_KEY_ID"),
            required="ASC_KEY_ID" not in os.environ,
        )
        parser.add_argument(
            "--issuer",
            default=os.environ.get("ASC_ISSUER_ID"),
            required="ASC_ISSUER_ID" not in os.environ,
        )
        parser.add_argument(
            "--key-path",
            type=Path,
            help="default: ~/.appstoreconnect/private_keys/AuthKey_<key-id>.p8",
        )

    def token(self) -> str:
        now = int(time.time())
        claims = {
            "iss": self.issuer,
            "iat": now,
            "exp": now + TOKEN_TTL_SECONDS,
            "aud": "appstoreconnect-v1",
        }
        return jwt.encode(
            claims,
            self.key_path.read_text(),
            algorithm="ES256",
            headers={"kid": self.key_id},
        )

    def request(
        self,
        method: str,
        path: str,
        *,
        params: dict[str, str] | None = None,
        body: BaseModel | None = None,
    ) -> str:
        response = self.session.request(
            method,
            f"{API}{path}",
            params=params,
            data=body.model_dump_json(by_alias=True) if body else None,
            headers={
                "Authorization": f"Bearer {self.token()}",
                "Content-Type": "application/json",
            },
            timeout=60,
        )
        if not response.ok:
            raise AscError(response)
        return response.text

    def apps(self, bundle_id: str | None = None) -> list[App]:
        params = {"limit": "200", "fields[apps]": "name,bundleId"}
        if bundle_id:
            params["filter[bundleId]"] = bundle_id
        return AppList.model_validate_json(
            self.request("GET", "/v1/apps", params=params)
        ).data

    def bundle_ids(self, identifier: str | None = None) -> list[BundleId]:
        params = {"limit": "200"}
        if identifier:
            params["filter[identifier]"] = identifier
        found = BundleIdList.model_validate_json(
            self.request("GET", "/v1/bundleIds", params=params)
        ).data
        # filter[identifier] also matches longer ids that share the prefix (extensions).
        return [
            b
            for b in found
            if identifier is None or b.attributes.identifier == identifier
        ]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Print an App Store Connect bearer token."
    )
    Client.add_args(parser)
    sys.stdout.write(Client.from_args(parser.parse_args()).token())


if __name__ == "__main__":
    main()
