// Renames the single-file build to a friendly name.
import { renameSync } from 'fs';
renameSync('dist-single/index.html', 'dist-single/Subron-Tracker.html');
console.log('Built dist-single/Subron-Tracker.html');
