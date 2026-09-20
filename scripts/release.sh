#!/usr/bin/env bash
#
# SIMBridge release helper.
#
# Prepares an Android release by creating an annotated, semantic-version Git
# tag (vMAJOR.MINOR.PATCH) on the current HEAD commit. It never pushes and it
# never creates a GitHub Release — the GitHub Actions workflow
# (.github/workflows/android-release.yml) is the authoritative production
# release mechanism and only publishes from a valid tag.
#
# Usage:
#   pnpm release              # suggest the next patch release (e.g. v1.0.1)
#   pnpm release --minor      # suggest the next minor release (e.g. v1.1.0)
#   pnpm release --major      # suggest the next major release (e.g. v2.0.0)
#   pnpm release --version v1.1.0   # explicit version (still confirmed)
#   pnpm release --allow-dirty      # skip the clean-worktree requirement

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

allow_dirty=0
bump="patch"
explicit=""

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'
}

while (($# > 0)); do
  case "$1" in
    --allow-dirty) allow_dirty=1 ;;
    --major) bump="major" ;;
    --minor) bump="minor" ;;
    --patch) bump="patch" ;;
    --version | --tag) shift; explicit="$1" ;;
    --version=* | --tag=*) explicit="${1#*=}" ;;
    -h | --help) usage; exit 0 ;;
    v*) explicit="$1" ;;
    *) echo "error: unknown option: $1" >&2; usage >&2; exit 1 ;;
  esac
  shift
done

is_valid_semver() {
  node - "$1" >/dev/null <<'NODE'
const v = process.argv[2]
if (!/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v)) process.exit(1)
NODE
}

# Semver compare, strict numeric MAJOR.MINOR.PATCH. Exits 0 when $1 > $2.
semver_gt() {
  node - "$1" "$2" >/dev/null <<'NODE'
const toParts = (v) =>
  String(v).match(/^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/).slice(1).map(Number)
const a = toParts(process.argv[2])
const b = toParts(process.argv[3])
for (let i = 0; i < 3; i++) {
  if (a[i] !== b[i]) process.exit(a[i] > b[i] ? 0 : 1)
}
process.exit(1)
NODE
}

next_semver() {
  node - "$1" "$2" <<'NODE'
const [prev, bump] = process.argv.slice(2)
if (!prev) {
  console.log('v1.0.0')
  process.exit(0)
}
const m = prev.match(/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/)
const [M, mMin, p] = m.slice(1).map(Number)
let out
if (bump === 'major') out = [M + 1, 0, 0]
else if (bump === 'minor') out = [M, mMin + 1, 0]
else out = [M, mMin, p + 1]
console.log('v' + out.join('.'))
NODE
}

# Reads Android versionName from apps/mobile/app.json (source of truth, applied
# to the native project by `expo prebuild`).
read_android_version() {
  node -p "require('./apps/mobile/app.json').expo.version" 2>/dev/null || true
}

# ---- Working tree -------------------------------------------------------------

if [ "$allow_dirty" -eq 0 ] && [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is dirty" >&2
  git status --short >&2
  echo "Commit or stash changes first, or re-run with --allow-dirty." >&2
  exit 1
fi

# ---- Current context ----------------------------------------------------------

BRANCH="$(git branch --show-current || true)"
[ -n "$BRANCH" ] || BRANCH="(detached HEAD)"
COMMIT="$(git rev-parse --short HEAD)"
SUBJECT="$(git log -1 --format=%s)"

# ---- Previous release tag -----------------------------------------------------

PREV="$(git tag --list 'v*.*.*' --sort=-v:refname \
  | grep -E '^v[0-9]+\.[0-9]+\.[0-9]+$' | head -n1 || true)"
PREV_DISPLAY="${PREV:-none}"

# ---- Proposed tag --------------------------------------------------------------

if [ -n "$explicit" ]; then
  PROPOSED="$explicit"
  if ! is_valid_semver "$PROPOSED"; then
    echo "error: invalid tag '$PROPOSED'. Expected vMAJOR.MINOR.PATCH (e.g. v1.0.1)." >&2
    exit 1
  fi
else
  PROPOSED="$(next_semver "$PREV" "$bump")"
fi

# ---- Duplicate tag checks ------------------------------------------------------

dupe_local() {
  [ -n "$(git rev-parse -q --verify "refs/tags/$1" || true)" ] && return 0
  return 1
}

dupe_remote_check() {
  # Returns: 0 found, 1 not found, 2 could not verify.
  # git ls-remote --exit-code: 0 = ref matched, 2 = no matching refs,
  # any other code (e.g. 128) = could not reach/read the remote.
  local code
  set +e
  git ls-remote --exit-code origin "refs/tags/$1" >/dev/null 2>&1
  code=$?
  set -e
  if [ "$code" -eq 0 ]; then return 0
  elif [ "$code" -eq 2 ]; then return 1
  else return 2
  fi
}

if dupe_local "$PROPOSED"; then
  echo "error: tag '$PROPOSED' already exists locally (refs/tags/$PROPOSED)." >&2
  echo "Never overwrite or move an existing release tag — pick a higher version." >&2
  exit 1
fi

RCODE=0
dupe_remote_check "$PROPOSED" || RCODE=$?
if [ "$RCODE" -eq 0 ]; then
  echo "error: tag '$PROPOSED' already exists on origin." >&2
  echo "Never overwrite or move an existing release tag — pick a higher version." >&2
  exit 1
elif [ "$RCODE" -eq 2 ]; then
  echo "error: cannot verify whether '$PROPOSED' exists on origin (git ls-remote failed)." >&2
  echo "Resolve the remote connection and re-run — refusing to create an unverified tag." >&2
  exit 1
fi

# ---- Version regression ----------------------------------------------------------

if [ -n "$PREV" ] && ! semver_gt "$PROPOSED" "$PREV"; then
  echo "error: version regression. '$PROPOSED' is not newer than the previous release '$PREV'." >&2
  echo "The proposed version must be greater than $PREV (e.g. patch: $(next_semver "$PREV" patch))." >&2
  exit 1
fi

# ---- Android versionName consistency --------------------------------------------

ANDROID_VERSION="$(read_android_version)"
ANDROID_DISPLAY="${ANDROID_VERSION:-unknown}"

if [ -n "$ANDROID_VERSION" ] && [ "$PROPOSED" != "v${ANDROID_VERSION}" ]; then
  {
    echo "error: version mismatch."
    echo "  Git tag:            $PROPOSED"
    echo "  android versionName: $ANDROID_VERSION"
    echo "The GitHub Actions workflow will fail the production release unless they match."
    echo "Bump apps/mobile/app.json \"version\" (and \"android.versionCode\" for store upgrades)"
    echo "to $PROPOSED, commit that as part of the release commit, then re-run."
  } >&2
  exit 1
fi

# ---- Confirmation ----------------------------------------------------------------

SUBJECT_SHORT="$(printf '%.18s' "$SUBJECT")"
RULER="$(printf '%38s' '' | tr ' ' '─')"
row2() { printf '│ %-18s %-18s│\n' "$1" "$2"; }
row1() { printf '│ %-37s│\n' "$1"; }

echo
echo "┌${RULER}┐"
row1 'SIMBridge Release'
echo "├${RULER}┤"
row2 'Branch:' "$BRANCH"
row2 'Previous tag:' "$PREV_DISPLAY"
row2 'Proposed tag:' "$PROPOSED"
row2 'Commit:' "$COMMIT $SUBJECT_SHORT"
row2 'Android version:' "$ANDROID_DISPLAY"
echo "└${RULER}┘"

if [ "$PREV" = "none" ] || [ -z "$PREV" ]; then
  echo "Previous release tag: none — this will be the first release."
fi

if [ "$BRANCH" != "release" ] && [ "$BRANCH" != "(detached HEAD)" ]; then
  echo "warning: not on the 'release' branch (current: $BRANCH)."
fi

echo
printf 'Create release tag %s on %s? [y/N] ' "$PROPOSED" "$COMMIT"
read -r answer
case "$answer" in
  y | Y | yes | YES) ;;
  *) echo "Aborted. No tag was created." >&2; exit 1 ;;
esac

# ---- Create tag -------------------------------------------------------------------

git tag -a "$PROPOSED" -m "Release $PROPOSED"

echo
echo "Release tag created:"
echo "  $PROPOSED -> $(git rev-parse --short "$PROPOSED")"
echo
echo "Push with:"
echo "  git push origin \"$BRANCH\""
echo "  git push origin \"$PROPOSED\""
echo
echo "GitHub Actions will build the APK and publish SIMBridge $PROPOSED on push of the tag."