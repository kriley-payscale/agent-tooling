import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const TOOL_NAMES = ['dotnet', 'sqlcmd', 'rg']

export function isRunnableFile(candidate, platform = process.platform) {
  try {
    if (!fs.statSync(candidate).isFile()) return false
    if (platform !== 'win32') fs.accessSync(candidate, fs.constants.X_OK)
    return true
  } catch {
    return false
  }
}

function directoryNames(directory) {
  try {
    return fs.readdirSync(directory).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
  } catch {
    return []
  }
}

export function findTool(name, { platform = process.platform, env = process.env, home = os.homedir() } = {}) {
  const dirs = [
    ...(env.PATH ?? '')
      .split(platform === 'win32' ? ';' : ':')
      .map((dir) => dir.replace(/^"|"$/g, ''))
      .filter((dir) => path.isAbsolute(dir)),
    path.join(home, '.dotnet', 'tools'),
    path.join(home, '.dotnet')
  ]
  if (env.DOTNET_ROOT && path.isAbsolute(env.DOTNET_ROOT)) dirs.push(env.DOTNET_ROOT)
  if (platform === 'darwin') {
    for (const prefix of [env.HOMEBREW_PREFIX, '/opt/homebrew', '/usr/local'].filter((dir) => dir && path.isAbsolute(dir))) {
      dirs.push(path.join(prefix, 'bin'))
      if (name === 'sqlcmd') dirs.push(path.join(prefix, 'opt/mssql-tools18/bin'), path.join(prefix, 'opt/mssql-tools/bin'))
    }
    dirs.push('/usr/local/share/dotnet', '/usr/local/share/dotnet/x64')
  } else if (platform === 'win32') {
    for (const root of new Set([env.ProgramW6432, env.ProgramFiles, env['ProgramFiles(x86)']].filter((dir) => dir && path.isAbsolute(dir)))) {
      dirs.push(path.join(root, 'dotnet'))
      if (name === 'sqlcmd') {
        const odbcRoot = path.join(root, 'Microsoft SQL Server/Client SDK/ODBC')
        for (const version of directoryNames(odbcRoot).filter((entry) => /^\d+$/.test(entry))) {
          dirs.push(path.join(odbcRoot, version, 'Tools/Binn'))
        }
      }
    }
  }
  const extensions =
    platform === 'win32'
      ? (env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean)
      : ['']
  const candidates = dirs.flatMap((dir) => extensions.map((ext) => path.resolve(dir, `${name}${ext}`)))
  if (name === 'rg') {
    if (platform === 'darwin') {
      candidates.push(
        `/Applications/Cursor.app/Contents/Resources/app/node_modules/@cursor/ripgrep-darwin-${process.arch}/bin/rg`,
        '/Applications/Cursor.app/Contents/Resources/app/node_modules/@vscode/ripgrep/bin/rg'
      )
    } else if (platform === 'win32') {
      const cursorRoots = [
        env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Programs', 'cursor'),
        env.ProgramFiles && path.join(env.ProgramFiles, 'Cursor')
      ].filter(Boolean)
      for (const root of cursorRoots) {
        candidates.push(
          path.join(root, `resources/app/node_modules/@cursor/ripgrep-win32-${process.arch}/bin/rg.exe`),
          path.join(root, 'resources/app/node_modules/@vscode/ripgrep/bin/rg.exe')
        )
      }
    }
  }
  return candidates.find((candidate) => isRunnableFile(candidate, platform)) ?? null
}
