const semver  = require('semver');

const { downloadFile } = require('./httphelper')

function checkVersionUpdate(url, version) {
  return downloadFile(url)
    .then((meta) => {
      return extractUpdateMeta(meta, version);
    });
}

function extractUpdateMeta(updatesMeta, version) {
  const meta = updatesMeta[process.platform];
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