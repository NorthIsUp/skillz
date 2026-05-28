---
name: Pulumi ESC secrets management
description: Pulumi ESC env structure, early binding limitation, per-dev override pattern for teamclara org
type: reference
---

Clara uses Pulumi ESC for secrets/config management. Org: `teamclara`. CLI: `esc` (installed via mise).

## Environment hierarchy

- `development/base-app-backend` - shared backend secrets + env var mappings (Django, AWS, Twilio, etc.)
- `development/base-app-frontend` - shared frontend config
- `development/base-dev-tools` - dev tool secrets (Datadog, Fly.io) + per-dev placeholder keys
- `development/<username>` - personal overrides (e.g., `development/adam`)

Personal envs import all three bases.

## Critical limitation: early binding

ESC resolves interpolations per-environment BEFORE merging imports. If base-dev-tools defines:

```yaml
secrets.linear.api_key: null
environmentVariables.LINEAR_API_KEY: ${secrets.linear.api_key}
```

The env var resolves to `null` inside base-dev-tools, and that literal `null` is what merges. Overriding `secrets.linear.api_key` in a personal env does NOT update the env var.

ESC also does NOT implement RFC 7396 null-as-delete. Null stays as a value.

Late binding is an open feature request: pulumi/esc#127.

## Workaround for per-dev secret overrides

Put `fn::secret` directly in `environmentVariables` AND in `secrets` namespace:

```yaml
values:
  secrets:
    linear:
      api_key:
        fn::secret:
          ciphertext: ...
  environmentVariables:
    LINEAR_API_KEY:
      fn::secret:
        ciphertext: ...
```

## Useful context properties

- `${context.pulumi.user.login}` - current user (e.g., `adam-askclara-com`)
- Nested interpolation (`${foo.${bar}}`) does NOT work
- `imports` with `merge: false` + `${imports["env"].path}` for selective access
