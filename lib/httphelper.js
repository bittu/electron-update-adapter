const http = require('http')

const TIMEOUT = 240000;

function downloadFile({url, fileStream}, onProgress, onComplete) {
  const timeoutWrapper = (req, reject) => () => {
    req.abort();
    reject('error', `timeout error downloading file ${url}`)
  }

  return new Promise((resolve, reject) => {
    const request = http.get(url)
      .on('response', response => {
        const len = parseInt(response.headers['content-length'], 10);

        let downloaded = 0;
        let progress = 0;
        let prevProgress = 0;
        let body = ''

        response
          .on('data', chunk => {
            if (fileStream) {
              fileStream.write(chunk);
            } else {
              body += chunk
            }
            downloaded += chunk.length;

            progress = (100.0 * downloaded / len).toFixed(0);

            if (progress !== prevProgress && onProgress && typeof onProgress === 'function') {
              onProgress(progress)
            }

            prevProgress = progress;

            clearTimeout(timeoutId);
            timeoutId = setTimeout(timeoutAction, TIMEOUT);
          })
          .on('end', () => {
            clearTimeout(timeoutId);
            if (fileStream) {
              fileStream.end();
            }
            if (onComplete && typeof onComplete === 'function') {
              onComplete();
            }
            if (fileStream) {
              resolve()
            } else {
              resolve(JSON.parse(body))
            }
          })
      })
      const timeoutAction = timeoutWrapper(request, reject);
      let timeoutId = setTimeout(timeoutAction, TIMEOUT);
  })
}

function downloadFiles(files, onProgress, onComplete) {
  return Promise.all(files.map(file => {
    return downloadFile(file, onProgress, onComplete)
  }))
}

function createServer() {
  let server;
  try {
    server = http.createServer();
    server.on("close", () => {
      console.info(`Proxy server for native Squirrel updates is closed (was started to download)`)
    })
  } catch(e) {
    console.log(e)
  }
  return server
}

module.exports = {
  createServer,
  downloadFiles
}