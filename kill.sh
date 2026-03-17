#!/bin/bash
# kill.sh - Kill all running Node.js processes
# KIUBY-XMD Maintenance Script

echo "🔍 Scanning for running Node.js processes..."

NODE_PIDS=$(pgrep -f "node" 2>/dev/null)

if [ -z "$NODE_PIDS" ]; then
    echo "✅ No Node.js processes found running."
    exit 0
fi

echo "⚠️  Found Node.js processes:"
ps aux | grep "[n]ode" | awk '{print "  PID: "$2"  CMD: "$11" "$12" "$13}'

echo ""
echo "🔪 Killing all Node.js processes..."

kill -9 $NODE_PIDS 2>/dev/null

sleep 1

# Verify
REMAINING=$(pgrep -f "node" 2>/dev/null)
if [ -z "$REMAINING" ]; then
    echo "✅ All Node.js processes have been terminated."
else
    echo "⚠️  Some processes survived. Force killing..."
    kill -9 $REMAINING 2>/dev/null
    echo "✅ Done."
fi
