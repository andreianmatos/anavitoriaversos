#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/imagens/arquivo"
THUMB_ROOT="$SRC/thumbs"
MAX_WIDTH=560
QUALITY=82

if ! command -v magick >/dev/null 2>&1 && ! command -v convert >/dev/null 2>&1; then
  echo "ImageMagick (magick or convert) is required." >&2
  exit 1
fi

run_convert() {
  if command -v magick >/dev/null 2>&1; then
    magick "$@"
  else
    convert "$@"
  fi
}

mkdir -p "$THUMB_ROOT"

while IFS= read -r -d '' file; do
  rel="${file#"$SRC/"}"
  ext_lower="$(printf '%s' "${rel##*.}" | tr '[:upper:]' '[:lower:]')"
  dir_part="$(dirname "$rel")"
  base="$(basename "$rel")"
  base_no_ext="${base%.*}"

  if [[ "$dir_part" == "thumbs" || "$dir_part" == */thumbs ]]; then
    continue
  fi

  case "$ext_lower" in
    png|jpg|jpeg|webp|gif|bmp|tif|tiff)
      ;;
    *)
      continue
      ;;
  esac

  if [[ "$dir_part" == "." ]]; then
    thumb_dir="$THUMB_ROOT"
  else
    thumb_dir="$SRC/$dir_part/thumbs"
  fi
  mkdir -p "$thumb_dir"

  if [[ "$ext_lower" == "gif" ]]; then
    out="$thumb_dir/$base_no_ext.gif"
    if [[ -f "$out" && ! "$file" -nt "$out" ]]; then
      continue
    fi
    cp -f "$file" "$out"
    echo "gif: $rel"
  elif [[ "$ext_lower" == "png" ]]; then
    out="$thumb_dir/$base_no_ext.png"
    if [[ -f "$out" && ! "$file" -nt "$out" ]]; then
      continue
    fi
    run_convert "$file" -background none -alpha set -resize "${MAX_WIDTH}x>" -strip "png32:$out"
    echo "thumb: $rel -> ${out#"$ROOT/"}"
  else
    out="$thumb_dir/$base_no_ext.jpg"
    if [[ -f "$out" && ! "$file" -nt "$out" ]]; then
      continue
    fi
    run_convert "$file" -resize "${MAX_WIDTH}x>" -strip -quality "$QUALITY" "$out"
    echo "thumb: $rel -> ${out#"$ROOT/"}"
  fi
done < <(find "$SRC" -type f -print0)

echo "done"
