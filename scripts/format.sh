#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Function to check if a command exists
command_exists() {
    type "$1" &> /dev/null ;
}

if command_exists js-beautify; then
    JS_BEAUTIFY=(js-beautify)
elif command_exists npx; then
    JS_BEAUTIFY=(npx --yes js-beautify)
else
    JS_BEAUTIFY=()
fi

dependencies=( "black" )
missing_dependencies=()

for dep in "${dependencies[@]}"; do
    if ! command_exists "$dep"; then
        missing_dependencies+=("$dep")
    fi
done

if [ ${#JS_BEAUTIFY[@]} -eq 0 ]; then
    missing_dependencies+=("js-beautify or npx")
fi

# Exit if there are missing dependencies
if [ ${#missing_dependencies[@]} -ne 0 ]; then
    echo "Missing dependencies: ${missing_dependencies[*]}"
    echo "Please install them before running this script."
    exit 1
fi

# Define file types to be formatted
file_types=( "html" "css" "js" )

# Format python files with black
black "$SCRIPT_DIR"

for file_type in "${file_types[@]}"; do
    files=()
    while IFS= read -r -d '' file_path; do
        files+=("$file_path")
        if [ ${#files[@]} -ge 50 ]; then
            "${JS_BEAUTIFY[@]}" --type "$file_type" -r "${files[@]}"
            files=()
        fi
    done < <(find "$ROOT_DIR/src" -name "*.$file_type" -print0)

    if [ ${#files[@]} -gt 0 ]; then
        "${JS_BEAUTIFY[@]}" --type "$file_type" -r "${files[@]}"
    fi
done
