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

        response
          .on('data', chunk => {
            fileStream.write(chunk);
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
            file.end();
            if (onComplete && typeof onComplete === 'function') {
              onComplete();
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
  console.log('starting server')
  try {
    server = http.createServer();
    console.log('server created', server)
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