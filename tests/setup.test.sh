#!/usr/bin/env bash
#
# Tests for setup.sh. A fake `claude` and `gh` on PATH record what the script runs.
# Run: bash tests/setup.test.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly ROOT
readonly SETUP="${ROOT}/setup.sh"
FAILED=0

#######################################
# Makes a temp dir with a fake claude and gh, prints its path.
# Arguments:
#   1: "installed" when the plugin should look installed, else anything.
#######################################
make_fakes() {
  local dir
  dir="$(mktemp -d)"
  mkdir -p "${dir}/bin"
  cat > "${dir}/bin/claude" <<EOF
#!/usr/bin/env bash
echo "claude \$*" >> "${dir}/calls.log"
if [[ "\$*" == "plugin list --json" ]]; then
  if [[ "$1" == "installed" ]]; then
    echo '[{"id": "thread-refs@claudesidepanel", "enabled": true}]'
  else
    echo '[]'
  fi
elif [[ "\$*" == "plugin configure thread-refs@claudesidepanel --json" ]]; then
  echo '{"inputs": {"sections": "tooling,prs", "linearWorkspace": "old-ws"}}'
elif [[ "\$*" == *"--values-stdin"* ]]; then
  cat >> "${dir}/stdin.log"
elif [[ "\$*" == "--version" ]]; then
  echo "2.1.309 (Claude Code)"
fi
EOF
  printf '#!/usr/bin/env bash\nexit 0\n' > "${dir}/bin/gh"
  chmod +x "${dir}/bin/claude" "${dir}/bin/gh"
  echo "${dir}"
}

#######################################
# Records a failure when $2 does not contain $3.
#######################################
expect_contains() {
  if [[ "$2" != *"$3"* ]]; then
    echo "FAIL: $1"
    echo "  expected to contain: $3"
    echo "  got: $2"
    FAILED=1
  else
    echo "pass: $1"
  fi
}

test_fresh_install_passes_choices_as_config() {
  local dir
  dir="$(make_fakes fresh)"
  PATH="${dir}/bin:/usr/bin:/bin" bash "${SETUP}" --yes --sections prs,goal --linear acme > /dev/null
  expect_contains "fresh install runs plugin install with the choices" "$(cat "${dir}/calls.log")" \
    "claude plugin install thread-refs --marketplace jonathanstiansen/claudesidepanel --config sections=prs,goal --config linearWorkspace=acme"
}

test_installed_plugin_is_reconfigured_in_place() {
  local dir
  dir="$(make_fakes installed)"
  PATH="${dir}/bin:/usr/bin:/bin" bash "${SETUP}" --yes --sections prs,goal --linear acme > /dev/null
  expect_contains "installed plugin is configured, not reinstalled" "$(cat "${dir}/calls.log")" \
    "claude plugin configure thread-refs@claudesidepanel --values-stdin"
  expect_contains "configure gets the choices as JSON" "$(cat "${dir}/stdin.log")" \
    '{"sections":"prs,goal","linearWorkspace":"acme"}'
}

test_rerun_keeps_current_values() {
  local dir
  dir="$(make_fakes installed)"
  PATH="${dir}/bin:/usr/bin:/bin" bash "${SETUP}" --yes > /dev/null
  expect_contains "a rerun with no choices keeps what is set" "$(cat "${dir}/stdin.log")" \
    '{"sections":"tooling,prs","linearWorkspace":"old-ws"}'
}

test_unknown_section_fails_naming_it() {
  local dir out
  dir="$(make_fakes fresh)"
  out="$(PATH="${dir}/bin:/usr/bin:/bin" bash "${SETUP}" --yes --sections prs,nope 2>&1 || true)"
  expect_contains "an unknown section is refused by name" "${out}" 'unknown section "nope"'
  if [[ -f "${dir}/calls.log" ]] && grep -q "plugin install" "${dir}/calls.log"; then
    echo "FAIL: nothing is installed after a bad section"; FAILED=1
  fi
}

test_bad_linear_slug_fails() {
  local dir out
  dir="$(make_fakes fresh)"
  out="$(PATH="${dir}/bin:/usr/bin:/bin" bash "${SETUP}" --yes --linear 'a b"' 2>&1 || true)"
  expect_contains "a Linear slug with spaces or quotes is refused" "${out}" "Linear workspace"
}

test_missing_claude_fails_clearly() {
  local out
  out="$(PATH="/usr/bin:/bin" bash "${SETUP}" --yes 2>&1 || true)"
  expect_contains "no claude on PATH says so" "${out}" "Claude Code CLI"
}

test_preview_draws_sections_in_order() {
  local out
  out="$(bash "${SETUP}" --preview --sections tooling,prs)"
  expect_contains "preview shows tooling" "${out}" "TOOLING"
  expect_contains "preview shows prs" "${out}" "PULL REQUESTS"
  if [[ "${out}" == *"GOAL"* ]]; then echo "FAIL: preview hides goal when left out"; FAILED=1; fi
  if [[ "${out%%PULL REQUESTS*}" != *"TOOLING"* ]]; then echo "FAIL: preview keeps the order"; FAILED=1; fi
}

# the interactive menu opens in a real terminal (script gives it one) and quits on q, with Linear unset
test_interactive_menu_opens_and_quits() {
  local dir out
  dir="$(make_fakes fresh)"
  out="$( (sleep 2; printf 'q') | PATH="${dir}/bin:/usr/bin:/bin" script -q /dev/null /bin/bash "${SETUP}" 2>&1 || true)"
  expect_contains "the menu draws" "${out}" "Install to Claude Code"
  expect_contains "q quits without saving" "${out}" "Nothing saved."
}

main() {
  test_interactive_menu_opens_and_quits
  test_fresh_install_passes_choices_as_config
  test_installed_plugin_is_reconfigured_in_place
  test_rerun_keeps_current_values
  test_unknown_section_fails_naming_it
  test_bad_linear_slug_fails
  test_missing_claude_fails_clearly
  test_preview_draws_sections_in_order
  if (( FAILED )); then
    echo "setup.sh tests FAILED"
    exit 1
  fi
  echo "setup.sh tests passed"
}

main "$@"
