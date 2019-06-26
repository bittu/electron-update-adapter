# electron-update-adapter
Yet another electron-updater which provides updates with custom updatechecker and download progress.

*Supports Squirrel.Windows and Squirrel.Mac only*

## What's new in this than autoUpdater
 - Built-in autoUpdater is used inside
 - No dedicated release server is required
 - Control whether to update or not
 - You can track download progress to show UI changes
 - And quitAndInstall as usual

## Installation
` npm i electron-update-adapter `

## Usage
```
const updateAdapter = require('../electron-update-adapter')
const opts = {
  url: 'url for versions.json' // required
  logger: console // defaults to console
  checkUpdateOnStart: true,
  autoDownload: true,
  version: '' // defaults to version from package.json
}
updateAdapter.init(opts)
```

### Sample versions.json
```
{
  "win32": {
    "readme": "Second release",
    "update": "http://localhost:3001/update/win32/update-0.3.0-delta.nupkg",
    "version": "1.3.0",
    "updateReleases": "http://localhost:3001/update/win32/RELEASES"
  },
  "darwin": {
    "readme": "Second Release",
    "update": "http://localhost:3001/update/darwin/update-0.3.0-darwin.zip",
    "version": "1.3.0"
  }
}
```