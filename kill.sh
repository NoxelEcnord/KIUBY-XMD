#!/bin/bash
# kill.sh - Kill all running Node.js processes
# KIUBY-XMD Maintenance Script

# kiuby-xmd process reaper — more surgical
echo "🔍 Scanning for KIUBY-XMD Node.js processes..."

# Get all node PIDs
ALL_NODE_PIDS=$(pgrep -f "node" 2>/dev/null)

# Filter out the current script PID and its parent
MY_PID=$$
MY_PARENT=$PPID

TO_KILL=""
for pid in $ALL_NODE_PIDS; do
    if [ "$pid" != "$MY_PID" ] && [ "$pid" != "$MY_PARENT" ]; then
        # Search CMD for pm2 or other process managers to skip them
        CMD=$(ps -p $pid -o command=)
        if [[ "$CMD" == *"pm2"* ]] || [[ "$CMD" == *"forever"* ]]; then
            echo "⏭️ Skipping Process Manager: PID $pid ($CMD)"
        else
            TO_KILL="$TO_KILL $pid"
        fi
    fi
done

if [ -z "$TO_KILL" ]; then
    echo "✅ No target Node.js processes found."
    exit 0
fi

echo "⚠️  Terminating process cluster: $TO_KILL"
kill -15 $TO_KILL 2>/dev/null # Try graceful first
sleep 2
kill -9 $TO_KILL 2>/dev/null # Force remaining
echo "✅ Maintenance complete."
