#!/usr/bin/env bash
#
# Installs and configures the thread-refs side panel for Claude Code.
# No dependencies beyond bash and the Claude Code CLI.
#
# Interactive:     bash <(curl -fsSL https://raw.githubusercontent.com/jonathanstiansen/claudesidepanel/main/setup.sh)
# Non-interactive: bash setup.sh --yes [--sections goal,prs] [--linear my-workspace]

set -euo pipefail

readonly PLUGIN="thread-refs"
readonly MARKETPLACE_REPO="jonathanstiansen/claudesidepanel"
readonly PLUGIN_ID="${PLUGIN}@claudesidepanel"
readonly ALL_SECTIONS="goal prs artifacts agents tooling"
readonly DEFAULT_SECTIONS="goal,prs,artifacts,agents,tooling"

# Choices, filled from flags, then from what is already set, then defaults.
SECTIONS=""
LINEAR=""
SECTIONS_GIVEN=0
LINEAR_GIVEN=0
ASSUME_YES=0
PREVIEW_ONLY=0

#######################################
# Prints an error to stderr and exits.
#######################################
die() {
  echo "setup: $*" >&2
  exit 1
}

warn() {
  echo "setup: $*" >&2
}

usage() {
  cat <<'EOF'
Usage: setup.sh [--yes] [--sections LIST] [--linear SLUG] [--preview]

  (no flags)       open the interactive setup
  --yes            apply without the interactive setup
  --sections LIST  sections to show, top to bottom: goal,prs,artifacts,agents,tooling
  --linear SLUG    your Linear workspace (the part after linear.app/); "" for none
  --preview        print a preview of the panel for --sections and exit
EOF
}

#######################################
# Title of a section, as the panel draws it.
# Arguments:
#   1: section id
#######################################
title_of() {
  case "$1" in
    goal) echo "GOAL: what is this thread for?" ;;
    prs) echo "🐙 PULL REQUESTS" ;;
    artifacts) echo "🎨 ARTIFACTS" ;;
    agents) echo "🤖 SUB-AGENTS" ;;
    tooling) echo "🧰 TOOLING" ;;
    *) return 1 ;;
  esac
}

#######################################
# Checks a sections list: known ids, none twice. Dies naming the bad one.
# Arguments:
#   1: comma-separated section ids
#######################################
validate_sections() {
  local id seen=","
  local -a ids
  IFS=',' read -r -a ids <<< "$1"
  for id in "${ids[@]+"${ids[@]}"}"; do
    id="${id// /}"
    [[ -z "${id}" ]] && continue
    case " ${ALL_SECTIONS} " in
      *" ${id} "*) ;;
      *) die "unknown section \"${id}\"; use any of: ${ALL_SECTIONS// /, }" ;;
    esac
    [[ "${seen}" == *",${id},"* ]] && die "section \"${id}\" is listed twice"
    seen="${seen}${id},"
  done
}

#######################################
# Checks a Linear workspace slug: letters, digits, - and _ only, or empty.
#######################################
validate_linear() {
  if [[ ! "$1" =~ ^[A-Za-z0-9_-]*$ ]]; then
    die "Linear workspace \"$1\" can only hold letters, digits, - and _"
  fi
}

#######################################
# Prints an example of the panel for a sections list.
# Arguments:
#   1: comma-separated section ids
#######################################
draw_preview() {
  local id
  local -a ids
  IFS=',' read -r -a ids <<< "$1"
  if (( ${#ids[@]} == 0 )); then
    echo "  (no sections: the panel would be empty)"
    return
  fi
  for id in "${ids[@]}"; do
    id="${id// /}"
    [[ -z "${id}" ]] && continue
    case "${id}" in
      goal) echo "  ╔ $(title_of goal) ╗" ;;
      prs)
        echo "  ╭ ▾ $(title_of prs) · 2   [as found▾][all▾]"
        local ticket=""
        if [[ -n "${LINEAR}" ]]; then ticket=" 🎫"; fi
        echo "  │   web#42${ticket}  🔀 open  ✅ ci passing"
        ;;
      artifacts)
        echo "  ╭ ▾ $(title_of artifacts) · 1"
        echo "  │   🎨 release-notes v2"
        ;;
      agents)
        echo "  ╭ ▾ $(title_of agents) · 1"
        echo "  │   ✅ Explore  find the config loader"
        ;;
      tooling)
        echo "  ╭ ▾ $(title_of tooling) · 2"
        echo "  │   ✨ commit   🧩 github"
        ;;
    esac
  done
}

#######################################
# Fails clearly when the Claude Code CLI is missing.
#######################################
require_claude() {
  command -v claude > /dev/null 2>&1 \
    || die "the Claude Code CLI (claude) is not on PATH; install it from https://claude.com/claude-code first"
}

#######################################
# Prints the gh status line; PR rows need gh signed in.
#######################################
gh_status() {
  if ! command -v gh > /dev/null 2>&1; then
    echo "⚠️  gh not installed (PR rows need it: https://cli.github.com)"
  elif ! gh auth status > /dev/null 2>&1; then
    echo "⚠️  gh not signed in (run: gh auth login)"
  else
    echo "✅ gh signed in"
  fi
}

is_installed() {
  claude plugin list --json 2>/dev/null | grep -q "\"${PLUGIN_ID}\""
}

#######################################
# Prints one current option value of the installed plugin, or nothing.
# Arguments:
#   1: option key
#######################################
current_value() {
  claude plugin configure "${PLUGIN_ID}" --json 2>/dev/null \
    | sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" \
    | head -n 1
}

#######################################
# Fills SECTIONS and LINEAR from what is installed, where no flag set them.
#######################################
load_current() {
  local value
  if is_installed; then
    if (( ! SECTIONS_GIVEN )); then
      value="$(current_value sections)"
      [[ -n "${value}" ]] && SECTIONS="${value}"
    fi
    if (( ! LINEAR_GIVEN )); then
      LINEAR="$(current_value linearWorkspace)"
    fi
  fi
  if [[ -z "${SECTIONS}" ]] && (( ! SECTIONS_GIVEN )); then
    SECTIONS="${DEFAULT_SECTIONS}"
  fi
}

#######################################
# Installs the plugin with the choices, or updates them when installed.
#######################################
apply() {
  validate_sections "${SECTIONS}"
  validate_linear "${LINEAR}"
  if is_installed; then
    printf '{"sections":"%s","linearWorkspace":"%s"}' "${SECTIONS}" "${LINEAR}" \
      | claude plugin configure "${PLUGIN_ID}" --values-stdin
    echo "Updated ${PLUGIN}: sections ${SECTIONS:-none}; Linear ${LINEAR:-off}."
  else
    local -a args=(plugin install "${PLUGIN}" --marketplace "${MARKETPLACE_REPO}" --config "sections=${SECTIONS}")
    [[ -n "${LINEAR}" ]] && args+=(--config "linearWorkspace=${LINEAR}")
    claude "${args[@]}"
    echo "Installed ${PLUGIN}: sections ${SECTIONS:-none}; Linear ${LINEAR:-off}."
  fi
  echo "Start a new Claude Code session, then run /thread-refs or paste a PR link."
}

# ── interactive setup ───────────────────────────────────────────────────────

ORDER=()   # every section id, in the order the person arranged them
ON=()      # 1 where ORDER's section shows, parallel to ORDER

#######################################
# Builds ORDER and ON from SECTIONS: shown ones first, in order, then the rest.
#######################################
state_from_sections() {
  local id
  local -a ids
  ORDER=()
  ON=()
  IFS=',' read -r -a ids <<< "${SECTIONS}"
  for id in "${ids[@]+"${ids[@]}"}"; do
    id="${id// /}"
    [[ -z "${id}" ]] && continue
    ORDER+=("${id}")
    ON+=(1)
  done
  for id in ${ALL_SECTIONS}; do
    [[ ",${SECTIONS// /}," == *",${id},"* ]] && continue
    ORDER+=("${id}")
    ON+=(0)
  done
}

sections_from_state() {
  local i out=""
  for (( i = 0; i < ${#ORDER[@]}; i++ )); do
    (( ON[i] )) && out="${out:+${out},}${ORDER[i]}"
  done
  SECTIONS="${out}"
}

restore_terminal() {
  printf '\033[?25h' > /dev/tty
  stty sane < /dev/tty 2> /dev/null || true
}

#######################################
# Reads one key from the terminal: up, down, enter, space, or the letter.
#######################################
read_key() {
  local key rest
  IFS= read -rsn1 key < /dev/tty
  if [[ "${key}" == $'\x1b' ]]; then
    IFS= read -rsn2 rest < /dev/tty
    case "${rest}" in
      '[A') echo up ;;
      '[B') echo down ;;
      *) echo esc ;;
    esac
  elif [[ -z "${key}" ]]; then
    echo enter
  elif [[ "${key}" == " " ]]; then
    echo space
  else
    echo "${key}"
  fi
}

draw_header() {
  printf '\033[H\033[2J'
  echo " thread-refs setup"
  echo " ── Preview (example) ─────────────────────────────────"
  draw_preview "${SECTIONS}"
  echo " ──────────────────────────────────────────────────────"
}

#######################################
# The sections screen: toggle with space, move with u/d, back with enter or q.
#######################################
edit_sections() {
  local cursor=0 key i mark tmp
  state_from_sections
  while true; do
    sections_from_state
    draw_header
    echo " Sections (space: show/hide · u/d: move · enter: done)"
    for (( i = 0; i < ${#ORDER[@]}; i++ )); do
      mark="✗"
      (( ON[i] )) && mark="✓"
      if (( i == cursor )); then
        printf ' \033[7m ▸ %s %s \033[0m\n' "${mark}" "$(title_of "${ORDER[i]}")"
      else
        printf '   %s %s\n' "${mark}" "$(title_of "${ORDER[i]}")"
      fi
    done
    key="$(read_key)"
    case "${key}" in
      up | k) if (( cursor > 0 )); then cursor=$(( cursor - 1 )); fi ;;
      down | j) if (( cursor < ${#ORDER[@]} - 1 )); then cursor=$(( cursor + 1 )); fi ;;
      space) ON[cursor]=$(( 1 - ON[cursor] )) ;;
      u | d)
        local to
        if [[ "${key}" == "u" ]]; then to=$(( cursor - 1 )); else to=$(( cursor + 1 )); fi
        if (( to >= 0 && to < ${#ORDER[@]} )); then
          tmp="${ORDER[to]}"; ORDER[to]="${ORDER[cursor]}"; ORDER[cursor]="${tmp}"
          tmp="${ON[to]}"; ON[to]="${ON[cursor]}"; ON[cursor]="${tmp}"
          cursor="${to}"
        fi
        ;;
      enter | q | esc) sections_from_state; return ;;
    esac
  done
}

edit_linear() {
  local value
  draw_header
  printf '\033[?25h'
  stty echo < /dev/tty
  echo " Linear workspace: the part after linear.app/ (empty: no ticket links)"
  printf ' > '
  IFS= read -r value < /dev/tty || true
  stty -echo < /dev/tty
  printf '\033[?25l'
  if [[ "${value}" =~ ^[A-Za-z0-9_-]*$ ]]; then
    LINEAR="${value}"
  fi
}

#######################################
# The main menu, modelled on ccstatusline: live preview above, menu below.
#######################################
run_tui() {
  local cursor=0 key i claude_line gh_line save_label linear_line
  local -a items
  { : < /dev/tty; } 2> /dev/null || die "no terminal to ask in; pass --yes with --sections and --linear"
  trap restore_terminal EXIT
  stty -echo < /dev/tty
  printf '\033[?25l' > /dev/tty
  claude_line="✅ claude $(claude --version 2>/dev/null | head -n 1 | cut -d' ' -f1)"
  gh_line="$(gh_status)"
  # asked once: each claude call takes about a second, too slow for every redraw
  if is_installed; then save_label="Save to Claude Code"; else save_label="Install to Claude Code"; fi
  while true; do
    # plain ifs, not $(a && b): under set -e a failing substitution in an assignment ends the script
    if [[ -n "${LINEAR}" ]]; then linear_line="${LINEAR}  → 🎫 ticket links on"; else linear_line="off"; fi
    items=(
      "Sections        ${SECTIONS:-none}"
      "Linear          ${linear_line}"
      "Requirements    ${claude_line}   ${gh_line}"
      "${save_label}"
      "Quit without saving"
    )
    draw_header
    for (( i = 0; i < ${#items[@]}; i++ )); do
      if (( i == cursor )); then
        printf ' \033[7m ▸ %s \033[0m\n' "${items[i]}"
      else
        printf '   %s\n' "${items[i]}"
      fi
    done
    echo
    echo " ↑↓ move · enter select · q quit"
    key="$(read_key)"
    case "${key}" in
      up | k) if (( cursor > 0 )); then cursor=$(( cursor - 1 )); fi ;;
      down | j) if (( cursor < ${#items[@]} - 1 )); then cursor=$(( cursor + 1 )); fi ;;
      q | esc) restore_terminal; echo "Nothing saved."; exit 0 ;;
      enter)
        case "${cursor}" in
          0) edit_sections ;;
          1) edit_linear ;;
          3) restore_terminal; printf '\033[H\033[2J'; apply; exit 0 ;;
          4) restore_terminal; echo "Nothing saved."; exit 0 ;;
        esac
        ;;
    esac
  done
}

main() {
  while (( $# )); do
    case "$1" in
      --yes | -y) ASSUME_YES=1 ;;
      --sections) SECTIONS="${2-}"; SECTIONS_GIVEN=1; shift ;;
      --linear) LINEAR="${2-}"; LINEAR_GIVEN=1; shift ;;
      --preview) PREVIEW_ONLY=1 ;;
      -h | --help) usage; exit 0 ;;
      *) usage >&2; die "unknown option: $1" ;;
    esac
    shift
  done

  if (( PREVIEW_ONLY )); then
    validate_sections "${SECTIONS:-${DEFAULT_SECTIONS}}"
    draw_preview "${SECTIONS:-${DEFAULT_SECTIONS}}"
    exit 0
  fi

  require_claude
  (( SECTIONS_GIVEN )) && validate_sections "${SECTIONS}"
  (( LINEAR_GIVEN )) && validate_linear "${LINEAR}"
  load_current
  if (( ASSUME_YES )); then
    [[ "$(gh_status)" == ✅* ]] || warn "$(gh_status)"
    apply
  else
    run_tui
  fi
}

main "$@"
