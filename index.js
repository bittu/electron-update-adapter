const { app, autoUpdater } = require('electron')
const fs = require('fs')

const { normalizeOpts } = require('./lib/normalizeopts')
const { checkVersionUpdate } = require('./lib/versionheck')
const { createServer, downloadDarwin, downloadWin32 } = require('./lib/httphelper')

class UpdateAdapter extends events.EventEmitter {
  constructor() {
    super()

    this.on('error', e => this.emit('error', e))

    autoUpdater.on('error', e => this.emit('error', e));

    autoUpdater.on('update-downloaded', () => {
      const version = this.meta.version;
      this.options.logger.info(`New version ${version} has been downloaded`);
      this.emit('download-complete', this.meta);
    });
  }

  init(options) {
    this.options = normalizeOpts(options);

    // Return if we run not compiled application
    // if (app.isPackaged === false || app.getName() === 'Electron') {
    //   this.options.disabled = true;
    //   return this;
    // }

    if (this.options.checkOnStartUp) {
      this.checkForUpdates();
    }

    return this;
  }

  checkForUpdates() {
    const opt = this.options;

    if (opt.disabled) {
      opt.logger.warn('Update is disabled');
      return this;
    }

    if (!opt.url) {
      this.emit('error', 'You must set url before calling checkForUpdates()');
      return this;
    }

    //noinspection JSUnresolvedFunction
    checkVersionUpdate(opt.url, opt.version)
      .then((update) => {
        if (update) {
          this.onUpdateAvailable(update);
        } else {
          opt.logger.debug && opt.logger.debug(
            `Update for ${this.buildId} is not available`
          );
          this.emit('update-not-available');
        }
      })
      .catch(e => this.emit('error', e));

    return this
  }

  onUpdateAvailable(update) {
    this.emit('update-available', update)

    this.meta = update;

    if (this.options.autoDownload) {
      this.downloadUpdate()
    }

    return this
  }

  async downloadUpdate() {
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
    let updateFile, releasesFile;

    if (process.platform === 'darwin') {
      updateFile = path.join(cachePath, this.meta.update.substr(this.meta.update.lastIndexOf('/') + 1))
      await downloadFiles([{
        url: this.meta.update,
        fileStream: fs.createWriteStream(updateFile)
      }])
    } else if (process.platform === 'win32') {
      releasesFile = path.join(cachePath, 'RELEASES');
      updateFile = path.join(cachePath, this.meta.update.substr(this.meta.update.lastIndexOf('/') + 1))
      await downloadFiles([{
          url: this.meta.updateReleases,
          fileStream: fs.createWriteStream(releasesFile)
        }, {
          url: this.meta.update,
          fileStream: fs.createWriteStream(updateFile)
        }])
    }
    const server = createServer()
    function getServerUrl() {
      const address = server.address()
      return `http://127.0.0.1:${address.port}`
    }

    const fileUrl = "/" + Date.now() + "-" + Math.floor(Math.random() * 9999) + ".zip"
    server.on('request', (req, res) => {
      const reqUrl = req.url;
      console.log(`${reqUrl} requested`)
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
      console.log('server started')
      autoUpdater.setFeedURL({
        url: getServerUrl(),
        headers: {"Cache-Control": "no-cache"},
      });
      autoUpdater.checkForUpdates();
    })
  }

  onDownloadProgress(progress) {
    this.emit('download-progress', progress)
  }

  quitAndInstall() {
    return autoUpdater.quitAndInstall();
  }

  setFeedUrl(url) {
    this.options.url = url;
  }
}

module.exports = new UpdateAdapter();