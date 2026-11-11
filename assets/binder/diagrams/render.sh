#!/usr/bin/env bash
# 渲染 diagrams/ 下所有 .mmd 为 PNG
# 用法: bash diagrams/render.sh
set -e

cd "$(dirname "$0")/.."

OUT="diagrams/out"
mkdir -p "$OUT"

MMDC="npx --yes @mermaid-js/mermaid-cli"

if [ ! -x "$(command -v node)" ]; then
  echo "错误: 未找到 node，请先安装 Node.js"
  exit 1
fi

echo "开始渲染 .mmd -> PNG ..."
shopt -s nullglob
for f in diagrams/*.mmd; do
  base="$(basename "$f" .mmd)"
  echo "  -> $base"
  $MMDC -i "$f" -o "$OUT/$base.png" -w 2400 -b white --scale 2 2>&1 | sed 's/^/     /' || \
  $MMDC -i "$f" -o "$OUT/$base.png" -w 2400 -b white 2>&1 | sed 's/^/     /'
done

echo "完成，输出目录: $OUT"
ls -la "$OUT" 2>/dev/null || true
