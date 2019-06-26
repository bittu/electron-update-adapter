const squirrelActions = ['squirrel-install', 'squirrel-updated', 'squirrel-uninstall', 'squirrel-obsolete']

function isSquirrelAction() {
  if (process.platform !== 'win32') {
    return false;
  }

  if (squirrelActions.indexOf(process.argv[1]) !== -1) {
    return true;
  }
  return false
}

module.exports = {
  isSquirrelAction
}