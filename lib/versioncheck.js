const semver  = require('semver');

const { downloadFiles } = require('./httphelper')

function checkVersionUpdate(url, version) {
  return downloadFiles([{url}])
    .then((meta) => {
      // console.log('meta', meta, Array.isArray(meta))
      return extractUpdateMeta(meta[0], version);
    });
}

function extractUpdateMeta(updatesMeta, version) {
  const meta = updatesMeta[process.platform];
  // console.log('platform meta', meta, process.platform)
  if (!meta || !meta.version) {
    return false;
  }

  if (semver.gt(meta.version, version)) {
    return meta;
  }

  return false;
}

module.exports = {
  checkVersionUpdate
}