# Photo sharing on the VPS

The static site (`dist/`) is served by nginx. QR sharing needs one small Node process
(`server/share.mjs`, no dependencies) that stores uploaded strips and serves `/s/<id>`.
Photos are deleted automatically after 7 days (`SHARE_TTL_DAYS`).

1. Build and upload the site as usual (`npm run build`, copy `dist/`).
2. Copy `server/share.mjs` to the VPS, e.g. `/opt/virtuabox/server/share.mjs`.
   Node 18+ is required (`node -v`).
3. Install the service:
   ```bash
   sudo cp virtuabox-share.service /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now virtuabox-share
   curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8790/s/xxxxxxxxxx   # expect 404
   ```
4. Add the two `location` blocks from `nginx-share.conf` to the photo.mirz.app server block,
   then `sudo nginx -t && sudo systemctl reload nginx`.
5. Check: open https://photo.mirz.app, finish a strip, scan the QR with a phone on mobile data.
