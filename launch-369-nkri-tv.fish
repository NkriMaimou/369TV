#!/usr/bin/env fish
cd /home/nkri/Projects/vidnest-desktop; or exit 1
echo "Starting 369 NKRI TV desktop app..."
npx tauri dev
set result $status
if test $result -ne 0
    echo "Startup failed with exit code $result"
    read -P "Press Enter to close..."
end
exit $result
