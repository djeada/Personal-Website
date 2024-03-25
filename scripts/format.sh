#!/bin/bash

# Define paths to format
paths=( "." "../" )

# Define file types to be formatted
file_types=( "html" "css" "js" )

# Format python files with black
black scripts
black ../scripts

# Function to format files
format_files() {
    local path=$1
    local type=$2
    find "$path" -name "*.$type" -exec js-beautify --type "$type" -r {} \;
}

# Loop over each path and file type and format
for path in "${paths[@]}"; do
    for file_type in "${file_types[@]}"; do
        format_files "${path}src" "$file_type"
    done
done
