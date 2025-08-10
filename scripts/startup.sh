#!/bin/sh

# Wait for the app to be ready
echo "Waiting for app to be ready..."
sleep 5

# Initialize schedulers
echo "Initializing schedulers..."
curl -s http://localhost:3697/api/init

echo "Startup complete"