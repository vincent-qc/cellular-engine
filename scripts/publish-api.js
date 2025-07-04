import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const apiPackagePath = join(root, 'packages/api');

function runCommand(command, cwd = root) {
  console.log(`Running: ${command}`);
  execSync(command, { stdio: 'inherit', cwd });
}

function updateVersion(type = 'patch') {
  const packageJsonPath = join(apiPackagePath, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  
  const [major, minor, patch] = packageJson.version.split('.').map(Number);
  let newVersion;
  
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
  }
  
  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  console.log(`Updated version to ${newVersion}`);
  
  return newVersion;
}

function main() {
  const args = process.argv.slice(2);
  const versionType = args[0] || 'patch';
  const dryRun = args.includes('--dry-run');
  const tag = args.find(arg => arg.startsWith('--tag='))?.split('=')[1] || 'latest';
  
  console.log('🚀 Publishing @cellular/gemini-api package...');
  console.log(`Version type: ${versionType}`);
  console.log(`Tag: ${tag}`);
  console.log(`Dry run: ${dryRun}`);
  
  try {
    // Step 1: Update version
    const newVersion = updateVersion(versionType);
    
    // Step 2: Build the package
    console.log('\n📦 Building package...');
    runCommand('npm run build', apiPackagePath);
    
    // Step 3: Run tests (if available)
    console.log('\n🧪 Running tests...');
    try {
      runCommand('npm test', apiPackagePath);
    } catch (_error) {
      console.log('⚠️  Tests failed or not available, continuing...');
    }
    
    // Step 4: Publish to npm
    console.log('\n📤 Publishing to npm...');
    const publishCommand = `npm publish ${dryRun ? '--dry-run' : ''} --tag ${tag}`;
    runCommand(publishCommand, apiPackagePath);
    
    if (dryRun) {
      console.log('\n✅ Dry run completed successfully!');
    } else {
      console.log(`\n✅ Successfully published @cellular/gemini-api@${newVersion} to npm!`);
      console.log(`📋 Package URL: https://www.npmjs.com/package/@cellular/gemini-api`);
    }
    
  } catch (error) {
    console.error('\n❌ Publishing failed:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 