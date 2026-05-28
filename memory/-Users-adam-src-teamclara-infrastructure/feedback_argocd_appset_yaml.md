---
name: ApplicationSet goTemplate doesn't preprocess the file
description: Conditional Go-template directives at YAML structural level break Argo's manifest loader, even with goTemplate=true
type: feedback
originSessionId: 790c3d6e-12c9-4e75-ae3b-a5b4f28d2bb4
---

In an Argo CD ApplicationSet with `goTemplate: true`, the **template field** (not the file) is what gets Go-template-processed. The YAML file itself must be valid YAML at load time. So this **breaks** root-app's manifest generation:

```yaml
syncOptions:
  - CreateNamespace=true
  {{- if .serverSideApply }}
  - ServerSideApply=true
  {{- end }}
```

The `{{- if }}` and `{{- end }}` sit at YAML structural level (between list items) and YAML can't parse them. Argo's manifest generator returns `FailedPrecondition desc = Failed to unmarshal "<file>.yaml": ... yaml: line X: could not find expected ':'` and the parent root-app gets stuck on a `ComparisonError` until the file is fixed AND a hard refresh annotation evicts the cached error (`kubectl annotate app -n argocd <name> --overwrite argocd.argoproj.io/refresh=hard`).

**Why:** Argo's ApplicationSet controller text-templates _the template field's value_ but reads the file as YAML first to extract that value. Conditionals inside string values (e.g. `name: '{{ .name }}'`) work because they're text inside a string. Conditionals at YAML structural positions don't.

**How to apply:**

- Keep Go-template directives inside string values (`'{{ .name }}'`, `'{{ default .name .namespace }}'`).
- For "this chart needs an extra syncOption" cases, prefer pulling the outlier into a **standalone Application file** in `manifests/bootstrap/<name>.yaml` (alongside the ApplicationSet) over threading conditional structural Go-template logic.
- If you must vary structural fields, encode the variation as a list/map in the element and use `toJson` / `toYaml` for the field value (e.g. `syncOptions: '{{ toJson .syncOptions }}'`) — but that's hacky.
- Always run `kubectl apply --dry-run=client -f file.yaml` on bootstrap manifests before pushing — it catches this at author time, not in production via root-app's stuck reconcile.

**Discovered:** PR #125 → had to fix in #126. The cluster's root-app stuck for ~10 min until I caught the cached `ComparisonError` and triggered hard-refresh.
