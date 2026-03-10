#!/bin/bash

# Tmux session launcher for BuildInLime project
# This script creates a tmux session with 4 panes in a 2x2 grid layout

SESSION_NAME="BuildInLime"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "Error: tmux is not installed. Please install it first."
    exit 1
fi

# Kill existing session if it exists
tmux has-session -t $SESSION_NAME 2>/dev/null
if [ $? -eq 0 ]; then
    echo "Killing existing session: $SESSION_NAME"
    tmux kill-session -t $SESSION_NAME
fi

# Create new tmux session with first pane
echo "Creating tmux session: $SESSION_NAME"
tmux new-session -d -s $SESSION_NAME -n "BuildInLime-App"

# Split to create 2x2 grid layout using tiled layout
tmux split-window -h -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.0
tmux split-window -v -t $SESSION_NAME:0.1

# Apply tiled layout to ensure proper 2x2 grid
tmux select-layout -t $SESSION_NAME tiled

# Rename panes
tmux select-pane -t $SESSION_NAME:0.0 -T "BuildInLime-App"
tmux select-pane -t $SESSION_NAME:0.1 -T "Backend"
tmux select-pane -t $SESSION_NAME:0.2 -T "Debugging"
tmux select-pane -t $SESSION_NAME:0.3 -T "Tests"

# Set pane titles display
tmux set-option -t $SESSION_NAME pane-border-status top
tmux set-option -t $SESSION_NAME pane-border-format "#{pane_index}: #{pane_title}"

# Select the first pane (top-left)
tmux select-pane -t $SESSION_NAME:0.0

# Attach to the session
echo "Attaching to tmux session: $SESSION_NAME"
tmux attach-session -t $SESSION_NAME
