#!/bin/bash

# Function to check if a command exists
command_exists() {
    type "$1" &> /dev/null ;
}

# Check for necessary tools
dependencies=( "black" "js-beautify" "parallel" )
missing_dependencies=()

for dep in "${dependencies[@]}"; do
    if ! command_exists "$dep"; then
        missing_dependencies+=("$dep")
    fi
done

# Exit if there are missing dependencies
if [ ${#missing_dependencies[@]} -ne 0 ]; then
    echo "Missing dependencies: ${missing_dependencies[*]}"
    echo "Please install them before running this script."
    exit 1
fi

# Define paths to format
paths=( "." "../" )

# Define file types to be formatted
file_types=( "html" "css" "js" )

# Format python files with black
black scripts
black ../scripts

# Function to format files
format_files() {
    local file_path=$1
    local type=$(echo $file_path | sed 's/.*\.//')
    js-beautify --type "$type" -r "$file_path"
}

export -f format_files

# Loop over each path and file type and format using parallel
for path in "${paths[@]}"; do
    for file_type in "${file_types[@]}"; do
        find "${path}src" -name "*.$file_type" -print0 | parallel --bar -0 'format_files {}'
    done
done
