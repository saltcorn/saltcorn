#!/bin/bash
set -e
# Check for npm
if ! command -v npm &> /dev/null; then
    echo "Error: npm could not be found. Please install Node.js and npm."
    exit 1
fi

# 1. Install dependencies
echo "Installing dependencies..."
npm install --legacy-peer-deps

# 2. Build
echo "Building project..."
npm run tsc

# 3. Reset DB
echo "Resetting database..."
export SQLITE_FILEPATH=~/sctestdb
packages/saltcorn-cli/bin/saltcorn reset-schema -f

# 4. Run Server
echo "Starting server..."
export SALTCORN_SESSION_SECRET=xxxxx
while true; do
    packages/saltcorn-cli/bin/saltcorn serve --dev
    echo "Server crashed or stopped. Restarting in 1 second..."
    sleep 1
done
