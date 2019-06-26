const { app, autoUpdater } = require('electron')
const fs = require('fs')
const { EventEmitter } = require('events')
const path = require('path')

const { isSquirrelAction } = require('./lib/win32')
const { normalizeOpts } = require('./lib/normalizeopts')
const { checkVersionUpdate } = require('./lib/versioncheck')
const { createServer, downloadFiles } = require('./lib/httphelper')

class UpdateAdapter extends EventEmitter {
  constructor() {
    super()

    this.options = {
      logger: console,
      checkUpdateOnStart: true,
      autoDownload: true,
      version: '',
      empty: true
    }

    this.on('error', e => this.options.logger && this.options.logger.error(e))

    autoUpdater.on('error', e => this.emit('error', e));

    autoUpdater.on('update-downloaded', _ => {
      const version = this.meta.version;
      this.options.logger.info(`New version ${version} has been downloaded`);
      this.emit('update-downloaded', this.meta);
    });
  }

  init = (options) => {
    if (!this.options.empty) {
      this.emit('error', 'initialized already');
      return this;
    }

    // Return if we run not compiled application
    if (app.isPackaged === false || app.getName() === 'Electron') {
      this.options.disabled = true;
      return this;
    }

    this.options = normalizeOpts(options);

    if (isSquirrelAction()) {
      this.emit('squirrel-event');
      return this;
    }

    if (this.options.checkUpdateOnStart) {
      this.checkForUpdates();
    }

    return this;
  }

  checkForUpdates = () => {
    const opt = this.options;

    if (opt.disabled) {
      opt.logger.warn('Update is disabled');
      this.emit('update-disabled')
      return this;
    }

    if (!opt.url) {
      this.emit('error', 'You must set url before calling checkForUpdates()');
      return this;
    }
    // console.log('UpdateAdapter checking for updates')

    checkVersionUpdate(opt.url, opt.version)
      .then((update) => {
        if (update) {
          this.onUpdateAvailable(update);
        } else {
          opt.logger.debug && opt.logger.debug(
            `Update for ${process.platform}-${opt.version} is not available`
          );
          this.emit('update-not-available');
        }
      })
      .catch(e => this.emit('error', e));

    return this
  }

  onUpdateAvailable = (update) => {
    this.emit('update-available', update)

    this.meta = update;
    // console.log('onUpdateVAialable', this.options.autoDownload)

    if (this.options.autoDownload) {
      this.downloadUpdate()
    }

    return this
  }

  downloadUpdate = async () => {
    if (!this.meta.update) {
      const msg = 'There is no metadata for update. Run checkForUpdates first.';
      this.emit('error', msg);
      return this;
    }

    let feedUrl;

    this.emit('update-downloading', this.meta);

    // download files | emit progress | emit download complete
    // start server | init autoUpdater with local server url

    const cachePath = path.join(app.getPath('userData'), 'Cache');
    const downloadPath = path.join(cachePath, 'downloads');
    let updateFile, releasesFile;

    try {
      fs.mkdirSync(cachePath)
    } catch(e) {} // Silently ignore if folder already exists

    try {
      fs.mkdirSync(downloadPath)
    } catch(e) {} // Silently ignore if folder already exists

    try {
      if (process.platform === 'darwin') {
        updateFile = path.join(downloadPath, this.meta.update.substr(this.meta.update.lastIndexOf('/') + 1))
        await downloadFiles([{
          url: this.meta.update,
          fileStream: fs.createWriteStream(updateFile)
        }], progress => this.emit('download-progress', progress))
      } else if (process.platform === 'win32') {
        releasesFile = path.join(downloadPath, 'RELEASES');
        updateFile = path.join(downloadPath, this.meta.update.substr(this.meta.update.lastIndexOf('/') + 1))
        await downloadFiles([{
            url: this.meta.updateReleases,
            fileStream: fs.createWriteStream(releasesFile)
          }, {
            url: this.meta.update,
            fileStream: fs.createWriteStream(updateFile)
          }], progress => this.emit('download-progress', progress))
      }
      const server = createServer()
      function getServerUrl() {
        const address = server.address()
        return `http://127.0.0.1:${address.port}`
      }

      const fileUrl = "/" + Date.now() + "-" + Math.floor(Math.random() * 9999) + ".zip"
      server.on('request', (req, res) => {
        const reqUrl = req.url;
        // console.log(`${reqUrl} requested`)
        if (reqUrl === '/') {
          const data = Buffer.from(`{ "url": "${getServerUrl()}${fileUrl}" }`)
          res.writeHead(200, {"Content-Type": "application/json", "Content-Length": data.length})
          res.end(data)
          return;
        }
        if (reqUrl === '/RELEASES') {
          const relReadStream = fs.createReadStream(releasesFile)
          relReadStream.on("error", error => {
            try {
              res.end()
            }
            catch (e) {
              console.warn(`cannot end response: ${e}`)
            }
          })

          res.writeHead(200, {
            "Content-Type": "text/plain",
            "Content-Length": fs.statSync(releasesFile).size
          })
          relReadStream.pipe(res)
          return;
        }

        if (!reqUrl.startsWith(fileUrl)) {
          console.warn(`${reqUrl} requested, but not supported`)
          res.writeHead(404)
          res.end()
          return
        }

        res.on("finish", () => {
          try {
            setImmediate(() => server.close())
          } catch(e) {
            console.log(e)
          }
        })

        const readStream = fs.createReadStream(updateFile)
        readStream.on("error", error => {
          try {
            res.end()
          }
          catch (e) {
            console.warn(`cannot end response: ${e}`)
          }
        })

        res.writeHead(200, {
          "Content-Type": "application/zip",
          "Content-Length": fs.statSync(updateFile).size
        })
        readStream.pipe(res)
      })
      server.listen(0, () => {
        // console.log('server started')
        autoUpdater.setFeedURL({
          url: getServerUrl(),
          headers: {"Cache-Control": "no-cache"},
        });
        autoUpdater.checkForUpdates();
      })
    } catch(e) {
      this.options.logger.error(e)
      this.emit('error', 'Failed to download updates')
    }
  }

  quitAndInstall = () => {
    return autoUpdater.quitAndInstall();
  }

  setFeedUrl = (url) => {
    this.options.url = url;
  }
}

module.exports = new UpdateAdapter();