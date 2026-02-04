#!/bin/bash
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Paths and Variables
# Assuming the script is in the root of the saltcorn repo
export PATH="$SCRIPT_DIR/packages/saltcorn-cli/bin:$PATH"
export SQLITE_FILEPATH=~/sctestdb
export SALTCORN_SESSION_SECRET=secret

echo "Environment Configured:"
echo "  PATH includes saltcorn-cli/bin"
echo "  SQLITE_FILEPATH=$SQLITE_FILEPATH"
echo "  SALTCORN_SESSION_SECRET=******"
echo ""

# Check if saltcorn is available
if ! command -v saltcorn &> /dev/null; then
    echo "Error: saltcorn command not found in PATH."
    exit 1
fi

show_help() {
    echo "Usage: ./run_saltcorn.sh [command]"
    echo "Commands:"
    echo "  reset-schema   - Reset the database schema (DANGER: deletes data)"
    echo "  serve          - Run the development server (with auto-restart loop)"
    echo "  version        - Show saltcorn version"
    echo "  help           - Show this help message"
}

case "$1" in
    reset-schema)
        echo "Resetting schema..."
        saltcorn reset-schema -f
        echo "Schema reset complete."
        ;;
    serve|dev)
        if [ ! -s "$SQLITE_FILEPATH" ]; then
            echo "Error: Database file '$SQLITE_FILEPATH' is missing or empty."
            echo "Please run './run_saltcorn.sh reset-schema' first to initialize the database."
            exit 1
        fi
        echo "Compiling (npm run tsc)..."
        npm run tsc
        echo "Starting server loop..."
        while true; do
            echo "Starting saltcorn serve..."
            # Using '|| true' to prevent script exit on server crash if set -e is active (though saltcorn serve might exit clean)
            saltcorn serve --dev || true
            echo "Server stopped. Restarting in 2 seconds..."
            sleep 2
        done
        ;;
    version)
        saltcorn --version
        ;;
    *)
        show_help
        ;;
esac
