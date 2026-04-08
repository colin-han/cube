import { SemVer } from 'semver';
import * as lockfile from '@yarnpkg/lockfile';
import * as fs from 'fs';
import * as path from 'path';
import { internalExceptions } from '@cubejs-backend/shared';

const devPackages = [
  'typescript',
];

export function isCubeNotServerPackage(pkgName: string): boolean {
  return pkgName !== '@cubejs-backend/server' && pkgName.toLowerCase().startsWith('@cubejs-backend/');
}

export function isCubePackage(pkgName: string): boolean {
  return pkgName.toLowerCase().startsWith('@cubejs-backend/');
}

export function isDevPackage(pkgName: string): boolean {
  return isCubePackage(pkgName) || devPackages.includes(pkgName.toLowerCase());
}

export function isSimilarPackageRelease(pkg: SemVer, core: SemVer): boolean {
  if (pkg.major === 0 && core.major === 0) {
    return pkg.minor === core.minor;
  }

  return pkg.major === core.major;
}

export function getMajorityVersion(pkg: SemVer, strict: boolean = false): string {
  if (pkg.major === 0) {
    if (strict) {
      return `^${pkg.major}.${pkg.minor}.${pkg.patch}`;
    }

    return `^${pkg.major}.${pkg.minor}`;
  }

  if (strict) {
    return `^${pkg.major}.${pkg.minor}`;
  }

  return `^${pkg.major}`;
}

export type ProjectLock = {
  resolveVersion: (pkg: string) => string | null
};

export function parseNpmLock(): ProjectLock | null {
  const file = fs.readFileSync(
    path.join(process.cwd(), 'package-lock.json'),
    'utf8'
  );

  try {
    const lock = JSON.parse(file);

    if (!lock) {
      return null;
    }

    if (!lock.dependencies) {
      return null;
    }

    return {
      resolveVersion: (pkg: string) => {
        if (pkg in lock.dependencies) {
          return lock.dependencies[pkg].version;
        }

        return null;
      },
    };
  } catch (e: any) {
    internalExceptions(e);

    return null;
  }
}

export function parseYarnLock(): ProjectLock | null {
  const file = fs.readFileSync(
    path.join(process.cwd(), 'yarn.lock'),
    'utf8'
  );

  // Detect Yarn 4 Berry format (contains __metadata: block)
  if (file.includes('__metadata:')) {
    const object: Record<string, { version: string }> = {};
    // Yarn 4 Berry entries: one or more quoted keys followed by a block with "version: x.y.z"
    const blockRegex = /^"([^"]+)":\n((?:[ \t]+[^\n]+\n)*)/gm;
    let match;
    while ((match = blockRegex.exec(file)) !== null) {
      const keys = match[1].split(', ');
      const block = match[2];
      const versionMatch = block.match(/[ \t]+version:[ \t]+"?([^\n"]+)"?/);
      if (versionMatch) {
        for (const key of keys) {
          // Strip protocol prefix (e.g. "pkg@npm:1.0.0" -> store as "pkg@npm:1.0.0")
          object[key] = { version: versionMatch[1] };
        }
      }
    }

    return {
      resolveVersion: (pkg: string) => {
        // Match keys that start with "<pkg>@" to handle any version range/protocol suffix
        const prefix = `${pkg}@`;
        const found = Object.keys(object).find((k) => k.startsWith(prefix));
        if (found) {
          return object[found].version;
        }

        return null;
      },
    };
  }

  try {
    const { type, object } = lockfile.parse(file);

    if (type === 'success') {
      return {
        resolveVersion: (pkg: string) => {
          const prefix = `${pkg}@`;
          const found = Object.keys(object).find((k) => k.startsWith(prefix));
          if (found) {
            return (object[found] as any).version;
          }

          return null;
        },
      };
    }
  } catch (e: any) {
    internalExceptions(e);
  }

  return null;
}
