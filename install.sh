#!/usr/bin/env bash
set -euo pipefail

REPO="https://github.com/mannyyang/clypfeed.git"
INSTALL_DIR="${CLYPFEED_DIR:-$HOME/.clypfeed}"
BIN_DIR="/usr/local/bin"

echo "ClypFeed Installer"
echo "=================="
echo ""

# Check prerequisites
if ! command -v node &>/dev/null; then
  echo "Error: Node.js is required (>=22). Install from https://nodejs.org"
  exit 1
fi

NODE_MAJOR=$(node -e "console.log(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "Error: Node.js >=22 required (found v$(node -v))"
  exit 1
fi

if ! command -v git &>/dev/null; then
  echo "Error: git is required."
  exit 1
fi

# Clone or update
if [ -d "$INSTALL_DIR" ]; then
  echo "Updating existing installation at $INSTALL_DIR..."
  git -C "$INSTALL_DIR" pull --ff-only
else
  echo "Cloning clypfeed to $INSTALL_DIR..."
  git clone "$REPO" "$INSTALL_DIR"
fi

# Install dependencies
echo "Installing dependencies..."
cd "$INSTALL_DIR"
npm install --no-fund --no-audit

# Create wrapper script
WRAPPER="$INSTALL_DIR/bin/clypfeed"
mkdir -p "$INSTALL_DIR/bin"
cat > "$WRAPPER" <<'SCRIPT'
#!/usr/bin/env bash
CLYPFEED_DIR="${CLYPFEED_DIR:-$HOME/.clypfeed}"
exec npx --prefix "$CLYPFEED_DIR" tsx "$CLYPFEED_DIR/src/cli.ts" "$@"
SCRIPT
chmod +x "$WRAPPER"

# Symlink to PATH
if [ -w "$BIN_DIR" ]; then
  ln -sf "$WRAPPER" "$BIN_DIR/clypfeed"
  echo "Linked clypfeed to $BIN_DIR/clypfeed"
else
  echo "Linking to $BIN_DIR (may require sudo)..."
  sudo ln -sf "$WRAPPER" "$BIN_DIR/clypfeed"
fi

# Create .env if missing
if [ ! -f "$INSTALL_DIR/.env" ]; then
  touch "$INSTALL_DIR/.env"
  echo ""
  echo "Optional: Edit $INSTALL_DIR/.env to enable email ingestion:"
  echo "  EMAIL_USER=you@gmail.com"
  echo "  EMAIL_PASSWORD=your-app-password"
fi

echo ""
echo "Done! Run: clypfeed --help"
